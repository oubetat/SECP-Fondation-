/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 005
 * Human Line-of-Sight & Visibility Analysis Engine
 * 
 * Performs geometric raycasting from Left/Right eye origins to target points or CAD regions,
 * evaluates first-hit CAD geometry obstructions, and calculates occlusion percentages.
 */

import { Vector3D } from '../../assembly/graph/types';
import { ExactNarrowPhaseMath, Triangle3DExact } from '../../collision-authority/narrow-phase/ExactNarrowPhaseMath';
import { LineOfSightQueryInput, LineOfSightQueryResult, HumanVisionStatus, FirstHitObstacle } from './types';
import { HumanVisualModel } from './HumanVisualModel';

export class HumanLineOfSightEngine {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Evaluates line of sight and visibility status for a target position or region
   */
  public static evaluateLineOfSight(input: LineOfSightQueryInput): LineOfSightQueryResult {
    const timestampIso = new Date().toISOString();
    const queryId = `LOS_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

    // 1. Validate Input
    if (!input || !input.targetPositionMm) {
      return this.createFailResult(queryId, timestampIso, input, 'INVALID_INPUT', 'Null or incomplete LineOfSightQueryInput provided.');
    }

    const tgtPos = input.targetPositionMm;
    if (!isFinite(tgtPos.x) || !isFinite(tgtPos.y) || !isFinite(tgtPos.z)) {
      return this.createFailResult(queryId, timestampIso, input, 'INVALID_INPUT', 'Target position contains non-finite coordinates.');
    }

    const profileId = input.dhmProfileId || 'ANSUR2_MALE_P50';

    // 2. Compute Eye Origins and Gaze Direction
    const eyeConfig = HumanVisualModel.computeEyeConfiguration(profileId, input.poseState, input.eyeConfig);
    const gazeVector = HumanVisualModel.computeGazeDirection(profileId, input.poseState, input.gazeConfig);

    const leftEye = eyeConfig.leftEyeOriginWCS;
    const rightEye = eyeConfig.rightEyeOriginWCS;

    // 3. Test Visual Field (FOV) Inclusion
    const leftFOV = HumanVisualModel.testVisualFieldInclusion(leftEye, gazeVector, tgtPos, true);
    const rightFOV = HumanVisualModel.testVisualFieldInclusion(rightEye, gazeVector, tgtPos, false);

    const isInsideFOV = leftFOV.isInsideFOV || rightFOV.isInsideFOV;
    const isInsideFovealCone = leftFOV.isInsideFovealCone || rightFOV.isInsideFovealCone;

    if (!isInsideFOV) {
      return {
        queryId,
        documentId: input.documentId || 'DOC_VISION_001',
        revision: input.revision || 1,
        dhmProfileId: profileId,
        status: 'OUTSIDE_VISUAL_FIELD',
        isLeftEyeUnobstructed: false,
        isRightEyeUnobstructed: false,
        isInsideVisualField: false,
        isInsideFovealCone: false,
        leftEyeRayDistanceMm: Number(ExactNarrowPhaseMath.distance(leftEye, tgtPos).toFixed(3)),
        rightEyeRayDistanceMm: Number(ExactNarrowPhaseMath.distance(rightEye, tgtPos).toFixed(3)),
        occlusionPercentage: 100.0,
        limitations: [...HumanVisualModel.VISUAL_MODEL_PROVENANCE, 'Target lies outside defined visual field (FOV) boundaries.'],
        provenanceHash: this.hashString(`${queryId}:OUTSIDE_VISUAL_FIELD`),
        createdAtIso: timestampIso
      };
    }

    // 4. Raycast Left Eye and Right Eye to Target Point against CAD Obstacles
    const leftDist = ExactNarrowPhaseMath.distance(leftEye, tgtPos);
    const rightDist = ExactNarrowPhaseMath.distance(rightEye, tgtPos);

    let leftObstruction: FirstHitObstacle | null = null;
    let rightObstruction: FirstHitObstacle | null = null;

    if (input.obstacleGeometry?.triangles && input.obstacleGeometry.triangles.length > 0) {
      const triangles = input.obstacleGeometry.triangles;
      const obstacleId = input.obstacleGeometry.documentId || 'CAD_OBSTACLE_001';

      leftObstruction = this.raycastTriangles(leftEye, tgtPos, triangles, obstacleId);
      rightObstruction = this.raycastTriangles(rightEye, tgtPos, triangles, obstacleId);
    }

    const isLeftEyeUnobstructed = leftObstruction === null;
    const isRightEyeUnobstructed = rightObstruction === null;

    // 5. Evaluate Target Region Occlusion (if target region points provided)
    let occlusionPercentage = 0.0;
    let firstHitObstacle: FirstHitObstacle | undefined = undefined;

    if (!isLeftEyeUnobstructed || !isRightEyeUnobstructed) {
      firstHitObstacle = leftObstruction || rightObstruction || undefined;
    }

    if (input.targetRegion?.samplePoints && input.targetRegion.samplePoints.length > 0) {
      const regionPoints = input.targetRegion.samplePoints;
      let blockedCount = 0;

      for (const pt of regionPoints) {
        if (input.obstacleGeometry?.triangles) {
          const blockL = this.raycastTriangles(leftEye, pt, input.obstacleGeometry.triangles, 'CAD_OBSTACLE');
          const blockR = this.raycastTriangles(rightEye, pt, input.obstacleGeometry.triangles, 'CAD_OBSTACLE');
          if (blockL && blockR) {
            blockedCount++;
          }
        }
      }

      occlusionPercentage = Number(((blockedCount / regionPoints.length) * 100).toFixed(1));
    } else {
      if (!isLeftEyeUnobstructed && !isRightEyeUnobstructed) {
        occlusionPercentage = 100.0;
      } else if (!isLeftEyeUnobstructed || !isRightEyeUnobstructed) {
        occlusionPercentage = 50.0;
      } else {
        occlusionPercentage = 0.0;
      }
    }

    // 6. Classify Vision Status
    let status: HumanVisionStatus = 'VISIBLE_BINOCULAR';

    if (input.targetRegion?.samplePoints && input.targetRegion.samplePoints.length > 0) {
      if (occlusionPercentage >= 100.0) {
        status = 'FULLY_OCCLUDED';
      } else if (occlusionPercentage > 0.0) {
        status = 'PARTIALLY_OCCLUDED';
      } else if (isLeftEyeUnobstructed && !isRightEyeUnobstructed) {
        status = 'VISIBLE_LEFT_EYE_ONLY';
      } else if (!isLeftEyeUnobstructed && isRightEyeUnobstructed) {
        status = 'VISIBLE_RIGHT_EYE_ONLY';
      } else {
        status = 'VISIBLE_BINOCULAR';
      }
    } else {
      if (!isLeftEyeUnobstructed && !isRightEyeUnobstructed) {
        status = 'FULLY_OCCLUDED';
      } else if (isLeftEyeUnobstructed && !isRightEyeUnobstructed) {
        status = 'VISIBLE_LEFT_EYE_ONLY';
      } else if (!isLeftEyeUnobstructed && isRightEyeUnobstructed) {
        status = 'VISIBLE_RIGHT_EYE_ONLY';
      } else {
        status = 'VISIBLE_BINOCULAR';
      }
    }

    const rawStr = `${queryId}:${input.documentId || 'DOC'}:${input.revision || 1}:${profileId}:${status}:${occlusionPercentage}`;
    const provenanceHash = this.hashString(rawStr);

    return {
      queryId,
      documentId: input.documentId || 'DOC_VISION_001',
      revision: input.revision || 1,
      dhmProfileId: profileId,
      status,
      isLeftEyeUnobstructed,
      isRightEyeUnobstructed,
      isInsideVisualField: true,
      isInsideFovealCone,
      leftEyeRayDistanceMm: Number(leftDist.toFixed(3)),
      rightEyeRayDistanceMm: Number(rightDist.toFixed(3)),
      firstHitObstacle,
      occlusionPercentage,
      limitations: [...HumanVisualModel.VISUAL_MODEL_PROVENANCE],
      provenanceHash,
      createdAtIso: timestampIso
    };
  }

  /**
   * Helper to raycast from origin to target against a set of 3D triangles
   */
  private static raycastTriangles(
    origin: Vector3D,
    target: Vector3D,
    triangles: Vector3D[][],
    obstacleId: string
  ): FirstHitObstacle | null {
    const rayDist = ExactNarrowPhaseMath.distance(origin, target);
    if (rayDist < 1e-6) return null;

    let closestHitDist = Infinity;
    let closestHitPoint: Vector3D | null = null;

    for (const tri of triangles) {
      const triangle: Triangle3DExact = {
        v0: (tri as any).v0 || (tri as any).a || (Array.isArray(tri) ? tri[0] : undefined),
        v1: (tri as any).v1 || (tri as any).b || (Array.isArray(tri) ? tri[1] : undefined),
        v2: (tri as any).v2 || (tri as any).c || (Array.isArray(tri) ? tri[2] : undefined)
      };

      const res = ExactNarrowPhaseMath.closestPointSegmentToTriangle(origin, target, triangle);

      // If segment penetrates triangle or passes extremely close (< 1.0mm) before reaching target
      if (res.isInterpenetrating || res.distance < 1.0) {
        const hitDist = ExactNarrowPhaseMath.distance(origin, res.closestPointTriangle);
        // Only consider hit if it occurs BEFORE reaching the target point (margin 2mm)
        if (hitDist > 1.0 && hitDist < rayDist - 2.0) {
          if (hitDist < closestHitDist) {
            closestHitDist = hitDist;
            closestHitPoint = res.closestPointTriangle;
          }
        }
      }
    }

    if (closestHitPoint && isFinite(closestHitDist)) {
      return {
        obstacleId,
        intersectionPointWCS: {
          x: Number(closestHitPoint.x.toFixed(3)),
          y: Number(closestHitPoint.y.toFixed(3)),
          z: Number(closestHitPoint.z.toFixed(3))
        },
        distanceMm: Number(closestHitDist.toFixed(3))
      };
    }

    return null;
  }

  private static createFailResult(
    queryId: string,
    timestampIso: string,
    input: LineOfSightQueryInput,
    status: HumanVisionStatus,
    reason: string
  ): LineOfSightQueryResult {
    return {
      queryId,
      documentId: input?.documentId || 'UNKNOWN',
      revision: input?.revision || 1,
      dhmProfileId: input?.dhmProfileId || 'UNKNOWN',
      status,
      isLeftEyeUnobstructed: false,
      isRightEyeUnobstructed: false,
      isInsideVisualField: false,
      isInsideFovealCone: false,
      leftEyeRayDistanceMm: 0,
      rightEyeRayDistanceMm: 0,
      occlusionPercentage: 100.0,
      limitations: [...HumanVisualModel.VISUAL_MODEL_PROVENANCE, reason],
      provenanceHash: this.hashString(`${queryId}:${reason}`),
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
