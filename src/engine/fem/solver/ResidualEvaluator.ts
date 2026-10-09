import { SparseMatrix } from '../sparse/SparseMatrix';
import { ResidualMetrics } from './types';

export class ResidualEvaluator {
  /**
   * Computes r = K*u - F using full global K, u, F
   */
  static evaluate(
    K_full: SparseMatrix,
    u_global: number[],
    F_global: number[],
    freeIndices?: number[],
    tolerance: number = 1e-8
  ): ResidualMetrics {
    const totalDOFs = K_full.rows;
    if (u_global.length !== totalDOFs || F_global.length !== totalDOFs) {
      throw new Error('Dimension mismatch in residual calculation.');
    }

    const Ku = K_full.spmv(u_global);

    let sumSq = 0;
    let maxInf = 0;
    let maxIndex = 0;
    let maxVal = 0;
    let fSumSq = 0;

    const indicesToEvaluate = freeIndices ?? Array.from({ length: totalDOFs }, (_, i) => i);

    for (const i of indicesToEvaluate) {
      const res = Ku[i] - F_global[i];
      const absRes = Math.abs(res);

      sumSq += absRes * absRes;
      if (absRes > maxInf) {
        maxInf = absRes;
        maxIndex = i;
        maxVal = res;
      }

      fSumSq += F_global[i] * F_global[i];
    }

    const absL2 = Math.sqrt(sumSq);
    const fL2 = Math.sqrt(fSumSq);
    const relativeResidual = fL2 > 1e-12 ? absL2 / fL2 : absL2;

    const passed = relativeResidual <= tolerance || absL2 <= Math.max(tolerance, 1e-6);

    return {
      absoluteNormL2: absL2,
      absoluteNormInf: maxInf,
      relativeResidual,
      maxResidualEntry: { index: maxIndex, value: maxVal },
      passed
    };
  }
}
