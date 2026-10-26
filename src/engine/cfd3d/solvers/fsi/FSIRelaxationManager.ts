/**
 * SECP Industrial OS — Engineering Truth OS
 * FSIRelaxationManager.ts
 *
 * Implements genuine Aitken Dynamic Under-Relaxation for partitioned
 * Fluid-Structure Interaction (FSI) coupling algorithms.
 *
 * Mathematical formulation:
 * Let r_k = d_{structural}^{(k)} - d_{interface}^{(k)} be the interface displacement residual.
 * Change in residual: \Delta r_k = r_k - r_{k-1}
 * Dynamic Aitken factor:
 *   \omega_k = -\omega_{k-1} * \frac{r_{k-1} \cdot \Delta r_k}{\|\Delta r_k\|^2}
 * Clamped: \omega_k \in [\omega_{min}, \omega_{max}]
 * Relaxed interface state:
 *   d_{interface}^{(k+1)} = d_{interface}^{(k)} + \omega_k * r_k
 */

export type FSICouplingStopReason = 
  | 'CONVERGED'
  | 'DIVERGED'
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'SOLVER_FAILURE'
  | 'NON_FINITE_NUMERICAL_ERROR';

export interface RelaxationIterationRecord {
  iteration: number;
  omega: number;
  residualNorm: number;
  maxResidualComponent: number;
  isFinite: boolean;
}

export interface FSIRelaxationConfig {
  initialOmega?: number;        // Default: 0.5
  minOmega?: number;            // Default: 0.05
  maxOmega?: number;            // Default: 1.0
  tolerance?: number;           // Default: 1e-4
  divergenceFactor?: number;    // Residual growth limit factor (e.g. 1000)
}

export class FSIRelaxationManager {
  private initialOmega: number;
  private minOmega: number;
  private maxOmega: number;
  private tolerance: number;
  private divergenceFactor: number;

  private currentOmega: number;
  private previousResidual: number[] | null = null;
  private initialResidualNorm: number | null = null;
  private history: RelaxationIterationRecord[] = [];

  constructor(config: FSIRelaxationConfig = {}) {
    this.initialOmega = config.initialOmega ?? 0.5;
    this.minOmega = config.minOmega ?? 0.05;
    this.maxOmega = config.maxOmega ?? 1.0;
    this.tolerance = config.tolerance ?? 1e-4;
    this.divergenceFactor = config.divergenceFactor ?? 1000.0;

    // Validate configuration
    if (this.minOmega <= 0 || this.maxOmega <= 0 || this.minOmega > this.maxOmega) {
      throw new Error(`Invalid Aitken relaxation bounds: [${this.minOmega}, ${this.maxOmega}]`);
    }
    this.currentOmega = Math.min(Math.max(this.initialOmega, this.minOmega), this.maxOmega);
  }

  public reset(): void {
    this.currentOmega = Math.min(Math.max(this.initialOmega, this.minOmega), this.maxOmega);
    this.previousResidual = null;
    this.initialResidualNorm = null;
    this.history = [];
  }

  /**
   * Computes the vector residual r = calculated - current
   */
  public computeResidual(calculated: number[], current: number[]): number[] {
    if (calculated.length !== current.length) {
      throw new Error(`Dimension mismatch: calculated (${calculated.length}) vs current (${current.length})`);
    }

    const r = new Array(calculated.length);
    for (let i = 0; i < calculated.length; i++) {
      const val = calculated[i] - current[i];
      if (!Number.isFinite(val)) {
        throw new Error(`Non-finite residual encountered at index ${i}: ${val}`);
      }
      r[i] = val;
    }
    return r;
  }

