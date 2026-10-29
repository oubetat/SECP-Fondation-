/**
 * SECP Industrial OS — Engineering Truth OS
 * FatigueRULService.ts
 *
 * SECP-PHYSICS-EXPANSION-007: Progressive Damage & RUL Estimation.
 *
 * Provides model-dependent remaining useful life estimation bound to canonical material state.
 */

import { FEMMaterial, IntegrationPointState } from "../core/FEMTypes";

export interface RULEstimate {
  estimatedRemainingCycles: number;
  currentDamage: number;
  confidenceBound95: [number, number];
  status: 'SAFE' | 'CRITICAL' | 'FAILED' | 'UNVERIFIED';
  assumptions: string[];
}

export class FatigueRULService {
  /**
   * Estimates RUL based on current damage and stress amplitude.
   * Assumes constant amplitude loading continues for the estimate.
   */
  public static estimateRUL(
    material: FEMMaterial,
    state: IntegrationPointState,
    currentStressAmplitudePa: number,
    uncertaintyFactor: number = 0.1 // 10% model-form uncertainty
  ): RULEstimate {
    if (!material.fatigueParams) {
      throw new Error("RUL_ESTIMATION_FAILED: Fatigue parameters missing for material");
    }

    const D = state.damage ?? 0;
    const { sf_prime, b, enduranceLimit } = material.fatigueParams;

    if (D >= 1.0) {
      return {
        estimatedRemainingCycles: 0,
        currentDamage: D,
        confidenceBound95: [0, 0],
        status: 'FAILED',
        assumptions: ['Material point has reached critical damage threshold']
      };
    }

    if (!sf_prime || !b) {
       return {
        estimatedRemainingCycles: Infinity,
        currentDamage: D,
        confidenceBound95: [Infinity, Infinity],
        status: 'UNVERIFIED',
        assumptions: ['Missing Basquin parameters']
      };
    }

    const sigma_a = currentStressAmplitudePa;

    if (enduranceLimit && sigma_a < enduranceLimit) {
      return {
        estimatedRemainingCycles: Infinity,
        currentDamage: D,
        confidenceBound95: [Infinity, Infinity],
        status: 'SAFE',
        assumptions: ['Stress amplitude below endurance limit']
      };
    }

    // N_f = 0.5 * (sigma_a / sf_prime)^(1/b)
    const Nf = 0.5 * Math.pow(sigma_a / sf_prime, 1.0 / b);
    
    // Remaining life in cycles = Nf * (1 - D)
    const remainingCycles = Nf * (1.0 - D);

    const lowerBound = remainingCycles * (1.0 - uncertaintyFactor * 2.0);
    const upperBound = remainingCycles * (1.0 + uncertaintyFactor * 2.0);

    return {
      estimatedRemainingCycles: isFinite(remainingCycles) ? Math.max(0, remainingCycles) : Infinity,
      currentDamage: D,
      confidenceBound95: [Math.max(0, lowerBound), isFinite(upperBound) ? upperBound : Infinity],
      status: D > 0.8 ? 'CRITICAL' : 'SAFE',
      assumptions: [
        'Constant amplitude loading assumption',
        'Palmgren-Miner linear cumulative damage rule',
        'No load sequence interaction effects modeled',
        'Model-form uncertainty = 10%'
      ]
    };
  }
}
