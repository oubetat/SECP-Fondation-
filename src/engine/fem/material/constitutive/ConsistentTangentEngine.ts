/**
 * SECP CAD/CAE Platform - PATCH-233: Consistent Tangent Verification Engine
 *
 * Verifies analytical algorithmic consistent tangent matrices C_tangent
 * against finite-difference numerical derivatives:
 * [sigma(epsilon + dEps) - sigma(epsilon)] / perturbation vs C_tangent * dEps
 */

import { MaterialPointState } from './ConstitutiveTypes';
import { J2ConstitutivePlasticityModel } from './J2ConstitutivePlasticityModel';

export interface TangentVerificationReport {
  isValid: boolean;
  relativeErrorNorm: number;
  symmetryErrorNorm: number;
  analyticalTangent: number[][];
  numericalTangent: number[][];
  maxDifference: number;
}

export class ConsistentTangentEngine {
  /**
   * Finite difference verification of consistent tangent matrix
   */
  public static verifyTangentByFiniteDifference(
    model: J2ConstitutivePlasticityModel,
    state: MaterialPointState,
    baseStrainIncrement: number[],
    perturbation: number = 1e-7
  ): TangentVerificationReport {
    const baseResult = model.updateStress(baseStrainIncrement, state);
    const analytical = baseResult.tangent;

    const numerical: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

    for (let j = 0; j < 6; j++) {
      const perturbedIncrement = [...baseStrainIncrement];
      perturbedIncrement[j] += perturbation;

      const perturbedResult = model.updateStress(perturbedIncrement, state);

      for (let i = 0; i < 6; i++) {
        const dSigma = (perturbedResult.stress[i] - baseResult.stress[i]) / perturbation;
        numerical[i][j] = dSigma;
      }
    }

    // Compute relative error Frobenius norm
    let diffNormSq = 0;
    let analNormSq = 0;
    let maxDiff = 0;

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const diff = Math.abs(numerical[i][j] - analytical[i][j]);
        if (diff > maxDiff) maxDiff = diff;
        diffNormSq += diff * diff;
        analNormSq += analytical[i][j] * analytical[i][j];
      }
    }

    const relativeErrorNorm = Math.sqrt(diffNormSq) / (Math.sqrt(analNormSq) + 1e-12);

    // Compute symmetry error norm for analytical matrix
    let symDiffNormSq = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const symDiff = analytical[i][j] - analytical[j][i];
        symDiffNormSq += symDiff * symDiff;
      }
    }
    const symmetryErrorNorm = Math.sqrt(symDiffNormSq) / (Math.sqrt(analNormSq) + 1e-12);

    return {
      isValid: relativeErrorNorm <= 1e-3, // Standard finite difference matching threshold
      relativeErrorNorm,
      symmetryErrorNorm,
      analyticalTangent: analytical,
      numericalTangent: numerical,
      maxDifference: maxDiff
    };
  }
}
