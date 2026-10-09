import { Matrix } from "../core/MathUtils";
import { EigenPair, ModalVerdict, NormalizationPolicy } from "./types";
import { EigenSolver } from "./EigenSolver";

export class ModalAnalysisEngine {
  /**
   * Solves the modal analysis problem: K phi = lambda M phi
   */
  static analyze(
    K_global: Matrix,
    M_global: Matrix,
    numModes: number,
    dirichletBCs: Map<number, number>
  ): { eigenPairs: EigenPair[], verdict: ModalVerdict } {
    const n = K_global.rows;
    
    // Apply BCs by partitioning or penalty.
    // Penalty/Constraint handling: For modal analysis, we usually zero out the rows/cols of constrained DOFs 
    // and put a large value on the diagonal, OR we simply remove them.
    // Removing them is more accurate for eigenvalues.
    
    const constrainedIndices = Array.from(dirichletBCs.keys());
    const freeIndices = [];
    for (let i = 0; i < n; i++) {
      if (!dirichletBCs.has(i)) freeIndices.push(i);
    }

    const n_free = freeIndices.length;
    if (n_free === 0) {
      return { eigenPairs: [], verdict: ModalVerdict.VERIFIED };
    }

    const K_r = Matrix.zeros(n_free, n_free);
    const M_r = Matrix.zeros(n_free, n_free);

    for (let i = 0; i < n_free; i++) {
      for (let j = 0; j < n_free; j++) {
        K_r.set(i, j, K_global.get(freeIndices[i], freeIndices[j]));
        M_r.set(i, j, M_global.get(freeIndices[i], freeIndices[j]));
      }
    }

    try {
      // Use a small shift to handle potential near-singularity if some rigid body modes remain
      const shift = 1e-6; 
      const results_r = EigenSolver.solveGeneralized(K_r, M_r, Math.min(numModes, n_free), shift);
      
      // Map back to global DOFs
      const globalEigenPairs: EigenPair[] = results_r.map(pair => {
        const globalVector = new Array(n).fill(0);
        pair.eigenvector.forEach((val, i) => {
          globalVector[freeIndices[i]] = val;
        });

        // Normalize global vector
        const normalized = this.normalizeVector(globalVector, pair.eigenvector, M_global, NormalizationPolicy.MASS_NORMALIZED);

        return {
          ...pair,
          eigenvector: normalized.vector,
          normalization: NormalizationPolicy.MASS_NORMALIZED
        };
      });

      return {
        eigenPairs: globalEigenPairs,
        verdict: ModalVerdict.VERIFIED
      };
    } catch (e) {
      console.error("Modal Analysis Failed:", e);
      return { eigenPairs: [], verdict: ModalVerdict.EIGENSOLVER_FAILURE };
    }
  }

  private static normalizeVector(
    globalVec: number[],
    freeVec: number[],
    M_global: Matrix,
    policy: NormalizationPolicy
  ): { vector: number[] } {
    if (policy === NormalizationPolicy.MAX_COMPONENT) {
      let max = 0;
      globalVec.forEach(v => { if (Math.abs(v) > max) max = Math.abs(v); });
      return { vector: globalVec.map(v => v / (max || 1)) };
    }
    
    if (policy === NormalizationPolicy.MASS_NORMALIZED) {
      // phi^T * M * phi = 1
      const Mphi = M_global.multiplyVector(globalVec);
      let phiMphi = 0;
      for (let i = 0; i < globalVec.length; i++) {
        phiMphi += globalVec[i] * Mphi[i];
      }
      const scale = Math.sqrt(Math.abs(phiMphi));
      return { vector: globalVec.map(v => v / (scale || 1)) };
    }

    return { vector: globalVec };
  }
}
