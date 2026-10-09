import { SparseMatrix } from '../sparse/SparseMatrix';
import { ResidualMetrics } from './types';

export class IndependentResidualAudit {
  /**
   * Independent verification path for residual r = Ku - F.
   * Accesses raw CSR arrays directly without calling K.spmv or solver internal routines.
   */
  static audit(
    K_full: SparseMatrix,
    u_global: number[],
    F_global: number[],
    freeDOFIndices: number[],
    tolerance: number = 1e-8
  ): ResidualMetrics {
    const csr = K_full.storage;
    const freeSet = new Set(freeDOFIndices);

    let sumSqFree = 0;
    let maxInfFree = 0;
    let maxIndexFree = 0;
    let maxValFree = 0;
    let fFreeSumSq = 0;

    for (const i of freeDOFIndices) {
      let Ku_i = 0;
      const start = csr.rowPointers[i];
      const end = csr.rowPointers[i + 1];

      for (let p = start; p < end; p++) {
        const j = csr.columnIndices[p];
        Ku_i += csr.values[p] * u_global[j];
      }

      const res_i = Ku_i - F_global[i];
      const absRes = Math.abs(res_i);

      sumSqFree += absRes * absRes;
      if (absRes > maxInfFree) {
        maxInfFree = absRes;
        maxIndexFree = i;
        maxValFree = res_i;
      }

      fFreeSumSq += F_global[i] * F_global[i];
    }

    const absL2 = Math.sqrt(sumSqFree);
    const fL2 = Math.sqrt(fFreeSumSq);
    const relativeResidual = fL2 > 1e-12 ? absL2 / fL2 : absL2;
    const passed = relativeResidual <= tolerance || absL2 <= Math.max(tolerance, 1e-6);

    return {
      absoluteNormL2: absL2,
      absoluteNormInf: maxInfFree,
      relativeResidual,
      maxResidualEntry: { index: maxIndexFree, value: maxValFree },
      passed
    };
  }
}
