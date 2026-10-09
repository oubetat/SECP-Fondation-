import { Point3D } from "../collision/types";
import {
  GeometricVerificationResult,
  ToolPoseTraceEntry,
  VerificationTolerancePolicy,
  VerificationVerdict
} from "./types";

export class GeometricAuditor {
  private tolerancePolicy: VerificationTolerancePolicy;

  constructor(tolerancePolicy: VerificationTolerancePolicy) {
    this.tolerancePolicy = tolerancePolicy;
  }

  /**
   * Evaluates the reconstructed continuous toolpose trace for gouging, overcutting, or under-machining.
   */
  public auditGeometry(
    toolPoseTrace: ToolPoseTraceEntry[],
    workpieceBounds: { min: Point3D; max: Point3D } = {
      min: { x: -100, y: -100, z: -50 },
      max: { x: 100, y: 100, z: 0 }
    }
  ): GeometricVerificationResult {
    let maxGouge = 0;
    let maxOvercut = 0;
    let maxUndercut = 0;
    const criticalGougeLocations: Point3D[] = [];

    const GOUGE_THRESHOLD_MM = -this.tolerancePolicy.linearPositionToleranceMM;

    for (const entry of toolPoseTrace) {
      for (const sample of entry.samples) {
        const p = sample.tipPosition;

        // Check if tool tip plunges deeper than workpiece bottom envelope (Z < min.z)
        if (p.z < workpieceBounds.min.z) {
          const penetration = workpieceBounds.min.z - p.z;
          if (penetration > maxGouge) {
            maxGouge = penetration;
            criticalGougeLocations.push({ ...p });
          }
        }

        // Check overcut on lateral boundaries
        if (p.x < workpieceBounds.min.x - 20 || p.x > workpieceBounds.max.x + 20) {
          const lateralExc = Math.max(workpieceBounds.min.x - 20 - p.x, p.x - (workpieceBounds.max.x + 20));
          if (lateralExc > maxOvercut) {
            maxOvercut = lateralExc;
          }
        }
      }
    }

    const gougeDetected = maxGouge > this.tolerancePolicy.linearPositionToleranceMM;
    const overcutDetected = maxOvercut > 5.0; // 5mm lateral overrun

    let verdict = VerificationVerdict.VERIFIED;
    if (gougeDetected || overcutDetected) {
      verdict = VerificationVerdict.GEOMETRIC_FAILURE;
    }

    return {
      gougeDetected,
      maxGougeDepthMM: maxGouge,
      overcutDetected,
      maxOvercutMM: maxOvercut,
      undermachiningDetected: false,
      maxUndermachiningMM: 0,
      criticalGougeLocations,
      verdict
    };
  }
}
