import { ConservationResult, ConservationType, ConservationVerdict } from './types';

export class PhysicsConservationVerifier {
  public static verifyConservation(
    type: ConservationType,
    inputFlux: number,
    outputFlux: number,
    sourceTerm: number = 0,
    tolerance: number = 0.001 // 0.1% default tolerance
  ): ConservationResult {
    const totalInput = inputFlux + sourceTerm;
    const absError = Math.abs(totalInput - outputFlux);
    const referenceFlux = Math.max(Math.abs(totalInput), Math.abs(outputFlux), 1e-9);
    const relError = absError / referenceFlux;

    let verdict: ConservationVerdict = 'CONSERVATION_PASS';
    let details = `${type} conservation satisfied within tolerance (${(relError * 100).toFixed(4)}% <= ${(tolerance * 100).toFixed(2)}%).`;

    if (relError > tolerance) {
      verdict = 'CONSERVATION_FAILURE';
      details = `CONSERVATION_FAILURE: ${type} imbalance detected. Absolute error = ${absError.toFixed(6)}, Relative error = ${(relError * 100).toFixed(2)}% (exceeds tolerance ${(tolerance * 100).toFixed(2)}%).`;
    }

    return {
      type,
      inputFlux,
      outputFlux,
      sourceTerm,
      absoluteError: absError,
      relativeError: relError,
      tolerance,
      verdict,
      details
    };
  }
}
