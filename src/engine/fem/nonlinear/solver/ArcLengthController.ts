/**
 * SECP Industrial OS v3 — Arc-Length Controller (Crispfield / Riks Method) (PATCH-238)
 *
 * Provides solution infrastructure for snap-through and snap-back instability problems
 * by treating load factor \lambda as an additional unknown constrained by arc-length radius s:
 * a(u, \lambda) = (\Delta u)^T (\Delta u) + \psi^2 (\Delta \lambda)^2 (F_{ext}^T F_{ext}) - s^2 = 0
 */

export interface ArcLengthState {
  arcLengthRadius: number;   // s
  currentLambda: number;     // \lambda
  deltaLambda: number;       // \Delta \lambda
  psi: number;              // Load scaling factor \psi
  predictorDirection: 1 | -1;
}

export class ArcLengthController {
  private state: ArcLengthState;

  constructor(initialRadius: number = 0.05, psi: number = 1.0) {
    this.state = {
      arcLengthRadius: initialRadius,
      currentLambda: 0.0,
      deltaLambda: initialRadius,
      psi,
      predictorDirection: 1
    };
  }

  /**
   * Calculates Tangent Predictor Step for Load Factor Increment \Delta \lambda
   */
  public computeTangentialPredictor(
    uTangent: number[],
    fExt: number[]
  ): { deltaLambda: number; deltaU: number[] } {
    let uNormSq = 0;
    let fNormSq = 0;
    for (let i = 0; i < uTangent.length; i++) {
      uNormSq += uTangent[i] * uTangent[i];
      fNormSq += fExt[i] * fExt[i];
    }

    const denom = Math.sqrt(uNormSq + (this.state.psi ** 2) * fNormSq) || 1e-8;
    const deltaLambda = this.state.predictorDirection * (this.state.arcLengthRadius / denom);

    const deltaU = uTangent.map(v => v * deltaLambda);
    this.state.deltaLambda = deltaLambda;

    return { deltaLambda, deltaU };
  }

  /**
   * Corrects Lambda and Displacement to satisfy spherical arc-length constraint
   */
  public applyOrthogonalCorrection(
    uIterative: number[],
    uResidual: number[],
    deltaLambdaPrev: number
  ): { dLambda: number; dU: number[] } {
    // Crispfield cylindrical constraint projection: (\Delta u_0 + d u_1 + d \lambda u_2)^T u_2 = 0
    let dot0 = 0;
    let dot1 = 0;
    for (let i = 0; i < uIterative.length; i++) {
      dot0 += uIterative[i] * uResidual[i];
      dot1 += uResidual[i] * uResidual[i];
    }

    const dLambda = -dot0 / (dot1 + 1e-12);
    const dU = uIterative.map((v, idx) => v + dLambda * uResidual[idx]);

    return { dLambda, dU };
  }

  public getState(): ArcLengthState {
    return { ...this.state };
  }

  public updateRadius(actualIterations: number, targetIterations: number = 4): void {
    const factor = Math.sqrt(targetIterations / Math.max(1, actualIterations));
    const newRadius = Math.min(0.2, Math.max(0.001, this.state.arcLengthRadius * factor));
    this.state.arcLengthRadius = newRadius;
  }
}
