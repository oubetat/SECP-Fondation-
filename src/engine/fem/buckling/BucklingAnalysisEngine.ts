import { Matrix } from "../core/MathUtils";
import { BucklingEigenPair, BucklingVerdict, ModeClassification, NormalizationPolicy } from "./types";
import { EigenSolver } from "../modal/EigenSolver";

export class BucklingAnalysisEngine {
  /**
   * Solves the generalized buckling eigenvalue problem:
   * (K - lambda * KG) phi = 0  =>  K phi = lambda * KG phi
   * 
   * @param K_global Global elastic stiffness matrix
   * @param KG_global Global geometric stiffness matrix (assembled for reference load F_ref)
   * @param F_ref Reference load magnitude
   * @param numModes Number of requested buckling modes
   * @param dirichletBCs Prescribed boundary conditions
   */
  static analyze(
    K_global: Matrix,
    KG_global: Matrix,
    F_ref: number,
    numModes: number,
    dirichletBCs: Map<number, number>
  ): { eigenPairs: BucklingEigenPair[], verdict: BucklingVerdict } {
    const n = K_global.rows;

    const freeIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (!dirichletBCs.has(i)) freeIndices.push(i);
    }

    const n_free = freeIndices.length;
    if (n_free === 0) {
      return { eigenPairs: [], verdict: BucklingVerdict.VERIFIED };
    }

    const K_r = Matrix.zeros(n_free, n_free);
    const KG_r = Matrix.zeros(n_free, n_free);

    for (let i = 0; i < n_free; i++) {
      for (let j = 0; j < n_free; j++) {
        K_r.set(i, j, K_global.get(freeIndices[i], freeIndices[j]));
        KG_r.set(i, j, KG_global.get(freeIndices[i], freeIndices[j]));
      }
    }

    try {
      const shift = 1e-6;
      const rawResults = EigenSolver.solveGeneralized(K_r, KG_r, Math.min(numModes, n_free), shift, 1e-8, 100, 1e-16);

      // Filter and map results to global DOFs
      const globalPairs: BucklingEigenPair[] = [];

      for (let idx = 0; idx < rawResults.length; idx++) {
        const raw = rawResults[idx];
        const lambda = raw.eigenvalue;

        // Skip non-physical high-regularization modes (> 1e9)
        if (lambda > 1e9) continue;

        const globalVector = new Array(n).fill(0);
        raw.eigenvector.forEach((val, i) => {
          globalVector[freeIndices[i]] = val;
        });

        // Max-component normalization
        let maxVal = 0;
        globalVector.forEach(v => { if (Math.abs(v) > maxVal) maxVal = Math.abs(v); });
        const normalizedVector = globalVector.map(v => v / (maxVal || 1));

        // Residual calculation r = K*phi - lambda*KG*phi
        const Kphi = K_global.multiplyVector(normalizedVector);
        const KGphi = KG_global.multiplyVector(normalizedVector);
        let resNorm = 0;
        let kNorm = 0;
        for (let i = 0; i < n; i++) {
          const r = Kphi[i] - lambda * KGphi[i];
          // ignore constrained DOFs in residual norm
          if (!dirichletBCs.has(i)) {
            resNorm += r * r;
            kNorm += Kphi[i] * Kphi[i];
          }
        }
        resNorm = Math.sqrt(resNorm) / Math.sqrt(kNorm || 1);

        // Rayleigh quotient
        let phiKphi = 0, phiKGphi = 0;
        for (let i = 0; i < n; i++) {
          phiKphi += normalizedVector[i] * Kphi[i];
          phiKGphi += normalizedVector[i] * KGphi[i];
        }
        const rayleigh = phiKGphi !== 0 ? phiKphi / phiKGphi : lambda;

        const loadFactor = lambda;
        const criticalLoad = loadFactor * F_ref;

        globalPairs.push({
          modeId: globalPairs.length + 1,
          eigenvalue: lambda,
          loadFactor,
          criticalLoad,
          eigenvector: normalizedVector,
          residual: resNorm,
          rayleighQuotient: rayleigh,
          classification: this.classifyEigenvalue(lambda)
        });
      }

      return {
        eigenPairs: globalPairs,
        verdict: BucklingVerdict.VERIFIED
      };
    } catch (e) {
      console.error("Buckling Analysis Failed:", e);
      return { eigenPairs: [], verdict: BucklingVerdict.NUMERICAL_FAILURE };
    }
  }

  private static classifyEigenvalue(lambda: number): ModeClassification {
    if (isNaN(lambda)) return ModeClassification.INVALID;
    if (lambda < -1e-8) return ModeClassification.NEGATIVE;
    if (Math.abs(lambda) < 1e-8) return ModeClassification.NEAR_ZERO;
    return ModeClassification.POSITIVE_BUCKLING_FACTOR;
  }
}
