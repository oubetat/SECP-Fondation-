/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Kinematic Validator & Closed-Loop Verification Gate
 * Verifies Position & Orientation Residuals, Axis Travel Envelope, Dynamic Velocities,
 * and Singularity Margins across entire 5-axis toolpaths.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisMachineDefinition, 
  FiveAxisTrajectoryPoint, 
  KinematicDiagnostic, 
  MachineIndependent5AxisPath 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';

export interface TrajectoryValidationSummary {
  isValid: boolean;
  totalPoints: number;
  maxPositionResidualMm: number;
  meanPositionResidualMm: number;
  maxOrientationResidualRad: number;
  linearTravelViolationsCount: number;
  rotaryTravelViolationsCount: number;
  singularityCount: number;
  rotaryUnwindsCount: number;
  maxVelocityX: number;
  maxVelocityY: number;
  maxVelocityZ: number;
  maxVelocityRotaryPrimary: number;
  maxVelocityRotarySecondary: number;
  diagnostics: KinematicDiagnostic[];
}

export class KinematicValidator {
  public static readonly MAX_ALLOWED_POS_RESIDUAL_MM = 1e-4; // 0.0001 mm
  public static readonly MAX_ALLOWED_ORIENT_RESIDUAL_RAD = 1e-4;

  /**
   * Validates a complete 5-axis trajectory against the target machine kinematics
   */
  public static validatePath(
    machine: FiveAxisMachineDefinition,
    path: MachineIndependent5AxisPath,
    toolLengthMm: number = 0
  ): TrajectoryValidationSummary {
    const diagnostics: KinematicDiagnostic[] = [];
    let maxPosResidual = 0;
    let sumPosResidual = 0;
    let maxOrientResidual = 0;
    let linearViolations = 0;
    let rotaryViolations = 0;
    let singularityCount = 0;
    let rotaryUnwindsCount = 0;

    let maxVx = 0, maxVy = 0, maxVz = 0;
    let maxVrot1 = 0, maxVrot2 = 0;

    for (let i = 0; i < path.points.length; i++) {
      const pt = path.points[i];

      // 1. Closed-Loop FK Verification
      const fk = ForwardKinematicsSolver.solveFK(machine, pt.machineAxes, toolLengthMm);
      const posResidual = FiveAxisMathUtils.distance(pt.targetTCP, fk.tcpWCS);
      const normTarget = FiveAxisMathUtils.normalize(pt.targetOrientation);
      const dotOrient = Math.max(-1.0, Math.min(1.0, FiveAxisMathUtils.dot(normTarget, fk.toolOrientation)));
      const orientResidual = Math.acos(dotOrient);

      if (posResidual > maxPosResidual) maxPosResidual = posResidual;
      sumPosResidual += posResidual;
      if (orientResidual > maxOrientResidual) maxOrientResidual = orientResidual;

      if (posResidual > this.MAX_ALLOWED_POS_RESIDUAL_MM) {
        diagnostics.push({
          code: 'KINEMATIC_RESIDUAL_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Position residual ${posResidual.toExponential(3)} mm exceeds maximum tolerance ${this.MAX_ALLOWED_POS_RESIDUAL_MM} mm.`,
          axesState: pt.machineAxes
        });
      }

      if (orientResidual > this.MAX_ALLOWED_ORIENT_RESIDUAL_RAD) {
        diagnostics.push({
          code: 'ORIENTATION_RESIDUAL_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Orientation residual ${orientResidual.toExponential(3)} rad exceeds maximum tolerance ${this.MAX_ALLOWED_ORIENT_RESIDUAL_RAD} rad.`,
          axesState: pt.machineAxes
        });
      }

      // 2. Machine Travel Limits
      const { X, Y, Z, A, B, C } = pt.machineAxes;
      if (X < machine.linearLimits.X.min || X > machine.linearLimits.X.max) {
        linearViolations++;
        diagnostics.push({
          code: 'LINEAR_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: X axis [${X.toFixed(2)} mm] out of range [${machine.linearLimits.X.min}, ${machine.linearLimits.X.max}]`,
          axesState: pt.machineAxes
        });
      }
      if (Y < machine.linearLimits.Y.min || Y > machine.linearLimits.Y.max) {
        linearViolations++;
        diagnostics.push({
          code: 'LINEAR_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Y axis [${Y.toFixed(2)} mm] out of range [${machine.linearLimits.Y.min}, ${machine.linearLimits.Y.max}]`,
          axesState: pt.machineAxes
        });
      }
      if (Z < machine.linearLimits.Z.min || Z > machine.linearLimits.Z.max) {
        linearViolations++;
        diagnostics.push({
          code: 'LINEAR_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Z axis [${Z.toFixed(2)} mm] out of range [${machine.linearLimits.Z.min}, ${machine.linearLimits.Z.max}]`,
          axesState: pt.machineAxes
        });
      }

      // 3. Rotary Limits Check
      const primAxis = machine.rotaryLimits.primary.axis;
      const primVal = primAxis === 'A' ? A : (primAxis === 'B' ? B : C);
      const primLim = machine.rotaryLimits.primary.limits;
      if (!machine.rotaryLimits.primary.isContinuous && (primVal < primLim.min || primVal > primLim.max)) {
        rotaryViolations++;
        diagnostics.push({
          code: 'ROTARY_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Primary rotary axis ${primAxis} [${primVal.toFixed(2)}°] out of range [${primLim.min}, ${primLim.max}]`,
          axesState: pt.machineAxes
        });
      }

      const secAxis = machine.rotaryLimits.secondary.axis;
      const secVal = secAxis === 'C' ? C : (secAxis === 'B' ? B : A);
      const secLim = machine.rotaryLimits.secondary.limits;
      if (!machine.rotaryLimits.secondary.isContinuous && (secVal < secLim.min || secVal > secLim.max)) {
        rotaryViolations++;
        diagnostics.push({
          code: 'ROTARY_AXIS_LIMIT_EXCEEDED',
          severity: 'ERROR',
          pointIndex: i,
          message: `Point ${i}: Secondary rotary axis ${secAxis} [${secVal.toFixed(2)}°] out of range [${secLim.min}, ${secLim.max}]`,
          axesState: pt.machineAxes
        });
      }

      if (pt.ikResult?.selectedSolution?.isSingular) singularityCount++;
      if (pt.ikResult?.selectedSolution?.rotaryUnwound) rotaryUnwindsCount++;

      // 4. Dynamics & Velocities
      if (i > 0) {
        const prevPt = path.points[i - 1];
        const dt = Math.max(1e-3, (pt.estimatedTimeSec || 0.1) - (prevPt.estimatedTimeSec || 0));
        const vx = Math.abs(pt.machineAxes.X - prevPt.machineAxes.X) / dt * 60; // mm/min
        const vy = Math.abs(pt.machineAxes.Y - prevPt.machineAxes.Y) / dt * 60;
        const vz = Math.abs(pt.machineAxes.Z - prevPt.machineAxes.Z) / dt * 60;
        const vrot1 = Math.abs(primVal - (primAxis === 'A' ? prevPt.machineAxes.A : (primAxis === 'B' ? prevPt.machineAxes.B : prevPt.machineAxes.C))) / dt * 60; // deg/min
        const vrot2 = Math.abs(secVal - (secAxis === 'C' ? prevPt.machineAxes.C : (secAxis === 'B' ? prevPt.machineAxes.B : prevPt.machineAxes.A))) / dt * 60;

        if (vx > maxVx) maxVx = vx;
        if (vy > maxVy) maxVy = vy;
        if (vz > maxVz) maxVz = vz;
        if (vrot1 > maxVrot1) maxVrot1 = vrot1;
        if (vrot2 > maxVrot2) maxVrot2 = vrot2;

        if (vx > machine.linearLimits.X.maxVelocity || vy > machine.linearLimits.Y.maxVelocity || vz > machine.linearLimits.Z.maxVelocity) {
          diagnostics.push({
            code: 'AXIS_VELOCITY_LIMIT_EXCEEDED',
            severity: 'WARNING',
            pointIndex: i,
            message: `Point ${i}: Linear axis velocity exceeds rapid envelope.`,
            numericalDetails: { vx, vy, vz }
          });
        }
      }
    }

    const meanPosResidual = path.points.length > 0 ? sumPosResidual / path.points.length : 0;
    const isValid = linearViolations === 0 && rotaryViolations === 0 && maxPosResidual <= this.MAX_ALLOWED_POS_RESIDUAL_MM && maxOrientResidual <= this.MAX_ALLOWED_ORIENT_RESIDUAL_RAD;

    return {
      isValid,
      totalPoints: path.points.length,
      maxPositionResidualMm: Number(maxPosResidual.toFixed(7)),
      meanPositionResidualMm: Number(meanPosResidual.toFixed(7)),
      maxOrientationResidualRad: Number(maxOrientResidual.toFixed(7)),
      linearTravelViolationsCount: linearViolations,
      rotaryTravelViolationsCount: rotaryViolations,
      singularityCount,
      rotaryUnwindsCount,
      maxVelocityX: Number(maxVx.toFixed(1)),
      maxVelocityY: Number(maxVy.toFixed(1)),
      maxVelocityZ: Number(maxVz.toFixed(1)),
      maxVelocityRotaryPrimary: Number(maxVrot1.toFixed(1)),
      maxVelocityRotarySecondary: Number(maxVrot2.toFixed(1)),
      diagnostics
    };
  }
}
