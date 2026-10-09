/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Independent Conservation Analyzer
 */

import { ConservationPolicy } from './AdversarialTypes';

export interface ConservationAuditResult {
  readonly isConserved: boolean;
  readonly massImbalance: number;
  readonly momentumImbalance: number;
  readonly energyImbalance: number;
  readonly massConserved: boolean;
  readonly momentumConserved: boolean;
  readonly energyConserved: boolean;
  readonly reasons: readonly string[];
}

export class IndependentConservationAnalyzer {
  public static auditBalances(
    fluxes: {
      readonly massIn: number;
      readonly massOut: number;
      readonly momentumIn?: number;
      readonly momentumOut?: number;
      readonly energyIn?: number;
      readonly energyOut?: number;
    },
    policy: ConservationPolicy
  ): ConservationAuditResult {
    const reasons: string[] = [];

    // Mass Conservation
    const massImbalance = Math.abs(fluxes.massIn - fluxes.massOut);
    const massConserved = massImbalance <= policy.maxMassImbalance;
    if (!massConserved) {
      reasons.push(
        `Mass imbalance (${massImbalance.toExponential(4)}) exceeds threshold (${policy.maxMassImbalance.toExponential(4)}).`
      );
    }

    // Momentum Conservation
    const momIn = fluxes.momentumIn ?? 0;
    const momOut = fluxes.momentumOut ?? 0;
    const momentumImbalance = Math.abs(momIn - momOut);
    const momentumConserved = momentumImbalance <= policy.maxMomentumImbalance;
    if (!momentumConserved) {
      reasons.push(
        `Momentum imbalance (${momentumImbalance.toExponential(4)}) exceeds threshold (${policy.maxMomentumImbalance.toExponential(4)}).`
      );
    }

    // Energy Conservation
    const engIn = fluxes.energyIn ?? 0;
    const engOut = fluxes.energyOut ?? 0;
    const energyImbalance = Math.abs(engIn - engOut);
    const energyConserved = energyImbalance <= policy.maxEnergyImbalance;
    if (!energyConserved) {
      reasons.push(
        `Energy imbalance (${energyImbalance.toExponential(4)}) exceeds threshold (${policy.maxEnergyImbalance.toExponential(4)}).`
      );
    }

    const isConserved = massConserved && momentumConserved && energyConserved;

    return {
      isConserved,
      massImbalance,
      momentumImbalance,
      energyImbalance,
      massConserved,
      momentumConserved,
      energyConserved,
      reasons
    };
  }
}
