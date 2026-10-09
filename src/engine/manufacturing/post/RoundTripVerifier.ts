import {
  CollisionReverificationResult,
  KinematicReconstructionResult,
  MachineAxisPoint,
  MachineAxisToolpath,
  NCProgram,
  PostTrueVerdict,
  RoundTripVerificationResult
} from "./types";
import { NCInterpreterReconstructor } from "./NCInterpreterReconstructor";
import { CollisionDetector } from "../collision/CollisionDetector";
import {
  CollisionModel,
  CollisionObjectType,
  FiveAxisToolpath,
  GeometryRepType,
  TrueCollisionVerdict
} from "../collision/types";

export class RoundTripVerifier {
  public static verifyRoundTrip(
    original: MachineAxisToolpath,
    program: NCProgram,
    positionToleranceMM = 0.002,
    angularToleranceDeg = 0.005
  ): {
    roundTripResult: RoundTripVerificationResult;
    reconstructedTrajectory: MachineAxisToolpath;
    kinematicResult: KinematicReconstructionResult;
  } {
    const reconstructed = NCInterpreterReconstructor.reconstructTrajectoryFromProgram(program);

    let maxPosError = 0.0;
    let maxAngError = 0.0;
    const maxAxisError: Record<string, number> = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };

    const origPoints = original.points;

    // Filter reconstructed points to those originating from the source toolpath
    // by matching coordinates to the nearest source points in sequence
    let reconIdx = 0;
    let pCount = 0;

    for (let i = 0; i < origPoints.length; i++) {
      const p1 = origPoints[i];

      // Find the corresponding point in reconstructed points
      let bestDist = Number.POSITIVE_INFINITY;
      let bestMatch: MachineAxisPoint | null = null;
      let matchIdx = -1;

      for (let j = reconIdx; j < reconstructed.points.length; j++) {
        const p2 = reconstructed.points[j];
        const dx = Math.abs(p1.position.x - p2.position.x);
        const dy = Math.abs(p1.position.y - p2.position.y);
        const dz = Math.abs(p1.position.z - p2.position.z);
        const dist = Math.hypot(dx, dy, dz);

        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = p2;
          matchIdx = j;
          if (dist < 1e-4) break;
        }
      }

