/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 004
 * Spatial Reach Envelope Generator & Discrete Grid Sampler
 * 
 * Generates deterministic 3D reach envelopes for selected human effectors.
 */

import { Vector3D } from '../../assembly/graph/types';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { AnthropometricDatasetRegistry } from '../anthropometry/AnthropometricDatasetRegistry';
import { SkeletalTopologyEngine } from '../topology/SkeletalTopologyEngine';
import { HumanForwardKinematicsEngine } from '../kinematics/HumanForwardKinematicsEngine';
import { HumanReachabilityEngine } from './HumanReachabilityEngine';
import { ReachEnvelopeSamplingConfig, ReachEnvelopeResult, SampledReachPoint, ReachabilityEvaluationInput } from './types';

export class ReachEnvelopeEngine {
  public static readonly VERSION = '1.0.0-PROD';

  public static readonly SAMPLING_LIMITATIONS = [
    'Sampled grid coverage does not prove continuous mathematical reachability.',
    'Envelope accuracy depends on grid resolution and IK convergence threshold.',
    'Consumes qualified ANSUR II anthropometric dataset foundation with documented mean/P50 limitations.'
  ];

  /**
   * Generates spatial 3D reach envelope for a given effector by sampling grid points
   */
  public static generateEnvelope(
    documentId: string,
    revision: string | number,
    effector: AnatomicalRegion,
    profileId: string = 'ANSUR2_MALE_P50',
    config: ReachEnvelopeSamplingConfig = { resolutionMm: 150 },
    obstacleGeometry?: any
  ): ReachEnvelopeResult {
    const timestampIso = new Date().toISOString();
    const envId = `ENV_${effector}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    const registry = AnthropometricDatasetRegistry.getInstance();
    const profile = registry.getProfile(profileId);
    if (!profile || !profile.isValid) {
      throw new Error(`[ReachEnvelopeEngine] Cannot generate envelope for invalid profile '${profileId}'.`);
    }

    const skeleton = SkeletalTopologyEngine.buildSkeleton(profile);
    const neutralPose = HumanForwardKinematicsEngine.createDefaultNeutralPose();
    const neutralFK = HumanForwardKinematicsEngine.computeFK(skeleton, neutralPose);

    const effKey = effector.toString();
    const neutralEffPos = neutralFK.endEffectors[effKey]?.positionMm || { x: 0, y: 0, z: 0 };

    // Determine sampling bounding box centered around neutral position
    const resMm = config.resolutionMm || 150;
    const radiusMm = 800; // General reach sphere radius
    const minBox: Vector3D = config.samplingBounds?.min || {
      x: neutralEffPos.x - radiusMm,
      y: neutralEffPos.y - radiusMm,
      z: neutralEffPos.z - radiusMm
    };
    const maxBox: Vector3D = config.samplingBounds?.max || {
      x: neutralEffPos.x + radiusMm,
      y: neutralEffPos.y + radiusMm,
      z: neutralEffPos.z + radiusMm
    };

    const sampledPoints: SampledReachPoint[] = [];
    let reachableCount = 0;
    let collisionFreeCount = 0;
    let maxSamples = config.maxSamples ?? 120;

    let envMinX = Infinity, envMinY = Infinity, envMinZ = Infinity;
    let envMaxX = -Infinity, envMaxY = -Infinity, envMaxZ = -Infinity;

    // Grid sampling loop
    for (let x = minBox.x; x <= maxBox.x && sampledPoints.length < maxSamples; x += resMm) {
      for (let y = minBox.y; y <= maxBox.y && sampledPoints.length < maxSamples; y += resMm) {
        for (let z = minBox.z; z <= maxBox.z && sampledPoints.length < maxSamples; z += resMm) {
          const targetPos: Vector3D = { x, y, z };

          const evalInput: ReachabilityEvaluationInput = {
            documentId,
            revision,
            dhmProfileId: profileId,
            effectorRegion: effector,
            targetPositionMm: targetPos,
            coordinateFrame: 'WCS',
            obstacleGeometry,
            solverOptions: { maxIterations: 30, positionToleranceMm: 15.0 }
          };

          const evalRes = HumanReachabilityEngine.evaluateReachability(evalInput);

          const isReachable = evalRes.isKinematicallyReachable;
          const isColFree = evalRes.isCollisionFree;

          if (isReachable) {
            reachableCount++;
            if (isColFree) collisionFreeCount++;

            if (x < envMinX) envMinX = x;
            if (y < envMinY) envMinY = y;
            if (z < envMinZ) envMinZ = z;
            if (x > envMaxX) envMaxX = x;
            if (y > envMaxY) envMaxY = y;
            if (z > envMaxZ) envMaxZ = z;
          }

          sampledPoints.push({
            positionMm: targetPos,
            status: evalRes.status,
            isKinematicallyReachable: isReachable,
            isCollisionFree: isColFree,
            residualMm: evalRes.positionResidualMm
          });
        }
      }
    }

    const totalEvaluated = sampledPoints.length;
    const coverageRatio = totalEvaluated > 0 ? Number((reachableCount / totalEvaluated).toFixed(4)) : 0;

    const envelopeBounds = {
      min: { x: isFinite(envMinX) ? envMinX : 0, y: isFinite(envMinY) ? envMinY : 0, z: isFinite(envMinZ) ? envMinZ : 0 },
      max: { x: isFinite(envMaxX) ? envMaxX : 0, y: isFinite(envMaxY) ? envMaxY : 0, z: isFinite(envMaxZ) ? envMaxZ : 0 }
    };

    const rawStr = `${envId}:${documentId}:${revision}:${effector}:${totalEvaluated}:${reachableCount}:${coverageRatio}`;
    const provenanceHash = this.hashString(rawStr);

    return {
      envelopeId: envId,
      effector,
      dhmProfileId: profileId,
      samplingConfig: config,
      totalSamplesEvaluated: totalEvaluated,
      reachablePointCount: reachableCount,
      collisionFreePointCount: collisionFreeCount,
      coverageRatio,
      sampledReachPoints: sampledPoints,
      envelopeBounds,
      limitations: [...ReachEnvelopeEngine.SAMPLING_LIMITATIONS],
      provenanceHash,
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
