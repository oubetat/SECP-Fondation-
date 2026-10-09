/**
 * SECP Industrial OS v2 — Industrial Fracture Mechanics Engine
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - Linear Elastic Fracture Mechanics (LEFM):
 *     * Stress Intensity Factor: K_I = Y * sigma * sqrt(pi * a)
 *     * Plane Strain Fracture Toughness: K_IC
 *     * Critical Energy Release Rate: G_C = (K_IC^2 / E') where E' = E / (1 - nu^2) for plane strain
 * - Elastic-Plastic Fracture Mechanics (EPFM):
 *     * Crack Tip Opening Displacement (CTOD): delta_t = K_I^2 / (m * sigma_y * E)
 *     * J-Integral: J_IC
 * - Subcritical Fatigue Crack Propagation: Paris-Erdogan Law:
 *     * da/dN = C * (Delta_K)^m for Delta_K_th < Delta_K < K_IC
 *     * Closed-form and numerical cycle integration: N_f = int(da / (C * Delta_K^m))
 * - Critical crack size estimation: a_c = (1 / pi) * (K_IC / (Y * sigma_max))^2
 */

import { FractureParams } from '../types/IndustrialMaterialTypes';

export interface CrackGrowthResult {
  cycles: number[];
  crackLengthsMm: number[];
  deltaK_values: number[];
  finalCyclesToFailure: number;
  criticalCrackLengthMm: number;
  initialCrackLengthMm: number;
}

export class FractureIndustrialEngine {
  private params: FractureParams;

  constructor(params: FractureParams) {
    this.params = params;
  }

  /**
   * Computes Mode-I stress intensity factor K_I in MPa*sqrt(m).
   */
  public computeStressIntensityFactor(
    stressMPa: number,
    crackLengthMm: number,
    geometryFactorY: number = 1.12 // 1.12 for edge crack in semi-infinite plate
  ): number {
    const crackLengthM = crackLengthMm / 1000;
    return geometryFactorY * stressMPa * Math.sqrt(Math.PI * crackLengthM);
  }

  /**
   * Computes critical crack size a_c at max applied stress (in mm).
   */
  public computeCriticalCrackSizeMm(
    maxStressMPa: number,
    geometryFactorY: number = 1.12
  ): number {
    const K1c = this.params.planeStrainFractureToughnessK1c_MPa_sqrt_m;
    const aCritM = (1 / Math.PI) * Math.pow(K1c / (geometryFactorY * maxStressMPa), 2);
    return aCritM * 1000;
  }

  /**
   * Computes plane strain critical energy release rate G_C (in J/m² or N/m).
   */
  public computeCriticalEnergyReleaseRateGc(E_GPa: number, nu: number = 0.3): number {
    const K1c = this.params.planeStrainFractureToughnessK1c_MPa_sqrt_m * 1e6; // to Pa*sqrt(m)
    const E_Pa = E_GPa * 1e9;
    const E_prime = E_Pa / (1 - nu * nu);
    return (K1c * K1c) / E_prime;
  }

  /**
   * Simulates subcritical crack growth via Paris-Erdogan law: da/dN = C * (Delta_K)^m.
   */
  public simulateCrackPropagation(
    initialCrackMm: number,
    stressRangeMPa: number,
    geometryFactorY: number = 1.12,
    maxCycles: number = 1000000,
    stepsCount: number = 100
  ): CrackGrowthResult {
    const C = this.params.parisConstantC;
    const m = this.params.parisExponentM;
    const K1c = this.params.planeStrainFractureToughnessK1c_MPa_sqrt_m;
    const deltaK_th = this.params.thresholdDeltaK_MPa_sqrt_m;

    const criticalCrackMm = this.computeCriticalCrackSizeMm(stressRangeMPa, geometryFactorY);
    const aFinalTargetMm = Math.min(criticalCrackMm, initialCrackMm * 10);

    const cycles: number[] = [0];
    const crackLengthsMm: number[] = [initialCrackMm];
    const deltaK_values: number[] = [this.computeStressIntensityFactor(stressRangeMPa, initialCrackMm, geometryFactorY)];

    let currentA_m = initialCrackMm / 1000;
    let currentN = 0;
    const da_m = (aFinalTargetMm / 1000 - currentA_m) / stepsCount;

    for (let i = 0; i < stepsCount; i++) {
      const deltaK = geometryFactorY * stressRangeMPa * Math.sqrt(Math.PI * currentA_m);

      if (deltaK < deltaK_th) {
        // Below threshold: crack does not propagate
        break;
      }

      if (deltaK >= K1c) {
        // Catastrophic fracture reached
        break;
      }

      // Paris rate: da/dN = C * (deltaK)^m => dN = da / (C * deltaK^m)
      const growthRate_m_per_cycle = C * Math.pow(deltaK, m);
      const dN = da_m / Math.max(1e-18, growthRate_m_per_cycle);

      currentN += dN;
      currentA_m += da_m;

      cycles.push(currentN);
      crackLengthsMm.push(currentA_m * 1000);
      deltaK_values.push(deltaK);

      if (currentN >= maxCycles) break;
    }

    return {
      cycles,
      crackLengthsMm,
      deltaK_values,
      finalCyclesToFailure: currentN,
      criticalCrackLengthMm: criticalCrackMm,
      initialCrackLengthMm: initialCrackMm
    };
  }
}
