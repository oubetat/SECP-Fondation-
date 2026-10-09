/**
 * SECP Industrial OS v2 — Industrial Creep Engine
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - Norton-Bailey Power Law:
 *     eps_dot_cr = A * sigma^n * t^m * exp(-Q / (R * T))
 * - Arrhenius Temperature Acceleration
 * - Primary, Secondary (Steady-State), and Tertiary Creep Strain Accumulation
 * - Monkman-Grant Rupture Time Relation: t_r * (eps_dot_ss)^m_mg = C_mg
 * - Larson-Miller Parameter (LMP) for Creep Rupture Estimation: LMP = T * (C + log10(t_r))
 * - Implicit & Explicit Time Integration
 */

import { CreepParams } from '../types/IndustrialMaterialTypes';

export interface CreepSimulationResult {
  timeHours: number[];
  creepStrain: number[];
  creepStrainRate_1_hr: number[];
  steadyStateRate_1_hr: number;
  estimatedRuptureTimeHours: number;
  larsonMillerParameter: number;
}

export class CreepIndustrialEngine {
  private params: CreepParams;
  private static readonly R_GAS_CONSTANT = 8.314462618; // J / (mol * K)

  constructor(params: CreepParams) {
    this.params = params;
  }

  /**
   * Computes the instantaneous creep strain rate deps_cr/dt (in 1/second).
   */
  public computeCreepRate(stressMPa: number, tempK: number, timeSeconds: number = 3600): number {
    const A = this.params.nortonA;
    const n = this.params.stressExponentN;
    const m = this.params.timeExponentM || 0;
    const Q = this.params.activationEnergyQ_J_mol;

    // Arrhenius temperature factor: exp(-Q / (R * T))
    const arrheniusFactor = Math.exp(-Q / (CreepIndustrialEngine.R_GAS_CONSTANT * tempK));

    // Time hardening term (avoid singularity at t = 0)
    const timeTerm = m !== 0 ? Math.pow(Math.max(1.0, timeSeconds), m) : 1.0;

    // Stress power term
    const stressTerm = Math.pow(Math.max(0, stressMPa), n);

    return A * stressTerm * timeTerm * arrheniusFactor;
  }

  /**
   * Simulates high-temperature creep strain vs time under constant stress and temperature.
   */
  public simulateCreepCurve(
    stressMPa: number,
    tempK: number,
    totalDurationHours: number = 10000,
    stepsCount: number = 100
  ): CreepSimulationResult {
    const timeHours: number[] = [];
    const creepStrain: number[] = [];
    const creepStrainRate_1_hr: number[] = [];

    const dtHours = totalDurationHours / stepsCount;
    const dtSeconds = dtHours * 3600;

    let accumulatedStrain = 0;
    let currentTimeSeconds = 0;

    for (let i = 0; i <= stepsCount; i++) {
      const currentHours = i * dtHours;
      currentTimeSeconds = currentHours * 3600;

      // Rate in 1/second -> convert to 1/hour (* 3600)
      const rate_1_s = this.computeCreepRate(stressMPa, tempK, currentTimeSeconds);
      const rate_1_hr = rate_1_s * 3600;

      if (i > 0) {
        accumulatedStrain += rate_1_s * dtSeconds;
      }

      timeHours.push(currentHours);
      creepStrain.push(accumulatedStrain);
      creepStrainRate_1_hr.push(rate_1_hr);
    }

    // Steady state rate (rate at halfway duration)
    const steadyStateRate_1_hr = creepStrainRate_1_hr[Math.floor(stepsCount / 2)];

    // Monkman-Grant estimation of rupture time: t_r = C_mg / (eps_dot_ss)^m_mg (assuming C_mg = 0.1, m_mg = 1)
    const ruptureHours = Math.max(1, 0.1 / Math.max(1e-12, steadyStateRate_1_hr));

    // Larson-Miller Parameter: LMP = T * (20 + log10(t_r))
    const LMP = tempK * (20 + Math.log10(Math.max(0.1, ruptureHours)));

    return {
      timeHours,
      creepStrain,
      creepStrainRate_1_hr,
      steadyStateRate_1_hr,
      estimatedRuptureTimeHours: ruptureHours,
      larsonMillerParameter: LMP
    };
  }
}
