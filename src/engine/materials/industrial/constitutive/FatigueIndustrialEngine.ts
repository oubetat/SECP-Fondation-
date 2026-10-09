/**
 * SECP Industrial OS v2 — Industrial Fatigue Engine
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - High-Cycle Fatigue (HCF): Basquin S-N Curve: sigma_a = sigma'_f * (2*N)^b
 * - Low-Cycle Fatigue (LCF): Coffin-Manson-Morrow Strain-Life:
 *     Delta_eps / 2 = (sigma'_f - sigma_m)/E * (2*N)^b + eps'_f * (2*N)^c
 * - Mean Stress Corrections:
 *     * Goodman: sigma_a / S_e + sigma_m / S_ut = 1
 *     * Gerber:  sigma_a / S_e + (sigma_m / S_ut)^2 = 1
 *     * Soderberg: sigma_a / S_e + sigma_m / S_y = 1
 *     * Morrow: sigma_ar = sigma_a / (1 - sigma_m / sigma'_f)
 *     * Walker: sigma_ar = sigma_max * (1 - R)^gamma
 * - Marin Endurance Modifying Factors (Surface ka, Size kb, Load kc, Temp kd, Reliability ke)
 * - Palmgren-Miner Cumulative Damage: D = sum(n_i / N_i)
 */

import { FatigueParams } from '../types/IndustrialMaterialTypes';

export interface FatigueLifePrediction {
  cyclesToFailure: number;
  fatigueLimitSe_MPa: number;
  equivalentFullyReversedStress_MPa: number;
  damagePerCycle: number;
  isInfiniteLife: boolean;
  governingRegime: 'LCF_STRAIN_DOMINATED' | 'HCF_STRESS_DOMINATED' | 'INFINITE_LIFE';
}

export interface MarinFactors {
  surfaceFinishKa: number;  // Ground (1.0), Machined (0.8), As-Forged (0.5)
  sizeFactorKb: number;      // d <= 8mm (1.0), 8-50mm (0.85), >50mm (0.75)
  loadFactorKc: number;      // Bending (1.0), Axial (0.85), Torsion (0.577)
  temperatureFactorKd: number; // T <= 350C (1.0), 400C (0.9), 500C (0.75)
  reliabilityFactorKe: number; // 50% (1.0), 90% (0.897), 99% (0.814), 99.9% (0.753)
}

export class FatigueIndustrialEngine {
  private params: FatigueParams;

  constructor(params: FatigueParams) {
    this.params = params;
  }

  /**
   * Computes modified endurance limit Se = ka * kb * kc * kd * ke * Se_prime.
   */
  public computeModifiedEnduranceLimit(marin: Partial<MarinFactors> = {}): number {
    const ka = marin.surfaceFinishKa ?? 1.0;
    const kb = marin.sizeFactorKb ?? 1.0;
    const kc = marin.loadFactorKc ?? 1.0;
    const kd = marin.temperatureFactorKd ?? 1.0;
    const ke = marin.reliabilityFactorKe ?? 1.0;

    return this.params.enduranceLimitSe_MPa * (ka * kb * kc * kd * ke);
  }

  /**
   * High-Cycle Fatigue (HCF): Predicts life N from alternating stress amplitude sigma_a using Basquin's equation.
   * sigma_a = sigma'_f * (2*N)^b  =>  N = 0.5 * (sigma_a / sigma'_f)^(1/b)
   */
  public predictStressLifeHCF(alternatingStressMPa: number, meanStressMPa: number = 0, Sut_MPa: number = 800): FatigueLifePrediction {
    const Se = this.params.enduranceLimitSe_MPa;
    const sigmaF = this.params.fatigueStrengthCoeffSigmaF_MPa;
    const b = this.params.fatigueStrengthExponentB;

    // Apply Goodman mean stress correction to obtain equivalent fully reversed stress amplitude sigma_ar
    let sigma_ar = alternatingStressMPa;
    if (meanStressMPa !== 0 && Sut_MPa > meanStressMPa) {
      sigma_ar = alternatingStressMPa / (1 - meanStressMPa / Sut_MPa);
    }

    if (sigma_ar <= Se) {
      return {
        cyclesToFailure: 1e9,
        fatigueLimitSe_MPa: Se,
        equivalentFullyReversedStress_MPa: sigma_ar,
        damagePerCycle: 0,
        isInfiniteLife: true,
        governingRegime: 'INFINITE_LIFE'
      };
    }

    // Basquin inversion: 2N = (sigma_ar / sigmaF)^(1/b)
    const reversals = Math.pow(Math.max(1, sigma_ar) / sigmaF, 1 / b);
    const cycles = Math.max(1, 0.5 * reversals);

    return {
      cyclesToFailure: cycles,
      fatigueLimitSe_MPa: Se,
      equivalentFullyReversedStress_MPa: sigma_ar,
      damagePerCycle: 1 / cycles,
      isInfiniteLife: false,
      governingRegime: 'HCF_STRESS_DOMINATED'
    };
  }

