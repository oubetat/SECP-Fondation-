/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Verification Primitives
 */

import { ResidualSample, ResidualEquation } from './ResidualTypes';
import { ResidualCalculator } from './ResidualCalculator';
import { SparseMatrix, SparseVector } from '../linear-solvers';
import { ResidualVector } from './ResidualVector';

export class ResidualVerification {
  
  public static verifyResidualFinite(sample: ResidualSample): boolean {
    return sample.finite && 
           Number.isFinite(sample.absoluteResidual.l1) && 
           Number.isFinite(sample.absoluteResidual.l2) && 
           Number.isFinite(sample.absoluteResidual.lInf);
  }

  public static verifyResidualRecomputation(
    sample: ResidualSample,
    matrix: SparseMatrix,
    rhs: SparseVector,
    solution: SparseVector,
    tolerance: number = 1e-10
  ): { valid: boolean; actualL2: number; error?: string } {
    const computed = ResidualCalculator.calculateAlgebraicResidual(matrix, rhs, solution);
    const actualNorms = computed.norms();
    
    const diff = Math.abs(actualNorms.l2 - sample.absoluteResidual.l2);
    const relativeDiff = sample.absoluteResidual.l2 > 0 ? diff / sample.absoluteResidual.l2 : diff;

    if (relativeDiff > tolerance) {
      return {
        valid: false,
        actualL2: actualNorms.l2,
        error: `Residual mismatch: recorded ${sample.absoluteResidual.l2}, recomputed ${actualNorms.l2}`
      };
    }

    return { valid: true, actualL2: actualNorms.l2 };
  }

  public static verifyResidualHistoryIntegrity(
    history: ResidualSample[]
  ): boolean {
    if (history.length <= 1) return true;
    for (let i = 1; i < history.length; i++) {
      // Ensure strictly increasing iteration numbers (no missing/out-of-order)
      if (history[i].iteration <= history[i-1].iteration) return false;
    }
    return true;
  }
}
