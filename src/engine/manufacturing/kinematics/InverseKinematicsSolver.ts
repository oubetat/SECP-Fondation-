import { HomogeneousTransform, MachineKinematicModel, IKSolution, IKSolutionStatus } from "./types";
import { KinematicMath } from "./KinematicMath";

export class InverseKinematicsSolver {
  /**
   * Solves the inverse kinematics for a target tool pose relative to the workpiece.
   */
  public static solve(
    machine: MachineKinematicModel,
    targetPose: HomogeneousTransform
  ): IKSolution[] {
    const solutions: IKSolution[] = [];
    const type = machine.machineType;
    const m = targetPose.matrix;

    // Extract target position
    const px = m[0][3];
    const py = m[1][3];
    const pz = m[2][3];

    // Helper to extract limits
    const getAxisLimits = (axisId: string) => {
      const axis = machine.axes.find(a => a.axisId === axisId);
      return axis ? axis.travelLimits : { min: -99999, max: 99999 };
    }

    const validateLimits = (vals: Record<string, number>): IKSolutionStatus => {
      for (const [axisId, val] of Object.entries(vals)) {
        const limits = getAxisLimits(axisId);
        if (val < limits.min || val > limits.max) {
          return IKSolutionStatus.LIMIT_VIOLATION;
        }
      }
      return IKSolutionStatus.VALID;
    };

    switch (type) {
      case "MILL_3_AXIS": {
        // Analytical solution is simple: X, Y, Z correspond to target positions directly
        const axisValues = { X: px, Y: py, Z: pz };
        const status = validateLimits(axisValues);

        solutions.push({
          solutionId: "SOLUTION_1",
          axisValues,
          status,
          errorDistance: 0.0
        });
        break;
      }

      case "MILL_4_AXIS": {
        // 3 linear axes + 1 rotary axis. Let's assume A-axis (rotates around X axis)
        const rotaryAxisId = machine.axes.find(a => a.axisType.startsWith("ROTARY_"))?.axisId || "A";
        
        // Two analytical solution paths: theta and theta + pi (or negative equivalent)
        const cosTheta = m[1][1]; // simplified rotation check
        const sinTheta = m[2][1];
        let theta1Deg = (Math.atan2(sinTheta, cosTheta) * 180) / Math.PI;
        let theta2Deg = theta1Deg > 0 ? theta1Deg - 180 : theta1Deg + 180;

        // Solution 1
        const axisValues1 = { X: px, Y: py, Z: pz, [rotaryAxisId]: theta1Deg };
        const status1 = validateLimits(axisValues1);
        solutions.push({
          solutionId: "SOLUTION_1",
          axisValues: axisValues1,
          status: status1,
          errorDistance: 0.0
        });

        // Solution 2
        const axisValues2 = { X: px, Y: py, Z: pz, [rotaryAxisId]: theta2Deg };
        const status2 = validateLimits(axisValues2);
        solutions.push({
          solutionId: "SOLUTION_2",
          axisValues: axisValues2,
          status: status2,
          errorDistance: 0.0
        });
        break;
      }

      case "MILL_5_AXIS": {
        // 5-axis: 3 linear + 2 rotary. Typically A/B (tilt) and C (table rotation).
        // Let's solve tilt angle (A or B) and table angle (C).
        // Since there is a tilt positive and tilt negative solution (two posture branches)
        const tiltAxisId = machine.axes.find(a => a.axisId === "A" || a.axisId === "B")?.axisId || "A";
        const rotC = "C";

        // Calculate analytical tilt angle from rotation block
        // R_33 = cos(tilt)
        const r33 = Math.max(-1.0, Math.min(1.0, m[2][2]));
        const tilt1Rad = Math.acos(r33);
        const tilt2Rad = -tilt1Rad;

        const tilt1Deg = (tilt1Rad * 180) / Math.PI;
        const tilt2Deg = (tilt2Rad * 180) / Math.PI;

        // Calculate table rotation angle C
        const r13 = m[0][2];
        const r23 = m[1][2];
        let c1Deg = (Math.atan2(r13, -r23) * 180) / Math.PI;
        let c2Deg = c1Deg > 0 ? c1Deg - 180 : c1Deg + 180;

        // Check if tilt angle is near zero (singular configuration!)
        const isSingular = Math.abs(tilt1Rad) < 1e-3;

        // Solution 1: Positive posture
        const axisValues1 = {
          X: px,
          Y: py,
          Z: pz,
          [tiltAxisId]: tilt1Deg,
          [rotC]: c1Deg
        };
        let status1 = validateLimits(axisValues1);
        if (status1 === IKSolutionStatus.VALID && isSingular) {
          status1 = IKSolutionStatus.SINGULAR;
        }

        solutions.push({
          solutionId: "SOLUTION_1",
          axisValues: axisValues1,
          status: status1,
          errorDistance: 0.0
        });

        // Solution 2: Negative posture
        const axisValues2 = {
          X: px,
          Y: py,
          Z: pz,
          [tiltAxisId]: tilt2Deg,
          [rotC]: c2Deg
        };
        let status2 = validateLimits(axisValues2);
        if (status2 === IKSolutionStatus.VALID && isSingular) {
          status2 = IKSolutionStatus.SINGULAR;
        }

        solutions.push({
          solutionId: "SOLUTION_2",
          axisValues: axisValues2,
          status: status2,
          errorDistance: 0.0
        });
        break;
      }

      default: {
        // Simple fallback
        const axisValues = { X: px, Z: pz };
        const status = validateLimits(axisValues);
        solutions.push({
          solutionId: "SOLUTION_1",
          axisValues,
          status,
          errorDistance: 0.0
        });
        break;
      }
    }

    return solutions;
  }
}
