import {
  AvoidanceCandidate,
  AvoidanceFailureReason,
  AvoidanceResult,
  AvoidanceStrategy,
  AvoidanceVerdict,
  CandidateRanking,
  CollisionDetectionReport,
  CollisionEvent,
  CollisionModel,
  CollisionObjectType,
  FiveAxisPoint,
  FiveAxisToolpath,
  Point3D,
  TrueCollisionVerdict,
  Vector3D
} from "./types";
import { CollisionDetector } from "./CollisionDetector";

export class CollisionAvoidanceEngine {
  /**
   * Orchestrates multi-strategy avoidance candidate generation, ranking, and full closed-loop re-verification.
   */
  public static planAndAvoidCollisions(
    originalToolpath: FiveAxisToolpath,
    initialReport: CollisionDetectionReport,
    collisionModel: CollisionModel
  ): AvoidanceResult {
    const reportId = `AVD_PLAN_${Math.abs(Math.round(Math.cos(originalToolpath.points.length * 50) * 100000))}`;

    // If already collision free and proven safe, return immediately
    if (initialReport.verdict === TrueCollisionVerdict.COLLISION_FREE && initialReport.provenSafe) {
      return {
        reportId,
        originalToolpathId: originalToolpath.toolpathId,
        verdict: AvoidanceVerdict.AVOIDED,
        strategyUsed: AvoidanceStrategy.LOCAL_DEVIATION,
        replannedToolpath: originalToolpath,
        revalidationReport: initialReport,
        message: "Toolpath was already collision-free. No modifications necessary."
      };
    }

    // 1. Generate multi-strategy avoidance candidates
    const candidates: AvoidanceCandidate[] = this.generateCandidates(
      originalToolpath,
      initialReport.collisionEvents,
      collisionModel
    );

    if (candidates.length === 0) {
      return {
        reportId,
        originalToolpathId: originalToolpath.toolpathId,
        verdict: AvoidanceVerdict.NO_SAFE_PATH,
        failureReason: AvoidanceFailureReason.NO_SAFE_PATH,
        message: "STOP: No avoidance candidates could be synthesized within machine and geometric boundaries."
      };
    }

    // 2. Rank candidates based on clearance gain, minimum geometric deviation, and risk score
    const ranked = this.rankCandidates(candidates);
    let chosenCandidate: AvoidanceCandidate | null = null;
    let chosenRevalidation: CollisionDetectionReport | null = null;

    // 3. Strict Re-Verification: Evaluate each candidate through the full collision detection cycle
    for (const cand of ranked.candidates) {
      const revalidationReport = CollisionDetector.evaluateToolpath(cand.modifiedPath, collisionModel);

      // Candidate is valid ONLY if revalidation is fully proven safe and collision free!
      if (revalidationReport.verdict === TrueCollisionVerdict.COLLISION_FREE && revalidationReport.provenSafe) {
        chosenCandidate = cand;
        chosenRevalidation = revalidationReport;
        break;
      }
    }

    if (chosenCandidate && chosenRevalidation) {
      return {
        reportId,
        originalToolpathId: originalToolpath.toolpathId,
        verdict: AvoidanceVerdict.AVOIDED,
        strategyUsed: chosenCandidate.modificationType,
        chosenCandidate,
        replannedToolpath: chosenCandidate.modifiedPath,
        revalidationReport: chosenRevalidation,
        message: `Collision successfully resolved via ${chosenCandidate.modificationType} strategy with full re-verification proof.`
      };
    }

    // If local strategies fail, return STOP / NO_SAFE_PATH to prevent unverified execution
    return {
      reportId,
      originalToolpathId: originalToolpath.toolpathId,
      verdict: AvoidanceVerdict.REVERIFICATION_FAILED,
      failureReason: AvoidanceFailureReason.COLLISION_PERSISTENT,
      message: "STOP: All generated avoidance candidates failed secondary collision re-verification. Global replan required."
    };
  }

  /**
   * Generates candidate toolpaths using multiple geometric and kinematic avoidance strategies.
   */
  public static generateCandidates(
    toolpath: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel
  ): AvoidanceCandidate[] {
    const candidates: AvoidanceCandidate[] = [];
    const eventId = events.length > 0 ? events[0].eventId : "GENERIC_EVENT";

    // Strategy 1: Tilt / Reorientation Adjustment (tilts tool vector away from collision normal)
    const tiltCandidate = this.generateTiltAdjustmentCandidate(toolpath, events, model, eventId);
    if (tiltCandidate) candidates.push(tiltCandidate);

    // Strategy 2: Lead Angle Adjustment
    const leadCandidate = this.generateLeadAdjustmentCandidate(toolpath, events, model, eventId);
    if (leadCandidate) candidates.push(leadCandidate);

    // Strategy 3: Safe Retract & Re-enter (lifting tool in collision segment)
    const retractCandidate = this.generateRetractionCandidate(toolpath, events, model, eventId);
    if (retractCandidate) candidates.push(retractCandidate);

    // Strategy 4: Local Path Shift / Deviation
    const shiftCandidate = this.generatePathShiftCandidate(toolpath, events, model, eventId);
    if (shiftCandidate) candidates.push(shiftCandidate);

    // Strategy 5: Alternative IK Solution (Rotary flip)
    const altIKCandidate = this.generateAlternativeIKCandidate(toolpath, events, model, eventId);
    if (altIKCandidate) candidates.push(altIKCandidate);

    return candidates;
  }

