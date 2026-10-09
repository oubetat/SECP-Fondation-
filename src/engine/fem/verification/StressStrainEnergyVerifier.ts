import { VerificationCheckResult, VerificationStatus, VerificationTolerancePolicy } from "./types";

export class StressStrainEnergyVerifier {
  /**
   * Verifies energy conservation and strain energy vs external work consistency.
   * U = 1/2 u^T K u, W_ext = 1/2 F^T u.
   */
  public static verifyEnergyBalance(
    K: number[][],
    u: number[],
    F: number[],
    tolPolicy: VerificationTolerancePolicy
  ): VerificationCheckResult {
    const n = u.length;
    let strainEnergy = 0;
    let externalWork = 0;

    for (let i = 0; i < n; i++) {
      let Ku_i = 0;
      for (let j = 0; j < n; j++) {
        Ku_i += K[i][j] * u[j];
      }
      strainEnergy += 0.5 * u[i] * Ku_i;
      externalWork += 0.5 * F[i] * u[i];
    }

    const absDiff = Math.abs(externalWork - strainEnergy);
    const scale = Math.max(Math.abs(externalWork), Math.abs(strainEnergy), 1e-12);
    const relEnergyError = absDiff / scale;

    const passed = relEnergyError <= tolPolicy.energyRelTol;

    return {
      checkId: "ENERGY_BALANCE_CHECK",
      metric: "Relative Energy Mismatch |W_ext - U| / |W_ext|",
      measuredValue: strainEnergy,
      expectedValue: externalWork,
      tolerance: tolPolicy.energyRelTol,
      error: relEnergyError,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Strain Energy U = ${strainEnergy.toExponential(6)} J, External Work W_ext = ${externalWork.toExponential(6)} J (Rel Error: ${(relEnergyError * 100).toFixed(4)}%)`
    };
  }

  /**
   * Independent verification of linear elasticity constitutive relationship: sigma = D * epsilon.
   */
  public static verifyConstitutiveRelation(
    stress: number[],
    strain: number[],
    D: number[][],
    tolPolicy: VerificationTolerancePolicy
  ): VerificationCheckResult {
    const n = stress.length;
    let maxError = 0;

    for (let i = 0; i < n; i++) {
      let expectedStress_i = 0;
      for (let j = 0; j < n; j++) {
        expectedStress_i += D[i][j] * strain[j];
      }
      const diff = Math.abs(stress[i] - expectedStress_i);
      const scale = Math.max(Math.abs(stress[i]), Math.abs(expectedStress_i), 1e-6);
      const relError = diff / scale;

      if (relError > maxError) maxError = relError;
    }

    const passed = maxError <= tolPolicy.stressRelTol;

    return {
      checkId: "CONSTITUTIVE_RELATION_CHECK",
      metric: "Max Stress-Strain Constitutive Error ||sigma - D*epsilon|| / ||sigma||",
      measuredValue: maxError,
      expectedValue: 0,
      tolerance: tolPolicy.stressRelTol,
      error: maxError,
      status: passed ? VerificationStatus.PASS : VerificationStatus.FAIL,
      details: `Max constitutive recovery relative error: ${(maxError * 100).toFixed(4)}%`
    };
  }
}
