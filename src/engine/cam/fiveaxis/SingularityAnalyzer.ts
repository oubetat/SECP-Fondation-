/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Singularity Detection & Avoidance Engine
 * Analyzes kinematic poles, Jacobian conditioning, velocity amplification,
 * and performs precision tilt perturbation to avoid gimbal locks.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisMachineDefinition, 
  KinematicDiagnostic, 
  ToolOrientationVector 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';

export interface SingularityAnalysisResult {
  isSingular: boolean;
  isHighRisk: boolean;
  singularityDistanceDeg: number;
  poleAxis: Vector3D;
  velocityAmplificationFactor: number;
  conditionNumber: number;
  perturbedOrientation?: ToolOrientationVector;
  avoidanceApplied: boolean;
  diagnostics: KinematicDiagnostic[];
}

export class SingularityAnalyzer {
  /**
   * Evaluates singularity proximity and velocity amplification for a given tool vector
   */
  public static analyze(
    machine: FiveAxisMachineDefinition,
    toolVector: Vector3D,
    prevToolVector?: Vector3D,
    autoAvoid: boolean = false
  ): SingularityAnalysisResult {
    const normT = FiveAxisMathUtils.normalize(toolVector);
    const coneAngle = machine.singularityConeAngleDeg || 1.5;
    const diagnostics: KinematicDiagnostic[] = [];

    // Singular pole vector depends on topology
    let poleAxis: Vector3D = { x: 0, y: 0, z: 1 };
    if (machine.topology === 'TABLE_TABLE_AC' || machine.topology === 'HEAD_HEAD_AC' || machine.topology === 'HEAD_TABLE_AC') {
      poleAxis = { x: 0, y: 0, z: 1 }; // Collinear with Z axis
    } else if (machine.topology === 'TABLE_TABLE_BC' || machine.topology === 'HEAD_TABLE_BC' || machine.topology === 'HEAD_HEAD_BC') {
      poleAxis = { x: 0, y: 0, z: 1 };
    } else if (machine.topology === 'HEAD_HEAD_AB') {
      poleAxis = { x: 0, y: 0, z: 1 };
    }

    const dotPole = Math.abs(FiveAxisMathUtils.dot(normT, poleAxis));
    const clampedDot = Math.max(-1.0, Math.min(1.0, dotPole));
    const angleToPoleRad = Math.acos(clampedDot);
    const singularityDistanceDeg = angleToPoleRad * FiveAxisMathUtils.RAD2DEG;

    const isSingular = singularityDistanceDeg < 0.05;
    const isHighRisk = singularityDistanceDeg < coneAngle;

    // Velocity Amplification Factor: d(theta_C) / d(theta_tilt) ~ 1 / sin(tilt)
    const sinTilt = Math.max(1e-4, Math.sin(angleToPoleRad));
    const velocityAmplificationFactor = Number((1.0 / sinTilt).toFixed(2));
    const conditionNumber = velocityAmplificationFactor;

    let perturbedOrientation: ToolOrientationVector | undefined;
    let avoidanceApplied = false;

    if (isSingular) {
      diagnostics.push({
        code: 'KINEMATIC_SINGULARITY',
        severity: 'ERROR',
        message: `Kinematic singularity encountered: tool vector is aligned with rotary pole (distance: ${singularityDistanceDeg.toFixed(4)}° < 0.05°)`,
        numericalDetails: { singularityDistanceDeg, velocityAmplificationFactor }
      });
    } else if (isHighRisk) {
      diagnostics.push({
        code: 'SINGULARITY_RISK_HIGH',
        severity: 'WARNING',
        message: `Tool vector is inside machine singularity cone (${singularityDistanceDeg.toFixed(3)}° < ${coneAngle}°). High C-axis velocity expected.`,
        numericalDetails: { singularityDistanceDeg, velocityAmplificationFactor }
      });
    }

    // Auto-avoidance: If in high-risk or singular cone and requested, introduce micro-tilt
    if ((isSingular || (isHighRisk && autoAvoid)) && autoAvoid) {
      // Find an orthogonal vector to tilt safely by (coneAngle + 0.1°)
      const safeTiltRad = (coneAngle + 0.1) * FiveAxisMathUtils.DEG2RAD;
      const refVec = Math.abs(normT.x) > 0.5 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const tiltDirection = FiveAxisMathUtils.normalize(FiveAxisMathUtils.cross(normT, refVec));
      
      const avoidedVec = FiveAxisMathUtils.rotateVectorAxis(normT, tiltDirection, safeTiltRad);
      perturbedOrientation = FiveAxisMathUtils.toOrientationVector(avoidedVec);
      avoidanceApplied = true;

      diagnostics.push({
        code: 'SINGULARITY_RISK_HIGH',
        severity: 'INFO',
        message: `Singularity avoidance applied: tool vector micro-perturbed by ${(safeTiltRad * FiveAxisMathUtils.RAD2DEG).toFixed(2)}° to eliminate gimbal lock.`,
        numericalDetails: { originalDistanceDeg: singularityDistanceDeg, newDistanceDeg: (coneAngle + 0.1) }
      });
    }

    return {
      isSingular,
      isHighRisk,
      singularityDistanceDeg,
      poleAxis,
      velocityAmplificationFactor,
      conditionNumber,
      perturbedOrientation,
      avoidanceApplied,
      diagnostics
    };
  }
}