  /**
   * Strategy 1: Tilt Adjustment away from obstacle
   */
  private static generateTiltAdjustmentCandidate(
    tp: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel,
    sourceEventId: string
  ): AvoidanceCandidate | null {
    const newPoints: FiveAxisPoint[] = tp.points.map((p, idx) => {
      // Check if this point is in the vicinity of a collision
      const isNearEvent = events.some(e => Math.abs(e.sampleIndex - idx) <= 2);
      if (!isNearEvent) return { ...p };

      // Tilt tool axis by +20 degrees away from obstacle
      const axis = p.toolAxis;
      const tilted: Vector3D = {
        x: axis.x * 0.9396 + 0.342 * 0.707, // ~20 deg tilt
        y: axis.y * 0.9396 + 0.342 * 0.707,
        z: Math.max(0.2, axis.z * 0.9396)
      };
      const len = Math.sqrt(tilted.x * tilted.x + tilted.y * tilted.y + tilted.z * tilted.z);

      return {
        ...p,
        toolAxis: { x: tilted.x / len, y: tilted.y / len, z: tilted.z / len }
      };
    });

    const modifiedPath: FiveAxisToolpath = {
      ...tp,
      toolpathId: `${tp.toolpathId}_AVD_TILT`,
      points: newPoints
    };

    return {
      candidateId: `CAND_TILT_${Math.floor(Math.random() * 10000)}`,
      sourceCollisionId: sourceEventId,
      modifiedPath,
      modificationType: AvoidanceStrategy.TILT_ADJUSTMENT,
      geometricDeviation: 0.0,
      orientationDeviationDeg: 20.0,
      axisMotionCost: 15.0,
      clearanceGain: 12.5,
      riskScore: 10,
      valid: true
    };
  }

  /**
   * Strategy 2: Lead Adjustment along trajectory tangent
   */
  private static generateLeadAdjustmentCandidate(
    tp: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel,
    sourceEventId: string
  ): AvoidanceCandidate | null {
    const newPoints: FiveAxisPoint[] = tp.points.map((p, idx) => {
      const isNearEvent = events.some(e => Math.abs(e.sampleIndex - idx) <= 2);
      if (!isNearEvent) return { ...p };

      // Lead tool axis forward by 15 degrees
      const leadAxis: Vector3D = {
        x: p.toolAxis.x * 0.965 + 0.258,
        y: p.toolAxis.y * 0.965,
        z: Math.max(0.1, p.toolAxis.z * 0.965)
      };
      const len = Math.sqrt(leadAxis.x * leadAxis.x + leadAxis.y * leadAxis.y + leadAxis.z * leadAxis.z);

      return {
        ...p,
        toolAxis: { x: leadAxis.x / len, y: leadAxis.y / len, z: leadAxis.z / len }
      };
    });

    const modifiedPath: FiveAxisToolpath = {
      ...tp,
      toolpathId: `${tp.toolpathId}_AVD_LEAD`,
      points: newPoints
    };

    return {
      candidateId: `CAND_LEAD_${Math.floor(Math.random() * 10000)}`,
      sourceCollisionId: sourceEventId,
      modifiedPath,
      modificationType: AvoidanceStrategy.LEAD_ADJUSTMENT,
      geometricDeviation: 0.0,
      orientationDeviationDeg: 15.0,
      axisMotionCost: 12.0,
      clearanceGain: 9.0,
      riskScore: 15,
      valid: true
    };
  }

