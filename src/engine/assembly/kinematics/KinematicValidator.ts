import { validateRotationMatrix } from '../constraints/AssemblyConstraint';
import { AssemblyConstraint } from '../constraints/AssemblyConstraintModel';
import { KinematicBody } from './KinematicBody';
import { KinematicJoint, JointCoordinateValue } from './KinematicJointModel';
import { KinematicJointEvaluator } from './KinematicJoint';
import { KinematicDiagnostics } from './KinematicDiagnostics';
import { KinematicConstraintBridge } from './KinematicConstraint';
import { KinematicSolveStatus } from './KinematicSolveResult';

export interface TransformValidationReport {
  valid: boolean;
  reason?: string;
  det?: number;
  orthogonalityError?: number;
}

export interface IndependentKinematicValidationReport {
  status: KinematicSolveStatus;
  valid: boolean;
  maximumJointResidual: number;
  maximumAssemblyConstraintResidual: number;
  jointResiduals: Array<{
    jointId: string;
    residual: number;
    tolerance: number;
    satisfied: boolean;
    reason?: string;
  }>;
  transformValidations: Record<string, TransformValidationReport>;
  limitViolations: Array<{
    jointId: string;
    violationType: string;
    requestedValue: any;
    reason?: string;
  }>;
  graphStatus: {
    valid: boolean;
    hasCycles: boolean;
    groundBodyId?: string;
    disconnectedBodies: string[];
    reason?: string;
  };
  diagnostics: string[];
}

