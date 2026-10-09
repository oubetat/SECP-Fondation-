import { Matrix, solveLinearSystem } from "../core/MathUtils";
import { EigenPair, ModeClassification, NormalizationPolicy } from "./types";

export class EigenSolver {
  /**
   * Solves K * phi = lambda * M * phi using Subspace Iteration.
   * Finds the first 'numModes' eigenvalues.
   * @param shift Spectral shift sigma. Use sigma > 0 to handle rigid body modes.
   */
  static solveGeneralized(
    K_orig: Matrix,
    M: Matrix,
    numModes: number,
    shift: number = 0.0,
    tolerance: number = 1e-8,
    maxIterations: number = 100,
    minThreshold: number = 1e-16
  ): EigenPair[] {
    const n = K_orig.rows;
    const m = Math.min(n, numModes + 8); // Subspace size
    
    // Shifted K: K_hat = K + shift * M
    const K_hat = K_orig.addMatrix(M.scale(shift));

    // 1. Initial subspace vectors (mixed non-zero starting vectors to excite all modes)
    let V = Matrix.zeros(n, m);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        V.set(i, j, Math.sin((i + 1) * (j + 1)));
      }
    }

    let eigenvalues = new Array(m).fill(0);
    let prevEigenvalues = new Array(m).fill(0);

    for (let iter = 0; iter < maxIterations; iter++) {
      // 2. K_hat * V_bar = M * V
      const MV = M.multiply(V);
      const V_bar = Matrix.zeros(n, m);
      for (let j = 0; j < m; j++) {
        const column_j = MV.data.map(row => row[j]);
        try {
          const solution = solveLinearSystem(K_hat, column_j);
          for (let i = 0; i < n; i++) V_bar.set(i, j, solution[i]);
        } catch (err) {
          throw new Error(`[NUMERICAL_SINGULARITY] K matrix is singular even with shift ${shift}. Numerical instability.`);
        }
      }

      // 3. Project to subspace
      const K_star = V_bar.transpose().multiply(K_orig).multiply(V_bar);
      const M_star = V_bar.transpose().multiply(M).multiply(V_bar);

      // 4. Solve small generalized eigenproblem K* psi = lambda M* psi
      const { lambdas, psi } = this.solveDenseGeneralized(K_star, M_star, minThreshold);
      
      // Sort eigenpairs by lambda
      const pairs = lambdas.map((l, idx) => ({ l, vec: psi.data.map(row => row[idx]) }));
      pairs.sort((a, b) => a.l - b.l);
      
      eigenvalues = pairs.map(p => p.l);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < m; i++) {
          psi.set(i, j, pairs[j].vec[i]);
        }
      }

      // 5. Update V
      V = V_bar.multiply(psi);

      // 6. Convergence check (on eigenvalues sorted by magnitude)
      let converged = true;
      for (let i = 0; i < numModes; i++) {
        const diff = Math.abs(eigenvalues[i] - prevEigenvalues[i]);
        if (diff > tolerance * Math.abs(eigenvalues[i]) && diff > tolerance) {
          converged = false;
          break;
        }
      }

      if (converged && iter > 1) break;
      prevEigenvalues = [...eigenvalues];
    }

    // 7. Extract results
    const results: EigenPair[] = [];
    for (let i = 0; i < numModes; i++) {
      const lambda = eigenvalues[i];
      let eigenvector = V.data.map(row => row[i]);
      
      // Mandated by SECP-082: Mass-normalization phi^T * M * phi = 1
      const Mphi_vec = M.multiplyVector(eigenvector);
      const phiMphi = eigenvector.reduce((sum, v, idx) => sum + v * Mphi_vec[idx], 0);
      if (phiMphi > 1e-18) {
        const scale = 1.0 / Math.sqrt(phiMphi);
        eigenvector = eigenvector.map(v => v * scale);
      }
      
      // Explicit Residual Audit: r = K*phi - lambda*M*phi
      const Kphi = K_orig.multiplyVector(eigenvector);
      const Mphi_final = M.multiplyVector(eigenvector);
      let resNormSq = 0;
      for (let k = 0; k < n; k++) {
        const r = Kphi[k] - lambda * Mphi_final[k];
        resNormSq += r * r;
      }
      const resNorm = Math.sqrt(resNormSq);

      const omega = lambda > 0 ? Math.sqrt(lambda) : 0;
      const fHz = omega / (2 * Math.PI);

      results.push({
        modeId: i + 1,
        eigenvalue: lambda,
        angularFrequency: omega,
        frequencyHz: fHz,
        eigenvector,
        normalization: NormalizationPolicy.MAX_COMPONENT,
        residual: resNorm,
        rayleighQuotient: lambda, // Since we solved Kphi = lambda Mphi
        classification: this.classifyEigenvalue(lambda)
      });
    }

    return results;
  }

  private static classifyEigenvalue(lambda: number): ModeClassification {
    if (isNaN(lambda)) return ModeClassification.INVALID;
    if (lambda < -1e-8) return ModeClassification.NEGATIVE;
    if (Math.abs(lambda) < 1e-8) return ModeClassification.RIGID_BODY;
    return ModeClassification.POSITIVE;
  }

  /**
   * Solves K* psi = lambda M* psi for small dense symmetric matrices.
   * Uses simultaneous diagonalization.
   */
  private static solveDenseGeneralized(K: Matrix, M: Matrix, minThreshold: number = 1e-16): { lambdas: number[], psi: Matrix } {
    const n = K.rows;
    // 1. Diagonalize M: M = Q * D * Q^T
    const { values: D_vals, vectors: Q } = this.jacobi(M);
    
    // 2. Transformation matrix T = Q * D^-0.5
    const T = Matrix.zeros(n, n);
    const isZeroMode: boolean[] = new Array(n).fill(false);
    for (let j = 0; j < n; j++) {
      if (D_vals[j] > minThreshold) {
        const scale = 1.0 / Math.sqrt(D_vals[j]);
        for (let i = 0; i < n; i++) {
          T.set(i, j, Q.get(i, j) * scale);
        }
      } else {
        // Mandated by SECP-082: Handle zero mass/geometric stiffness modes as non-buckling (infinity)
        isZeroMode[j] = true;
      }
    }

    // 3. Transform K: K_prime = T^T * K * T
    const K_prime = T.transpose().multiply(K).multiply(T);

    // 4. Diagonalize K_prime: K_prime = P * L * P^T
    const { values: L_vals, vectors: P } = this.jacobi(K_prime);

    // 5. Re-integrate zero modes as high eigenvalues (infinite buckling load)
    for (let j = 0; j < n; j++) {
      if (isZeroMode[j]) {
        L_vals[j] = 1e20; // Represents infinity in numerical context
      }
    }

    // 6. Final eigenvectors: Psi = T * P
    const Psi = T.multiply(P);

    return { lambdas: L_vals, psi: Psi };
  }

  /**
   * Jacobi eigenvalue algorithm for symmetric matrices.
   */
  private static jacobi(A_orig: Matrix, tolerance: number = 1e-15, maxIters: number = 500): { values: number[], vectors: Matrix } {
    const n = A_orig.rows;
    const A = A_orig.clone();
    const V = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) V.set(i, i, 1.0);

    for (let iter = 0; iter < maxIters; iter++) {
      let maxVal = 0;
      let p = 0, q = 0;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(A.get(i, j)) > maxVal) {
            maxVal = Math.abs(A.get(i, j));
            p = i; q = j;
          }
        }
      }

      if (maxVal < tolerance) break;

      const app = A.get(p, p);
      const aqq = A.get(q, q);
      const apq = A.get(p, q);

      const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(phi);
      const s = Math.sin(phi);

      // Rotate A (Numerical consistency with SECP-082)
      for (let i = 0; i < n; i++) {
        if (i === p || i === q) continue;
        const api = A.get(p, i);
        const aqi = A.get(q, i);
        const new_api = c * api - s * aqi;
        const new_aqi = s * api + c * aqi;
        A.set(p, i, new_api);
        A.set(i, p, new_api);
        A.set(q, i, new_aqi);
        A.set(i, q, new_aqi);
      }

      const c2 = c * c;
      const s2 = s * s;
      const sc2 = 2 * s * c;
      A.set(p, p, c2 * app - sc2 * apq + s2 * aqq);
      A.set(q, q, s2 * app + sc2 * apq + c2 * aqq);
      A.set(p, q, 0);
      A.set(q, p, 0);

      // Rotate V
      for (let i = 0; i < n; i++) {
        const vpi = V.get(i, p);
        const vqi = V.get(i, q);
        V.set(i, p, c * vpi - s * vqi);
        V.set(i, q, s * vpi + c * vqi);
      }
    }

    const values = [];
    for (let i = 0; i < n; i++) values.push(A.get(i, i));

    return { values, vectors: V };
  }
}