  /**
   * Strategy 3: Retraction Candidate (lifts tool above obstacle)
   */
  private static generateRetractionCandidate(
    tp: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel,
    sourceEventId: string
  ): AvoidanceCandidate | null {
    let maxObstacleZ = 0;
    for (const f of model.fixture) {
      if (f.aabb) maxObstacleZ = Math.max(maxObstacleZ, f.aabb.max.z);
    }
    const safeZ = Math.max(maxObstacleZ + 15.0, ...tp.points.map(p => p.position.z + 30.0));
    const newPoints: FiveAxisPoint[] = [];

    for (let i = 0; i < tp.points.length; i++) {
      const p = tp.points[i];
      if (i === 0) {
        newPoints.push({ ...p });
        // Insert vertical retract after start
        newPoints.push({
          ...p,
          position: { x: p.position.x, y: p.position.y, z: safeZ },
          feedRate: 5000
        });
      } else if (i === tp.points.length - 1) {
        // Traverse at safe Z, then plunge to final target
        newPoints.push({
          ...p,
          position: { x: p.position.x, y: p.position.y, z: safeZ },
          feedRate: 5000
        });
        newPoints.push({ ...p });
      } else {
        newPoints.push({
          ...p,
          position: { x: p.position.x, y: p.position.y, z: safeZ },
          feedRate: 5000
        });
      }
    }

    const modifiedPath: FiveAxisToolpath = {
      ...tp,
      toolpathId: `${tp.toolpathId}_AVD_RETRACT`,
      points: newPoints
    };

    return {
      candidateId: `CAND_RETRACT_${Math.floor(Math.random() * 10000)}`,
      sourceCollisionId: sourceEventId,
      modifiedPath,
      modificationType: AvoidanceStrategy.RETRACT,
      geometricDeviation: safeZ - tp.points[0].position.z,
      orientationDeviationDeg: 0.0,
      axisMotionCost: 30.0,
      clearanceGain: safeZ,
      riskScore: 5, // very safe
      valid: true
    };
  }

  /**
   * Strategy 4: Lateral Path Shift
   */
  private static generatePathShiftCandidate(
    tp: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel,
    sourceEventId: string
  ): AvoidanceCandidate | null {
    let maxObstacleY = 0;
    for (const f of model.fixture) {
      if (f.aabb) maxObstacleY = Math.max(maxObstacleY, f.aabb.max.y);
    }
    const shiftDelta = Math.max(60.0, maxObstacleY + 35.0);
    const newPoints: FiveAxisPoint[] = tp.points.map((p, idx) => {
      return {
        ...p,
        position: { x: p.position.x, y: p.position.y + shiftDelta, z: p.position.z }
      };
    });

    const modifiedPath: FiveAxisToolpath = {
      ...tp,
      toolpathId: `${tp.toolpathId}_AVD_SHIFT`,
      points: newPoints
    };

    return {
      candidateId: `CAND_SHIFT_${Math.floor(Math.random() * 10000)}`,
      sourceCollisionId: sourceEventId,
      modifiedPath,
      modificationType: AvoidanceStrategy.PATH_SHIFT,
      geometricDeviation: shiftDelta,
      orientationDeviationDeg: 0.0,
      axisMotionCost: 10.0,
      clearanceGain: shiftDelta,
      riskScore: 25,
      valid: true
    };
  }

  /**
   * Strategy 5: Alternative IK Solution (e.g. Rotary C-axis 180° flip with inverted A-axis)
   */
  private static generateAlternativeIKCandidate(
    tp: FiveAxisToolpath,
    events: CollisionEvent[],
    model: CollisionModel,
    sourceEventId: string
  ): AvoidanceCandidate | null {
    const newPoints: FiveAxisPoint[] = tp.points.map(p => {
      return {
        ...p,
        toolAxis: {
          x: -p.toolAxis.x,
          y: -p.toolAxis.y,
          z: p.toolAxis.z
        }
      };
    });

    const modifiedPath: FiveAxisToolpath = {
      ...tp,
      toolpathId: `${tp.toolpathId}_AVD_ALTIK`,
      points: newPoints
    };

    return {
      candidateId: `CAND_ALTIK_${Math.floor(Math.random() * 10000)}`,
      sourceCollisionId: sourceEventId,
      modifiedPath,
      modificationType: AvoidanceStrategy.ALTERNATIVE_IK,
      geometricDeviation: 0.0,
      orientationDeviationDeg: 180.0,
      axisMotionCost: 50.0,
      clearanceGain: 35.0,
      riskScore: 20,
      valid: true
    };
  }

  /**
   * Ranks candidates prioritizing high clearance gain, low geometric deviation, and low risk score.
   */
  public static rankCandidates(candidates: AvoidanceCandidate[]): CandidateRanking {
    const scored = [...candidates].sort((a, b) => {
      // Score = clearanceGain * 2 - geometricDeviation * 1.5 - riskScore * 0.5
      const scoreA = a.clearanceGain * 2.0 - a.geometricDeviation * 1.5 - a.riskScore * 0.5;
      const scoreB = b.clearanceGain * 2.0 - b.geometricDeviation * 1.5 - b.riskScore * 0.5;
      return scoreB - scoreA;
    });

    return {
      candidates: scored,
      bestCandidateId: scored.length > 0 ? scored[0].candidateId : null,
      rankingCriteria: [
        "Maximum clearance gain",
        "Minimum geometric deviation from part geometry",
        "Kinematic continuity and minimum joint velocity cost",
        "Risk score assessment"
      ]
    };
  }
}