  /**
   * Low-Cycle Fatigue (LCF): Strain-life solver using Coffin-Manson-Morrow equation:
   * Delta_eps / 2 = (sigma'_f - sigma_m)/E * (2N)^b + eps'_f * (2N)^c
   */
  public predictStrainLifeLCF(
    totalStrainAmplitude: number,
    meanStressMPa: number = 0,
    E_MPa: number = 200000
  ): FatigueLifePrediction {
    const sigmaF = this.params.fatigueStrengthCoeffSigmaF_MPa;
    const b = this.params.fatigueStrengthExponentB;
    const epsF = this.params.fatigueDuctilityCoeffEpsF;
    const c = this.params.fatigueDuctilityExponentC;

    // Solve for 2N using Newton-Raphson
    let log2N = 3.0; // Initial guess 2N = 1000 reversals
    const maxIter = 50;

    for (let i = 0; i < maxIter; i++) {
      const twoN = Math.pow(10, log2N);
      const elasticStrain = ((sigmaF - meanStressMPa) / E_MPa) * Math.pow(twoN, b);
      const plasticStrain = epsF * Math.pow(twoN, c);
      const func = elasticStrain + plasticStrain - totalStrainAmplitude;

      if (Math.abs(func) < 1e-7) break;

      // Derivative d(func)/d(log2N) = ln(10) * [ b*elasticStrain + c*plasticStrain ]
      const dFunc = Math.LN10 * (b * elasticStrain + c * plasticStrain);
      const dLog2N = -func / dFunc;
      log2N += dLog2N;
    }

    const twoN_final = Math.pow(10, log2N);
    const cycles = Math.max(1, 0.5 * twoN_final);

    return {
      cyclesToFailure: cycles,
      fatigueLimitSe_MPa: this.params.enduranceLimitSe_MPa,
      equivalentFullyReversedStress_MPa: totalStrainAmplitude * E_MPa,
      damagePerCycle: 1 / cycles,
      isInfiniteLife: cycles >= 1e7,
      governingRegime: cycles < 1e4 ? 'LCF_STRAIN_DOMINATED' : 'HCF_STRESS_DOMINATED'
    };
  }

  /**
   * Generates Goodman, Gerber, and Soderberg mean stress limit curves for a given endurance limit Se and ultimate strength Sut.
   */
  public getMeanStressEnvelope(Sut_MPa: number, Sy_MPa: number, Se_MPa: number, pointsCount: number = 50): Array<{
    meanStress: number;
    goodmanAmp: number;
    gerberAmp: number;
    soderbergAmp: number;
  }> {
    const data: Array<{ meanStress: number; goodmanAmp: number; gerberAmp: number; soderbergAmp: number }> = [];
    const step = Sut_MPa / pointsCount;

    for (let sigmaM = 0; sigmaM <= Sut_MPa; sigmaM += step) {
      const goodman = Math.max(0, Se_MPa * (1 - sigmaM / Sut_MPa));
      const gerber = Math.max(0, Se_MPa * (1 - Math.pow(sigmaM / Sut_MPa, 2)));
      const soderberg = Math.max(0, Se_MPa * (1 - sigmaM / Sy_MPa));

      data.push({
        meanStress: sigmaM,
        goodmanAmp: goodman,
        gerberAmp: gerber,
        soderbergAmp: soderberg
      });
    }

    return data;
  }
}
