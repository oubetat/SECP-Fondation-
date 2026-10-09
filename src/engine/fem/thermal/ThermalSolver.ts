import { Matrix } from "../core/MathUtils";
import { ThermalVerdict, ThermalEnergyBalance } from "./types";

export class ThermalSolver {
  /**
   * Solves K * T = f with Dirichlet BCs
   */
  static solveSteady(
    K_global: Matrix,
    f_global: number[],
    dirichletBCs: Map<number, number>
  ): { temperatures: number[], verdict: ThermalVerdict } {
    const size = f_global.length;
    const K = new Matrix(size, size, K_global.data.map(row => [...row]));
    const f = [...f_global];

    // Apply Dirichlet BCs
    for (const [nodeIdx, T_val] of dirichletBCs.entries()) {
      for (let j = 0; j < size; j++) {
        K.set(nodeIdx, j, 0);
      }
      K.set(nodeIdx, nodeIdx, 1.0);
      f[nodeIdx] = T_val;
      
      // Zero out column to maintain symmetry (optional but good for some solvers)
      for (let i = 0; i < size; i++) {
        if (i !== nodeIdx) {
          f[i] -= K_global.get(i, nodeIdx) * T_val;
          K.set(i, nodeIdx, 0);
        }
      }
    }

    try {
      const T = K.inverse().multiplyVector(f);
      return { temperatures: T, verdict: ThermalVerdict.VERIFIED };
    } catch (e) {
      return { temperatures: [], verdict: ThermalVerdict.NUMERICAL_FAILURE };
    }
  }

  /**
   * Performs one step of transient solve: (C/dt + K) * T_new = f + (C/dt) * T_old
   * Backward Euler scheme.
   */
  static solveTransientStep(
    C_global: Matrix,
    K_global: Matrix,
    f_global: number[],
    T_old: number[],
    dt: number,
    dirichletBCs: Map<number, number>
  ): { temperatures: number[], verdict: ThermalVerdict } {
    const size = f_global.length;
    const invDt = 1.0 / dt;
    
    // Effective K: Ke = C/dt + K
    const Ke = Matrix.zeros(size, size);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        Ke.set(i, j, C_global.get(i, j) * invDt + K_global.get(i, j));
      }
    }

    // Effective f: fe = f + (C/dt) * T_old
    const CT_old = C_global.multiplyVector(T_old);
    const fe = f_global.map((val, i) => val + CT_old[i] * invDt);

    return this.solveSteady(Ke, fe, dirichletBCs);
  }

  static computeEnergyBalance(
    K_global: Matrix,
    T: number[],
    f_source: number[]
  ): ThermalEnergyBalance {
    const KT = K_global.multiplyVector(T);
    
    let qIn = 0;
    let qOut = 0;
    let qGen = f_source.reduce((a, b) => a + b, 0);

    for (let i = 0; i < T.length; i++) {
      const net = KT[i] - f_source[i];
      if (net > 1e-12) qIn += net; // Positive reaction means boundary pushes heat in
      else if (net < -1e-12) qOut -= net; // Negative reaction means heat flows out to boundary
    }

    const imbalance = qIn + qGen - qOut;
    const relativeImbalance = Math.abs(imbalance) / (Math.max(qIn, qOut, qGen) + 1e-10);

    return {
      qIn, qOut, qGen,
      internalEnergyChange: 0, // Steady state
      imbalance,
      relativeImbalance
    };
  }
}
