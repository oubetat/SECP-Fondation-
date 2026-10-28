/**
 * SECP Industrial OS — Engineering Truth OS
 * ConstitutiveTangentVerifier.ts
 *
 * SECP-PHYSICS-EXPANSION-002: Finite-Difference Constitutive Tangent Verification Engine.
 *
 * Computes numerical central finite-difference derivatives of 2nd Piola-Kirchhoff stress S
 * with respect to Right Cauchy-Green deformation tensor C, and compares against analytical C_mat:
 *   C_ij^FD = (S_i(C + delta*e_j) - S_i(C - delta*e_j)) / (2 * delta)
 *
 * Evaluates max absolute and relative error norms to verify constitutive consistency
 * for Newton-Raphson equilibrium iterations.
 */

import { Matrix } from "./MathUtils";
import { HyperelasticNeoHookean3D } from "./HyperelasticNeoHookean3D";

export interface TangentVerificationResult {
  analyticalTangent: Matrix;
  fdTangent: Matrix;
  maxAbsoluteError: number;
  maxRelativeError: number;
  passed: boolean;
  perturbationDelta: number;
  tolerance: number;
}

export class ConstitutiveTangentVerifier {
  /**
   * Performs central finite-difference tangent check on a hyperelastic model.
   * Perturbs F directly such that C_perturbed = F_perturbed^T * F_perturbed.
   */
  public static verifyHyperelasticTangent(
    model: {
      computeStressAndTangent: (F: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
      computeStressAndTangentFromC: (C: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
    },
    F_base: number[][],
    temperature?: number,
    delta = 1e-6,
    tolerance = 1e-2
  ): TangentVerificationResult {
    const { C_mat: analyticalTangent } = model.computeStressAndTangent(F_base);
    // Note: computeStressAndTangent might not take temperature, but computeStressAndTangentFromC does now.
    // However, if the model has temperature dependence, we should ideally pass it.
    // I'll use the 'update' method if available, or just computeStressAndTangentFromC.
    const fdTangent = new Matrix(6, 6);

    // Compute base C_0 = F_base^T * F_base
    const C_base: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += F_base[k][i] * F_base[k][j];
        C_base[i][j] = sum;
      }
    }

    // Voigt pairs: 0:11, 1:22, 2:33, 3:12, 4:23, 5:13
    const voigtPairs: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [0, 1],
      [1, 2],
      [0, 2]
    ];

    for (let j = 0; j < 6; j++) {
      const [r, c] = voigtPairs[j];

      const C_plus = C_base.map(row => [...row]);
      const C_minus = C_base.map(row => [...row]);

      if (r === c) {
        C_plus[r][c] += delta;
        C_minus[r][c] -= delta;
      } else {
        C_plus[r][c] += delta;
        C_plus[c][r] += delta;
        C_minus[r][c] -= delta;
        C_minus[c][r] -= delta;
      }

      const { S_voigt: S_plus } = model.computeStressAndTangentFromC(C_plus, temperature as any);
      const { S_voigt: S_minus } = model.computeStressAndTangentFromC(C_minus, temperature as any);

      for (let i = 0; i < 6; i++) {
        let derivative = (S_plus[i] - S_minus[i]) / (2.0 * delta);
        if (j >= 3) {
          // Off-diagonal C_12, C_23, C_13 (symmetric perturbation on both C_ij and C_ji)
          derivative = (S_plus[i] - S_minus[i]) / (4.0 * delta);
        }
        fdTangent.set(i, j, 2.0 * derivative);
      }
    }

    let maxAbsErr = 0;
    let maxRelErr = 0;

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const aVal = analyticalTangent.get(i, j);
        const fdVal = fdTangent.get(i, j);
        const absErr = Math.abs(aVal - fdVal);

        if (absErr > maxAbsErr) maxAbsErr = absErr;

        const scale = Math.max(Math.abs(aVal), 1.0);
        const relErr = absErr / scale;
        if (relErr > maxRelErr) maxRelErr = relErr;
      }
    }

    return {
      analyticalTangent,
      fdTangent,
      maxAbsoluteError: maxAbsErr,
      maxRelativeError: maxRelErr,
      passed: maxRelErr < tolerance,
      perturbationDelta: delta,
      tolerance
    };
  }

  /**
   * Verifies constitutive tangent consistency across multiple admissible deformation states.
   */
  public static verifyHyperelasticTangentMultiState(
    model: {
      computeStressAndTangent: (F: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
      computeStressAndTangentFromC: (C: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
    },
    states: { stateName: string; F: number[][]; temperature?: number }[],
    delta = 1e-6,
    tolerance = 1e-2
  ): {
    stateResults: { stateName: string; maxAbsError: number; maxRelError: number; passed: boolean }[];
    allPassed: boolean;
  } {
    const stateResults = states.map(st => {
      const res = ConstitutiveTangentVerifier.verifyHyperelasticTangent(model, st.F, st.temperature, delta, tolerance);
      return {
        stateName: st.stateName,
        maxAbsError: res.maxAbsoluteError,
        maxRelError: res.maxRelativeError,
        passed: res.passed
      };
    });

    return {
      stateResults,
      allPassed: stateResults.every(r => r.passed)
    };
  }

  /**
   * Proves that an intentionally corrupted / incorrect tangent matrix is rejected by the verifier.
   */
  public static verifyRejectionOfIncorrectTangent(
    model: {
      computeStressAndTangent: (F: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
      computeStressAndTangentFromC: (C: number[][]) => { S_tensor: number[][]; S_voigt: number[]; C_mat: Matrix; J: number; strainEnergy: number };
    },
    F_base: number[][],
    corruptionFactor = 1.25
  ): boolean {
    const realResult = ConstitutiveTangentVerifier.verifyHyperelasticTangent(model, F_base);

    const corruptedModel = {
      computeStressAndTangent: (F: number[][]) => {
        const orig = model.computeStressAndTangent(F);
        const wrongCmat = new Matrix(6, 6);
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) {
            wrongCmat.set(r, c, orig.C_mat.get(r, c) * corruptionFactor);
          }
        }
        return { ...orig, C_mat: wrongCmat };
      },
      computeStressAndTangentFromC: (C: number[][]) => model.computeStressAndTangentFromC(C)
    };

    const corruptedResult = ConstitutiveTangentVerifier.verifyHyperelasticTangent(corruptedModel, F_base, 1e-6, 0.01);
    return realResult.passed === true && corruptedResult.passed === false;
  }
}
