import { MachineKinematicModel, TrueKinematicVerdict } from "./types";

export enum SingularityVerdict {
  NO_SINGULARITY = "NO_SINGULARITY",
  NEAR_SINGULARITY = "NEAR_SINGULARITY",
  SINGULAR = "SINGULAR",
  UNDETERMINED = "UNDETERMINED"
}

export class KinematicSingularityDetector {
  /**
   * Evaluates the machine state for potential singularities (gimbal lock, collinear axes, etc.).
   */
  public static detectSingularity(
    machine: MachineKinematicModel,
    axisPositions: Record<string, number>,
    nearThresholdDeg: number = 2.0
  ): SingularityVerdict {
    const type = machine.machineType;

    if (type !== "MILL_5_AXIS") {
      return SingularityVerdict.NO_SINGULARITY;
    }

    // For 5-axis machines, a singularity occurs when the tilt axis (A or B) is collinear with the Z spindle
    // which usually happens when the tilt axis angle is at or near 0 degrees (since C becomes redundant)
    const tiltAxisId = "A" in axisPositions ? "A" : ("B" in axisPositions ? "B" : null);
    if (!tiltAxisId) {
      return SingularityVerdict.UNDETERMINED;
    }

    const angle = Math.abs(axisPositions[tiltAxisId] || 0);

    if (angle === 0) {
      return SingularityVerdict.SINGULAR;
    }

    if (angle < nearThresholdDeg) {
      return SingularityVerdict.NEAR_SINGULARITY;
    }

    return SingularityVerdict.NO_SINGULARITY;
  }
}