export class KinematicValidator {
  /**
   * Validates a 4x4 rigid transformation matrix
   */
  public static validate4x4Transform(T: number[][], tolerance: number = 1e-4): TransformValidationReport {
    if (!T || T.length !== 4 || T.some(row => !row || row.length !== 4)) {
      return { valid: false, reason: 'Transform must be a 4x4 matrix' };
    }

    // Check numerical safety across all 16 elements
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const val = T[i][j];
        if (isNaN(val) || !isFinite(val)) {
          return { valid: false, reason: `Transform element [${i}][${j}] is NaN or Infinity` };
        }
      }
    }

    // Check bottom row [0, 0, 0, 1]
    if (
      Math.abs(T[3][0]) > tolerance ||
      Math.abs(T[3][1]) > tolerance ||
      Math.abs(T[3][2]) > tolerance ||
      Math.abs(T[3][3] - 1.0) > tolerance
    ) {
      return { valid: false, reason: 'Bottom row of affine transform is not [0, 0, 0, 1]' };
    }

    // Extract 3x3 rotation matrix
    const R = [
      [T[0][0], T[0][1], T[0][2]],
      [T[1][0], T[1][1], T[1][2]],
      [T[2][0], T[2][1], T[2][2]],
    ];

    const rotVal = validateRotationMatrix(R, tolerance);
    if (!rotVal.valid) {
      return { valid: false, reason: rotVal.reason };
    }

    return { valid: true };
  }

  /**
   * Independently validates all kinematic aspects of an assembly state
   */
  public static validateAssemblyKinematics(
    bodies: KinematicBody[],
    joints: KinematicJoint[],
    assemblyConstraints: AssemblyConstraint[] = [],
    coordinatesOverride?: Record<string, JointCoordinateValue>
  ): IndependentKinematicValidationReport {
    const diagnostics: string[] = [];
    const transformValidations: Record<string, TransformValidationReport> = {};
    const limitViolations: Array<{ jointId: string; violationType: string; requestedValue: any; reason?: string }> = [];
    const jointResiduals: Array<{ jointId: string; residual: number; tolerance: number; satisfied: boolean; reason?: string }> = [];

    // 1. Graph Analysis
    const graphAnalysis = KinematicDiagnostics.analyzeKinematicGraph(bodies, joints);
    if (!graphAnalysis.valid) {
      diagnostics.push(`Graph integrity failure: ${graphAnalysis.reason}`);
    }

    // 2. Validate all Body Transforms
    let allTransformsValid = true;
    const bodyMap = new Map<string, KinematicBody>();
    for (const b of bodies) {
      bodyMap.set(b.bodyId, b);
      const report = this.validate4x4Transform(b.worldTransform);
      transformValidations[b.bodyId] = report;
      if (!report.valid) {
        allTransformsValid = false;
        diagnostics.push(`Body ${b.bodyId} has invalid transform: ${report.reason}`);
      }
    }

    // 3. Validate Joint Limits & Joint Definitions
    let maxJointResidual = 0;
    let allJointsSatisfied = true;

    for (const j of joints) {
      if (!j.enabled || j.suppressed) continue;

      const defVal = KinematicJointEvaluator.validateJointDefinition(j);
      if (!defVal.valid) {
        diagnostics.push(`Joint ${j.jointId} definition invalid: ${defVal.reason}`);
      }

      const coord = coordinatesOverride && coordinatesOverride[j.jointId] !== undefined
        ? coordinatesOverride[j.jointId]
        : j.position;

      const limitVal = KinematicJointEvaluator.validateJointLimits(j, coord);
      if (!limitVal.valid) {
        limitViolations.push({
          jointId: j.jointId,
          violationType: limitVal.violationType || 'LIMIT_VIOLATION',
          requestedValue: limitVal.requestedValue,
          reason: limitVal.reason,
        });
        diagnostics.push(`Joint ${j.jointId} limit violation: ${limitVal.reason || limitVal.violationType}`);
      }

      // Check residual if both bodies exist
      const parentBody = bodyMap.get(j.parentBodyId);
      const childBody = bodyMap.get(j.childBodyId);

      if (parentBody && childBody && allTransformsValid) {
        const residual = KinematicJointEvaluator.computeJointResidual(
          j,
          parentBody.worldTransform,
          childBody.worldTransform,
          coord
        );
        const satisfied = residual <= j.tolerance;
        maxJointResidual = Math.max(maxJointResidual, residual);

        if (!satisfied) {
          allJointsSatisfied = false;
        }

        jointResiduals.push({
          jointId: j.jointId,
          residual,
          tolerance: j.tolerance,
          satisfied,
          reason: satisfied ? undefined : `Residual ${residual.toFixed(6)} exceeds tolerance ${j.tolerance}`,
        });
      }
    }

    // 4. Validate Assembly Constraints (PATCH-030 integration)
    let maxAssemblyResidual = 0;
    let assemblyConstraintsSatisfied = true;
    if (assemblyConstraints.length > 0 && allTransformsValid) {
      const assyVal = KinematicConstraintBridge.verifyAssemblyConstraints(assemblyConstraints, bodies);
      maxAssemblyResidual = assyVal.maximumResidual;
      assemblyConstraintsSatisfied = assyVal.satisfied;
      if (!assyVal.satisfied) {
        diagnostics.push(`Assembly constraint violation: max residual ${maxAssemblyResidual.toFixed(6)}`);
      }
    }

    // 5. Determine Overall Kinematic Status
    let status: KinematicSolveStatus = 'CONVERGED';

    if (!allTransformsValid) {
      status = 'INVALID';
    } else if (limitViolations.length > 0) {
      status = 'LIMIT_VIOLATION';
    } else if (graphAnalysis.hasCycles) {
      status = allJointsSatisfied && assemblyConstraintsSatisfied ? 'CONVERGED' : 'UNPROVEN';
    } else if (!graphAnalysis.valid) {
      status = 'CONFLICT';
    } else if (!allJointsSatisfied || !assemblyConstraintsSatisfied) {
      status = 'NOT_CONVERGED';
    } else {
      const dofAnalysis = KinematicDiagnostics.analyzeDegreesOfFreedom(bodies, joints);
      if (dofAnalysis.totalSystemMotionDOF > 0) {
        status = 'CONVERGED_WITH_REMAINING_DOF';
      } else {
        status = 'CONVERGED';
      }
    }

    const overallValid =
      status === 'CONVERGED' || status === 'CONVERGED_WITH_REMAINING_DOF';

    return {
      status,
      valid: overallValid,
      maximumJointResidual: maxJointResidual,
      maximumAssemblyConstraintResidual: maxAssemblyResidual,
      jointResiduals,
      transformValidations,
      limitViolations,
      graphStatus: {
        valid: graphAnalysis.valid,
        hasCycles: graphAnalysis.hasCycles,
        groundBodyId: graphAnalysis.groundBodyId,
        disconnectedBodies: graphAnalysis.disconnectedBodyIds,
        reason: graphAnalysis.reason,
      },
      diagnostics,
    };
  }
}
