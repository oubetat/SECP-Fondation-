/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 004
 * Human Reachability Engine & CAD Geometry Interaction
 * 
 * Computes spatial reachability of a Digital Human Model (DHM) using Human IK/FK,
 * anatomical joint ROM constraints, and CAD obstacle collision evaluation via CollisionAuthority.
 */

import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { HumanInverseKinematicsEngine } from '../kinematics/HumanInverseKinematicsEngine';
import { HumanJointConstraintSolver } from '../kinematics/HumanJointConstraintSolver';
import { IKEffectorTarget } from '../kinematics/types';
import { CollisionAuthority } from '../../collision-authority/CollisionAuthority';
import { CanonicalCollisionInput, CollisionStatus } from '../../collision-authority/types';
import { ReachabilityEvaluationInput, ReachabilityEvaluationResult, HumanReachabilityStatus } from './types';

export class HumanReachabilityEngine {
  public static readonly VERSION = '1.0.0-PROD';

  public static readonly DOCUMENTED_LIMITATIONS = [
    'Consumes ANSUR II dataset values qualified with limitations (Mean/P50 variance ±1.3mm).',
    'ROM limits represent unsuited general boundaries (NASA-STD-3001 Vol 2).',
    'Reachability classification does not evaluate ergonomic comfort, fatigue, or muscle forces.'
  ];

