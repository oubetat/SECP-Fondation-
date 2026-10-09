import { DOFManager } from './DOFManager';
import { ResidualMetrics, SolverFailureType } from './types';

export interface SolutionValidationResult {
  isValid: boolean;
  failureType: SolverFailureType;
  failureReason?: string;
  maxConstraintViolation: number;
}

export class SolutionValidator {
  static validate(
    u_global: number[],
    dofManager: DOFManager,
    residualMetrics: ResidualMetrics,
    constraintTolerance: number = 1e-10
  ): SolutionValidationResult {
    // 1. Check finite values
    for (let i = 0; i < u_global.length; i++) {
      if (!Number.isFinite(u_global[i])) {
        return {
          isValid: false,
          failureType: 'NUMERICAL_FACTORISATION_FAILURE',
          failureReason: `Solution vector u contains non-finite value (NaN/Inf) at index ${i}: ${u_global[i]}`,
          maxConstraintViolation: Infinity
        };
      }
    }

    // 2. Check prescribed constraint satisfaction
    let maxConstraintViolation = 0;
    for (const dof of dofManager.globalDOFs) {
      if (dof.isConstrained) {
        const actual = u_global[dof.globalIndex];
        const expected = dof.constrainedValue ?? 0;
        const err = Math.abs(actual - expected);
        if (err > maxConstraintViolation) {
          maxConstraintViolation = err;
        }

        if (err > constraintTolerance) {
          return {
            isValid: false,
            failureType: 'INVALID_CONSTRAINT',
            failureReason: `Constraint violation at node ${dof.nodeId} DOF ${dof.dof}: expected ${expected}, got ${actual} (err=${err} > tol=${constraintTolerance})`,
            maxConstraintViolation
          };
        }
      }
    }

    // 3. Check residual
    if (!residualMetrics.passed) {
      return {
        isValid: false,
        failureType: 'RESIDUAL_FAILURE',
        failureReason: `Residual test failed: rel_res=${residualMetrics.relativeResidual.toExponential(4)}, abs_L2=${residualMetrics.absoluteNormL2.toExponential(4)}`,
        maxConstraintViolation
      };
    }

    return {
      isValid: true,
      failureType: 'NONE',
      maxConstraintViolation
    };
  }
}