      if (bestMatch) {
        reconIdx = matchIdx + 1;
        const dx = Math.abs(p1.position.x - bestMatch.position.x);
        const dy = Math.abs(p1.position.y - bestMatch.position.y);
        const dz = Math.abs(p1.position.z - bestMatch.position.z);
        const dist = Math.hypot(dx, dy, dz);

        if (dist > maxPosError) maxPosError = dist;
        if (dx > maxAxisError.X) maxAxisError.X = dx;
        if (dy > maxAxisError.Y) maxAxisError.Y = dy;
        if (dz > maxAxisError.Z) maxAxisError.Z = dz;

        if (p1.rotaryAxes && bestMatch.rotaryAxes) {
          if (p1.rotaryAxes.a !== undefined && bestMatch.rotaryAxes.a !== undefined) {
            const da = Math.abs(p1.rotaryAxes.a - bestMatch.rotaryAxes.a);
            if (da > maxAngError) maxAngError = da;
            if (da > maxAxisError.A) maxAxisError.A = da;
          }
          if (p1.rotaryAxes.c !== undefined && bestMatch.rotaryAxes.c !== undefined) {
            const dc = Math.abs(p1.rotaryAxes.c - bestMatch.rotaryAxes.c);
            if (dc > maxAngError) maxAngError = dc;
            if (dc > maxAxisError.C) maxAxisError.C = dc;
          }
        }
        pCount++;
      }
    }

    const isIdentical = maxPosError <= positionToleranceMM && maxAngError <= angularToleranceDeg && pCount === origPoints.length;

    const roundTripResult: RoundTripVerificationResult = {
      isIdenticalWithinTolerance: isIdentical,
      positionToleranceMM,
      angularToleranceDeg,
      maxObservedPositionDeltaMM: maxPosError,
      maxObservedAngularDeltaDeg: maxAngError,
      pointsEvaluated: pCount,
      roundTripVerdict: isIdentical ? PostTrueVerdict.ROUND_TRIP_VALIDATED : PostTrueVerdict.ROUND_TRIP_FAILURE
    };

    const kinematicResult: KinematicReconstructionResult = {
      isValid: isIdentical,
      maxPositionErrorMM: maxPosError,
      maxOrientationErrorDeg: maxAngError,
      maxAxisError,
      reconstructedTrajectory: reconstructed,
      kinematicVerdict: isIdentical ? PostTrueVerdict.KINEMATICALLY_VALIDATED : PostTrueVerdict.KINEMATICALLY_INVALID
    };

    return { roundTripResult, reconstructedTrajectory: reconstructed, kinematicResult };
  }

  public static reverifyCollisions(
    reconstructedTrajectory: MachineAxisToolpath,
    customObstacles: any[] = []
  ): CollisionReverificationResult {
    // Convert reconstructed machine axis points to 5-axis toolpath points for collision verification
    const points = reconstructedTrajectory.points.map((pt, idx) => {
      const aRad = ((pt.rotaryAxes?.a || 0) * Math.PI) / 180.0;
      const cRad = ((pt.rotaryAxes?.c || 0) * Math.PI) / 180.0;
      const tz = Math.cos(aRad);
      const tx = Math.sin(aRad) * Math.sin(cRad);
      const ty = Math.sin(aRad) * Math.cos(cRad);

      return {
        position: pt.position,
        toolAxis: { x: tx, y: ty, z: tz },
        sequenceNumber: idx + 1,
        feedRate: pt.feedRate
      };
    });

    const fiveAxisPath: FiveAxisToolpath = {
      toolpathId: reconstructedTrajectory.toolpathId,
      points
    };

    const collisionModel: CollisionModel = {
      collisionModelId: `COL_MDL_${reconstructedTrajectory.toolpathId}`,
      revision: 1,
      machineGeometry: [],
      toolAssembly: [
        CollisionDetector.createDefaultToolObject(5.0, 40.0),
        CollisionDetector.createDefaultHolderObject(25.0, 60.0)
      ],
      stock: {
        objectId: "STOCK_BLOCK",
        name: "Raw Stock",
        type: CollisionObjectType.STOCK,
        geometryType: GeometryRepType.AABB,
        aabb: { min: { x: -150, y: -150, z: -80 }, max: { x: 150, y: 150, z: -5 } },
        isActive: true
      },
      workpiece: {
        objectId: "WORKPIECE_PART",
        name: "Target Finished Part",
        type: CollisionObjectType.WORKPIECE,
        geometryType: GeometryRepType.AABB,
        aabb: { min: { x: -120, y: -120, z: -70 }, max: { x: 120, y: 120, z: -10 } },
        isActive: true
      },
      fixture: customObstacles.length > 0
        ? customObstacles
        : [
            {
              objectId: "FIXTURE_BASE",
              name: "Machine Table Fixture Plate",
              type: CollisionObjectType.FIXTURE,
              geometryType: GeometryRepType.AABB,
              aabb: { min: { x: -300, y: -300, z: -120 }, max: { x: 300, y: 300, z: -80 } },
              isActive: true
            }
          ],
      checkSurfaces: [],
      keepOutVolumes: [],
      tolerance: {
        geometricTolerance: 0.005,
        collisionTolerance: 0.001,
        contactTolerance: 0.02,
        clearanceTolerance: 1.0,
        angularToleranceDeg: 0.1
      },
      samplingPolicy: {
        sampleCount: points.length * 4,
        minimumStep: 0.5,
        maximumStep: 5.0,
        adaptiveTriggers: ["ROTARY_MOTION", "PROXIMITY"],
        coverageMetric: 1.0,
        continuousMotionEnabled: true,
        minAngularStepDeg: 1.0
      }
    };

    const report = CollisionDetector.evaluateToolpath(fiveAxisPath, collisionModel);

    const verdict = (report.verdict === TrueCollisionVerdict.COLLISION_FREE || report.verdict === TrueCollisionVerdict.CONTACT_ONLY)
      ? PostTrueVerdict.COLLISION_FREE
      : PostTrueVerdict.COLLISION_DETECTED;

    return {
      verdict,
      collisionEventsCount: report.collisionEvents.length,
      minimumClearanceMM: report.minClearance,
      details: report.collisionEvents.map(e => `Collision event: ${e.contextMessage || e.classification}`)
    };
  }
}
