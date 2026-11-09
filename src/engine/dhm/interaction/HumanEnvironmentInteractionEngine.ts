/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 007
 * Human-Environment Interaction & Task Assessment Engine
 * 
 * Coordinates DHM, Kinematics, Reachability, Vision, and Ergonomics engines
 * to analyze complex human tasks within a defined engineering environment.
 */

import { 
  HumanTaskDefinition, 
  HumanTaskAnalysis, 
  TaskStateAnalysis, 
  InteractionObject,
  InteractionStatus 
} from './types';
import { HumanReachabilityEngine } from '../reachability/HumanReachabilityEngine';
import { HumanLineOfSightEngine } from '../vision/HumanLineOfSightEngine';
import { HumanErgonomicsEngine } from '../ergonomics/HumanErgonomicsEngine';
import { ErgonomicEvidence } from '../ergonomics/types';
import { Vector3D } from '../../assembly/graph/types';

export class HumanEnvironmentInteractionEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Performs a comprehensive analysis of a human task sequence
   */
  public static analyzeTask(
    task: HumanTaskDefinition,
    environment: {
      objects: InteractionObject[];
      globalObstacles?: Vector3D[][];
    },
    context: { documentId: string; revision: number }
  ): HumanTaskAnalysis {
    const timestampIso = new Date().toISOString();
    const analysisId = `TASK_ANALYSIS_${task.taskId}_${Date.now()}`;
    
    const stateAnalyses: TaskStateAnalysis[] = [];
    let overallFeasibility = true;
    let maxErgonomicRisk = 0;
    const criticalIssues: string[] = [];

    // 1. Process Each Task State
    for (const state of task.states) {
      const stateAnalysis = this.analyzeState(state, task.dhmProfileId, environment, context);
      stateAnalyses.push(stateAnalysis);

      if (!stateAnalysis.isFeasible) {
        overallFeasibility = false;
        criticalIssues.push(`State ${state.stateId}: ${stateAnalysis.status} - ${stateAnalysis.feasibilityIssues.join(', ')}`);
      }

      if (stateAnalysis.ergonomics) {
        const risk = this.normalizeErgonomicRisk(stateAnalysis.ergonomics);
        if (risk > maxErgonomicRisk) maxErgonomicRisk = risk;
      }
    }

    // 2. Generate Evidence & Hash
    const provenanceStr = `${analysisId}:${task.taskId}:${context.documentId}:${context.revision}:${overallFeasibility}`;
    const provenanceHash = this.hashString(provenanceStr);

    return {
      analysisId,
      taskId: task.taskId,
      documentId: context.documentId,
      revision: context.revision,
      states: stateAnalyses,
      overallFeasibility,
      maxErgonomicRiskScore: maxErgonomicRisk,
      criticalIssues,
      limitations: [
        'Analysis assumes static environment for each state snapshot.',
        'Interaction analysis is limited by CAD geometry tessellation quality.',
        'Metabolic cost, fatigue, and dynamic transition physics are not simulated.',
        'PERSISTENCE_NOT_PROVEN: Results are managed in-memory within the EngineeringDocument SOT.'
      ],
      provenanceHash,
      createdAtIso: timestampIso
    };
  }

  /**
   * Analyzes a single task state snapshot
   */
  private static analyzeState(
    state: any,
    profileId: string,
    environment: { objects: InteractionObject[]; globalObstacles?: Vector3D[][] },
    context: { documentId: string; revision: number }
  ): TaskStateAnalysis {
    const issues: string[] = [];
    let status: InteractionStatus = InteractionStatus.FEASIBLE;

    // A. Determine Target Position
    let targetPos: Vector3D | undefined = state.targetPositionWCS;
    let targetObj: InteractionObject | undefined = undefined;

    if (state.targetObjectId) {
      targetObj = environment.objects.find(o => o.objectId === state.targetObjectId);
      if (targetObj) {
        if (state.targetPointKey) {
          targetPos = targetObj.interactionPoints[state.targetPointKey]?.positionWCS;
          if (!targetPos) issues.push(`Target point '${state.targetPointKey}' not found in object '${state.targetObjectId}'.`);
        }
      } else {
        issues.push(`Target object '${state.targetObjectId}' not found in environment.`);
      }
    }

    if (!targetPos) {
      return {
        stateId: state.stateId,
        status: InteractionStatus.INVALID_INPUT,
        isFeasible: false,
        feasibilityIssues: issues.length > 0 ? issues : ['No valid target position defined.'],
      };
    }

    // B. Perform Reachability Analysis (Includes IK and Collision)
    let reachability: any = undefined;
    try {
      reachability = HumanReachabilityEngine.evaluateReachability({
        dhmProfileId: profileId,
        effectorRegion: state.effectorRegion,
        targetPositionMm: targetPos,
        coordinateFrame: 'WCS',
        documentId: context.documentId,
        revision: context.revision,
        solverOptions: {
          maxIterations: 500,
          positionToleranceMm: 5.0
        },
        obstacleGeometry: {
          triangles: this.collectAllTriangles(environment, targetObj?.objectId),
          documentId: 'ENV_OBSTACLES',
          revisionId: '1'
        }
      });

      if (state.requiresReachability) {
        if (reachability.status === 'KINEMATICALLY_UNREACHABLE') {
          status = InteractionStatus.INFEASIBLE_REACH;
          issues.push('Target is kinematically unreachable for the given effector.');
        } else if (reachability.status === 'ANATOMICALLY_INADMISSIBLE') {
          status = InteractionStatus.INFEASIBLE_REACH;
          issues.push('Target reach requires exceeding anatomical joint ROM boundaries.');
        } else if (reachability.status === 'REACHABLE_WITH_COLLISION') {
          status = InteractionStatus.INFEASIBLE_COLLISION;
          issues.push('Effector reaches target but causes collision with environment geometry.');
        } else if (reachability.status === 'COLLISION_EVALUATION_FAILED') {
          status = InteractionStatus.SUBSYSTEM_FAILURE;
          issues.push(`Collision subsystem reported failure: ${reachability.collisionResult?.reason || 'Unknown error'}`);
        }
      }
    } catch (err: any) {
      status = InteractionStatus.SUBSYSTEM_FAILURE;
      issues.push(`Reachability engine crash: ${err.message}`);
    }

    // C. Perform Visibility Analysis
    let visibility: any = undefined;
    if (state.requiresVisibility && status === InteractionStatus.FEASIBLE) {
      try {
        visibility = HumanLineOfSightEngine.evaluateLineOfSight({
          dhmProfileId: profileId,
          poseState: reachability?.ikResult?.solvedPose,
          targetPositionMm: state.requiredGazePoint || targetPos,
          obstacleGeometry: {
            triangles: this.collectAllTriangles(environment),
            documentId: 'ENV_OBSTACLES'
          },
          documentId: context.documentId,
          revision: context.revision
        });

        if (visibility.status === 'FULLY_OCCLUDED') {
          status = InteractionStatus.INFEASIBLE_VISIBILITY;
          issues.push('Target point is fully occluded by environment geometry.');
        } else if (visibility.status === 'OUTSIDE_VISUAL_FIELD') {
          status = InteractionStatus.INFEASIBLE_VISIBILITY;
          issues.push('Target point lies outside the human visual field (FOV).');
        } else if (visibility.status === 'INVALID_INPUT' || visibility.status === 'FAILED') {
          status = InteractionStatus.SUBSYSTEM_FAILURE;
          issues.push(`Vision subsystem reported failure: ${visibility.limitations?.[visibility.limitations.length - 1]}`);
        }
      } catch (err: any) {
        status = InteractionStatus.SUBSYSTEM_FAILURE;
        issues.push(`Vision engine crash: ${err.message}`);
      }
    }

    // D. Perform Ergonomic Evaluation
    let ergonomics: ErgonomicEvidence | undefined = undefined;
    if (reachability?.ikResult?.solvedPose && status === InteractionStatus.FEASIBLE) {
      try {
        ergonomics = HumanErgonomicsEngine.evaluatePosture({
          dhmProfileId: profileId,
          pose: reachability.ikResult.solvedPose,
          taskInputs: {
            forceKg: state.externalLoadKg || 0,
            isStatic: true,
            repetitionCountPerMin: 1,
            durationMinutes: 1,
            isSymmetric: state.isLoadSymmetric ?? true
          },
          methodology: 'RULA'
        });

        // Optional: High risk could be flagged as risky but feasible depending on criteria
        if (ergonomics.actionLevel >= 4) {
          // In some strict safety models, action level 4 is infeasible
          // status = InteractionStatus.ERGONOMIC_LIMIT_EXCEEDED;
          // issues.push('Postural risk score exceeds industrial safety limits (RULA Action Level 4).');
        }
      } catch (err: any) {
        // Ergonomic failure shouldn't necessarily make the task 'physically' infeasible, 
        // but we flag it as a subsystem failure if requested.
        issues.push(`Ergonomics engine warning: ${err.message}`);
      }
    }

    return {
      stateId: state.stateId,
      status,
      isFeasible: status === InteractionStatus.FEASIBLE,
      feasibilityIssues: issues,
      reachability,
      visibility,
      ergonomics
    };
  }

  /**
   * Aggregates all environment triangles for collision/vision
   */
  private static collectAllTriangles(
    environment: { objects: InteractionObject[]; globalObstacles?: Vector3D[][] },
    excludeObjectId?: string
  ): Vector3D[][] {
    const all: Vector3D[][] = [];
    if (environment.globalObstacles) {
      all.push(...environment.globalObstacles);
    }
    for (const obj of environment.objects) {
      if (obj.objectId !== excludeObjectId && obj.geometryTriangles) {
        all.push(...obj.geometryTriangles);
      }
    }
    return all;
  }

  private static normalizeErgonomicRisk(res: ErgonomicEvidence): number {
    return res.scores?.finalScore || 0;
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