  /**
   * Evaluates spatial reachability for a target position against a DHM profile and CAD obstacles
   */
  public static evaluateReachability(input: ReachabilityEvaluationInput): ReachabilityEvaluationResult {
    const timestampIso = new Date().toISOString();
    const evalId = `REACH_${input.effectorRegion}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    // 1. Validate Inputs
    if (!input || !input.effectorRegion || !input.targetPositionMm) {
      return this.createFailResult(evalId, timestampIso, input, 'INVALID_INPUT', 'Null or incomplete ReachabilityEvaluationInput provided.');
    }

    const pos = input.targetPositionMm;
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      return this.createFailResult(evalId, timestampIso, input, 'INVALID_INPUT', 'Target position coordinates contain non-finite values.');
    }

    // 2. Load DHM Profile & Skeleton Topology
    const registry = AnthropometricDatasetRegistry.getInstance();
    const profileId = input.dhmProfileId || 'ANSUR2_MALE_P50';
    const profile = registry.getProfile(profileId);

    if (!profile || !profile.isValid) {
      return this.createFailResult(evalId, timestampIso, input, 'INVALID_INPUT', `DHM profile '${profileId}' not found or invalid in registry.`);
    }

    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
    if (!skeleton.isValid) {
      return this.createFailResult(evalId, timestampIso, input, 'INVALID_INPUT', `Failed to construct valid skeletal topology for profile '${profileId}'.`);
    }

    // 3. Compute Inverse Kinematics for Effector Target
    const initialPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
    const targetTolerance = input.solverOptions?.positionToleranceMm ?? 10.0;

    const effectorTarget: IKEffectorTarget = {
      effectorRegion: input.effectorRegion,
      targetPositionMm: pos,
      targetOrientationEulerDeg: input.targetOrientationEulerDeg,
      weight: 1.0,
      positionToleranceMm: targetTolerance
    };

    const ikResult = HumanInverseKinematicsEngine.solveIK(
      skeleton,
      initialPose,
      [effectorTarget],
      input.solverOptions || { maxIterations: 120 }
    );

    const effKey = input.effectorRegion.toString();
    const positionResidualMm = ikResult.positionResidualsMm[effKey] ?? 9999.0;
    const isKinematicallyReachable = ikResult.success && positionResidualMm <= targetTolerance;

    // 4. Check Anatomical Admissibility
    const jointViolations: string[] = [];
    let isAnatomicallyAdmissible = true;

    for (const [jId, sat] of Object.entries(ikResult.jointLimitSaturations)) {
      if (sat.flexExtSaturated || sat.abdAddSaturated || sat.intExtSaturated) {
        jointViolations.push(`Joint ${jId} reached hard anatomical ROM boundary.`);
      }
    }

    if (ikResult.convergenceStatus === 'TARGET_UNREACHABLE' || positionResidualMm > 250) {
      isAnatomicallyAdmissible = false;
    }

    // 5. Check Obstacle Collision via CollisionAuthority
    let isCollisionFree = true;
    let collisionResultInfo: any = undefined;
    let collisionEvalFailed = false;

    if (input.obstacleGeometry) {
      const obstacle = input.obstacleGeometry;
      const collisionInput: CanonicalCollisionInput = {
        domain: 'ASSEMBLY',
        coordinateFrame: input.coordinateFrame === 'MCS' ? 'MCS' : 'WCS',
        units: 'MILLIMETERS',
        cadRevisionId: obstacle.revisionId || String(input.revision),
        toleranceProfile: {
          linearToleranceMm: 1.0,
          angularToleranceDeg: 1.0,
          safeClearanceMarginMm: 5.0
        },
        motionSegment: {
          startTcp: pos,
          endTcp: pos
        },
        geometry: {
          documentId: obstacle.documentId || input.documentId,
          revisionId: obstacle.revisionId || String(input.revision),
          bounds: obstacle.bounds || { min: { x: -1000, y: -1000, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } },
          tessellatedTriangles: obstacle.triangles
        }
      };

      try {
        const colRes = CollisionAuthority.evaluateSync(collisionInput, 'EXACT_NARROW_PHASE');
        const hasPenetration = colRes.status === CollisionStatus.INTERFERENCE ||
          colRes.status === CollisionStatus.PENETRATION ||
          colRes.status === CollisionStatus.MACHINE_COLLISION;

        const evalFailed = colRes.status === CollisionStatus.ANALYSIS_FAILED ||
          colRes.status === CollisionStatus.INVALID_GEOMETRY ||
          colRes.failureState.isFailed;

        if (evalFailed) {
          collisionEvalFailed = true;
          isCollisionFree = false;
        } else if (hasPenetration || colRes.metrics.maxPenetrationDepthMm > 0) {
          isCollisionFree = false;
        }

        collisionResultInfo = {
          status: colRes.status,
          minClearanceMm: colRes.metrics.minClearanceMm,
          hasPenetration,
          reason: colRes.failureState.failureReason || undefined
        };
      } catch (err: any) {
        collisionEvalFailed = true;
        isCollisionFree = false;
        collisionResultInfo = {
          status: 'ANALYSIS_FAILED',
          minClearanceMm: 0,
          hasPenetration: true,
          reason: err?.message || String(err)
        };
      }
    }

    // 6. Classify Overall Status
    let status: HumanReachabilityStatus = 'REACHABLE_COLLISION_FREE';

    if (collisionEvalFailed) {
      status = 'COLLISION_EVALUATION_FAILED';
    } else if (!isKinematicallyReachable) {
      status = 'KINEMATICALLY_UNREACHABLE';
    } else if (!isAnatomicallyAdmissible) {
      status = 'ANATOMICALLY_INADMISSIBLE';
    } else if (!isCollisionFree) {
      status = 'REACHABLE_WITH_COLLISION';
    } else {
      status = 'REACHABLE_COLLISION_FREE';
    }

    const rawHashStr = `${evalId}:${input.documentId}:${input.revision}:${profileId}:${input.effectorRegion}:${pos.x},${pos.y},${pos.z}:${status}`;
    const provenanceHash = this.hashString(rawHashStr);

    return {
      evaluationId: evalId,
      effector: input.effectorRegion,
      targetPositionMm: pos,
      coordinateFrame: input.coordinateFrame || 'WCS',
      dhmProfileId: profileId,
      documentId: input.documentId,
      revision: input.revision,
      status,
      isKinematicallyReachable,
      isAnatomicallyAdmissible,
      isCollisionFree,
      positionResidualMm: Number(positionResidualMm.toFixed(3)),
      ikResult,
      jointLimitViolations: jointViolations,
      collisionResult: collisionResultInfo,
      limitations: [...HumanReachabilityEngine.DOCUMENTED_LIMITATIONS],
      provenanceHash,
      createdAtIso: timestampIso
    };
  }

  private static createFailResult(
    evalId: string,
    timestampIso: string,
    input: ReachabilityEvaluationInput,
    status: HumanReachabilityStatus,
    reason: string
  ): ReachabilityEvaluationResult {
    return {
      evaluationId: evalId,
      effector: input?.effectorRegion,
      targetPositionMm: input?.targetPositionMm || { x: 0, y: 0, z: 0 },
      coordinateFrame: input?.coordinateFrame || 'WCS',
      dhmProfileId: input?.dhmProfileId || 'UNKNOWN',
      documentId: input?.documentId || 'UNKNOWN',
      revision: input?.revision || 1,
      status,
      isKinematicallyReachable: false,
      isAnatomicallyAdmissible: false,
      isCollisionFree: false,
      positionResidualMm: 9999.0,
      ikResult: {
        success: false,
        convergenceStatus: 'FAILED',
        solvedPose: HumanForwardKinematicsEngine.createDefaultNeutralPose(),
        fkResult: { success: false, segmentStates: {} as any, endEffectors: {}, diagnostics: [reason] },
        iterations: 0,
        positionResidualsMm: {},
        jointLimitSaturations: {},
        diagnostics: [reason]
      },
      jointLimitViolations: [reason],
      limitations: [...HumanReachabilityEngine.DOCUMENTED_LIMITATIONS, reason],
      provenanceHash: this.hashString(`${evalId}:${reason}`),
      createdAtIso: timestampIso
    };
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
