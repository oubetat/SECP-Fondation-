import { MachineKinematicModel, ReachabilityStatus, Vector3D } from "./types";
import { InverseKinematicsSolver } from "./InverseKinematicsSolver";
import { KinematicMath } from "./KinematicMath";

export class KinematicReachabilityAnalyzer {
  /**
   * Evaluates if a given target point is reachable within the machine's workspace.
   */
  public static analyzePoint(machine: MachineKinematicModel, point: Vector3D): ReachabilityStatus {
    const lim = machine.limits.workEnvelope;
    
    // Check if target is inside linear work envelope boundaries
    if (
      point.x < lim.xMin || point.x > lim.xMax ||
      point.y < lim.yMin || point.y > lim.yMax ||
      point.z < lim.zMin || point.z > lim.zMax
    ) {
      return ReachabilityStatus.UNREACHABLE;
    }

    // Now verify through inverse kinematics
    const targetPose = KinematicMath.createTranslation(point.x, point.y, point.z);
    const solutions = InverseKinematicsSolver.solve(machine, targetPose);

    const hasValid = solutions.some(sol => sol.status === "VALID" || sol.status === "SINGULAR");
    if (hasValid) {
      return ReachabilityStatus.REACHABLE;
    }

    const hasLimitViolation = solutions.some(sol => sol.status === "LIMIT_VIOLATION");
    if (hasLimitViolation) {
      return ReachabilityStatus.CONDITIONALLY_REACHABLE;
    }

    return ReachabilityStatus.UNREACHABLE;
  }

  /**
   * Generates a bounding box for the workspace from axis travel limits.
   */
  public static deriveWorkEnvelope(machine: MachineKinematicModel): {
    xRange: { min: number; max: number };
    yRange: { min: number; max: number };
    zRange: { min: number; max: number };
  } {
    const xLimits = machine.axes.find(a => a.axisId === "X")?.travelLimits || { min: 0, max: 0 };
    const yLimits = machine.axes.find(a => a.axisId === "Y")?.travelLimits || { min: 0, max: 0 };
    const zLimits = machine.axes.find(a => a.axisId === "Z")?.travelLimits || { min: 0, max: 0 };

    return {
      xRange: { min: xLimits.min, max: xLimits.max },
      yRange: { min: yLimits.min, max: yLimits.max },
      zRange: { min: zLimits.min, max: zLimits.max }
    };
  }
}