  /**
   * Evaluates the L2 norm of a vector
   */
  public static normL2(vec: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      const v = vec[i];
      if (!Number.isFinite(v)) return NaN;
      sum += v * v;
    }
    return Math.sqrt(sum);
  }

  /**
   * Evaluates dot product of two vectors
   */
  private static dot(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Calculates next relaxation factor and updates relaxed displacement field
   * using Aitken Dynamic Relaxation.
   */
  public step(
    currentDisplacements: number[],
    newDisplacements: number[],
    iterationIndex: number
  ): {
    relaxedDisplacements: number[];
    residualNorm: number;
    omega: number;
    isConverged: boolean;
    stopReason?: FSICouplingStopReason;
  } {
    // 1. Check finiteness of input vectors
    for (let i = 0; i < currentDisplacements.length; i++) {
      if (!Number.isFinite(currentDisplacements[i]) || !Number.isFinite(newDisplacements[i])) {
        return {
          relaxedDisplacements: currentDisplacements.slice(),
          residualNorm: NaN,
          omega: this.currentOmega,
          isConverged: false,
          stopReason: 'NON_FINITE_NUMERICAL_ERROR'
        };
      }
    }

    // 2. Compute residual r_k = d_{new} - d_{current}
    let r_k: number[];
    try {
      r_k = this.computeResidual(newDisplacements, currentDisplacements);
    } catch {
      return {
        relaxedDisplacements: currentDisplacements.slice(),
        residualNorm: NaN,
        omega: this.currentOmega,
        isConverged: false,
        stopReason: 'NON_FINITE_NUMERICAL_ERROR'
      };
    }

    const norm = FSIRelaxationManager.normL2(r_k);
    if (!Number.isFinite(norm)) {
      return {
        relaxedDisplacements: currentDisplacements.slice(),
        residualNorm: NaN,
        omega: this.currentOmega,
        isConverged: false,
        stopReason: 'NON_FINITE_NUMERICAL_ERROR'
      };
    }

    if (this.initialResidualNorm === null) {
      this.initialResidualNorm = norm;
    }

    // 3. Check for divergence
    if (this.initialResidualNorm > 0 && norm > this.initialResidualNorm * this.divergenceFactor) {
      return {
        relaxedDisplacements: currentDisplacements.slice(),
        residualNorm: norm,
        omega: this.currentOmega,
        isConverged: false,
        stopReason: 'DIVERGED'
      };
    }

    // 4. Update omega using Aitken formula if previous residual exists
    let omega = this.currentOmega;
    if (this.previousResidual && iterationIndex > 0) {
      const deltaR = new Array(r_k.length);
      for (let i = 0; i < r_k.length; i++) {
        deltaR[i] = r_k[i] - this.previousResidual[i];
      }
      const deltaNormSq = FSIRelaxationManager.dot(deltaR, deltaR);

      if (deltaNormSq > 1e-30) {
        const dotProd = FSIRelaxationManager.dot(this.previousResidual, deltaR);
        const aitkenOmega = -this.currentOmega * (dotProd / deltaNormSq);
        
        // Clamp strictly between [minOmega, maxOmega]
        omega = Math.min(Math.max(aitkenOmega, this.minOmega), this.maxOmega);
      }
    }

    this.currentOmega = omega;
    this.previousResidual = r_k.slice();

    // 5. Apply relaxation: d_{next} = d_{current} + omega * r_k
    const relaxed = new Array(currentDisplacements.length);
    for (let i = 0; i < currentDisplacements.length; i++) {
      relaxed[i] = currentDisplacements[i] + omega * r_k[i];
    }

    // 6. Record history
    this.history.push({
      iteration: iterationIndex,
      omega,
      residualNorm: norm,
      maxResidualComponent: Math.max(...r_k.map(v => Math.abs(v))),
      isFinite: true
    });

    // 7. Convergence check: strictly against tolerance
    const isConverged = norm < this.tolerance;
    const stopReason = isConverged ? 'CONVERGED' : undefined;

    return {
      relaxedDisplacements: relaxed,
      residualNorm: norm,
      omega,
      isConverged,
      stopReason
    };
  }

  public getHistory(): RelaxationIterationRecord[] {
    return this.history.slice();
  }

  public getCurrentOmega(): number {
    return this.currentOmega;
  }
}
