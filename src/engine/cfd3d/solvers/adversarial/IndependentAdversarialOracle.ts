/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Independent Adversarial Oracle & Cross-Validation
 */

import { CFDVerdict, ConvergencePolicy, ConservationPolicy, ValidityPolicy } from './AdversarialTypes';
import { VerdictEngine } from './VerdictEngine';

export class IndependentAdversarialOracle {
  public static evaluateIndependentOracle(params: {
    readonly fields: Readonly<Record<string, readonly number[]>>;
    readonly meshVolumes: readonly number[];
    readonly residualHistory: readonly number[];
    readonly fluxes: { readonly massIn: number; readonly massOut: number };
    readonly convergencePolicy?: ConvergencePolicy;
    readonly conservationPolicy?: ConservationPolicy;
    readonly validityPolicy?: ValidityPolicy;
  }): { readonly oracleVerdict: CFDVerdict; readonly oracleReason: string } {
    const convPolicy = params.convergencePolicy ?? VerdictEngine.defaultConvergencePolicy();
    const consPolicy = params.conservationPolicy ?? VerdictEngine.defaultConservationPolicy();
    const valPolicy = params.validityPolicy ?? VerdictEngine.defaultValidityPolicy();

    // 1. Raw scan for non-finite values or negative density/viscosity
    for (const f of Object.keys(params.fields)) {
      const arr = params.fields[f];
      for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        if (Number.isNaN(val) || !Number.isFinite(val)) {
          return { oracleVerdict: 'INVALID', oracleReason: `Oracle detected non-finite in field ${f}` };
        }
        if (val < 0 && (f === 'density' || f === 'viscosity')) {
          return { oracleVerdict: 'INVALID', oracleReason: `Oracle detected negative value in physical property ${f}` };
        }
      }
    }

    // 2. Raw scan for negative or zero volume cells
    for (let i = 0; i < params.meshVolumes.length; i++) {
      if (params.meshVolumes[i] <= 0) {
        return { oracleVerdict: 'INVALID', oracleReason: 'Oracle detected non-positive mesh volume' };
      }
    }

    // 3. Raw conservation evaluation
    const massDelta = Math.abs(params.fluxes.massIn - params.fluxes.massOut);
    if (massDelta > consPolicy.maxMassImbalance) {
      return {
        oracleVerdict: 'CONSERVATION_FAILURE',
        oracleReason: `Oracle detected mass imbalance (${massDelta.toExponential(3)} > ${consPolicy.maxMassImbalance.toExponential(3)})`
      };
    }

    // 4. Raw convergence evaluation
    if (params.residualHistory.length === 0) {
      return { oracleVerdict: 'NOT_CONVERGED', oracleReason: 'Oracle detected empty residual history' };
    }
    const finalRes = params.residualHistory[params.residualHistory.length - 1];
    if (finalRes > convPolicy.residualThreshold) {
      return {
        oracleVerdict: 'NOT_CONVERGED',
        oracleReason: `Oracle detected residual above threshold (${finalRes.toExponential(3)} > ${convPolicy.residualThreshold.toExponential(3)})`
      };
    }

    return { oracleVerdict: 'CONVERGED', oracleReason: 'Oracle verified all numerical conditions satisfied' };
  }
}
