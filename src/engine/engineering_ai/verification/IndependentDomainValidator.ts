import { AIInputContract, OODStatus } from '../types';

export interface DomainValidationResult {
  valid: boolean;
  verdict: 'DOMAIN_PASS' | 'OUT_OF_DOMAIN' | 'INVALID_NUMERICS';
  oodStatus: OODStatus;
  details: string;
}

export class IndependentDomainValidator {
  /**
   * Independently evaluates input values against contract boundaries,
   * detecting out-of-distribution (OOD) operations, edge crossings, and non-finite floats.
   */
  public static validateDomainAdmissibility(
    inputs: Record<string, any>,
    contract?: AIInputContract
  ): DomainValidationResult {
    // 1. Numerical Sanity Check across all inputs
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'number') {
        if (!Number.isFinite(val)) {
          return {
            valid: false,
            verdict: 'INVALID_NUMERICS',
            oodStatus: 'OUT_OF_DISTRIBUTION',
            details: `INVALID_NUMERICS: Input '${key}' contains non-finite numerical value (${val}).`
          };
        }
      }
    }

    if (!contract || !contract.ranges || contract.ranges.length === 0) {
      return {
        valid: true,
        verdict: 'DOMAIN_PASS',
        oodStatus: 'IN_DOMAIN',
        details: 'DOMAIN_UNCONSTRAINED: No explicit range contract specified.'
      };
    }

    let nearBoundary = false;

    for (const range of contract.ranges) {
      const val = inputs[range.field];
      if (val === undefined) {
        return {
          valid: false,
          verdict: 'OUT_OF_DOMAIN',
          oodStatus: 'UNKNOWN',
          details: `CONTRACT_VIOLATION: Missing mandatory input field '${range.field}'.`
        };
      }

      if (typeof val === 'number') {
        if (val < range.min || val > range.max) {
          return {
            valid: false,
            verdict: 'OUT_OF_DOMAIN',
            oodStatus: 'OUT_OF_DISTRIBUTION',
            details: `OUT_OF_DOMAIN: Field '${range.field}'=${val} exceeds valid qualification envelope [${range.min}, ${range.max}] ${range.unit}.`
          };
        }

        const span = range.max - range.min;
        if (span > 0) {
          const distToMin = (val - range.min) / span;
          const distToMax = (range.max - val) / span;
          if (distToMin < 0.05 || distToMax < 0.05) {
            nearBoundary = true;
          }
        }
      }
    }

    return {
      valid: true,
      verdict: 'DOMAIN_PASS',
      oodStatus: nearBoundary ? 'NEAR_BOUNDARY' : 'IN_DOMAIN',
      details: nearBoundary
        ? 'OPERATING_NEAR_BOUNDARY: Input parameters are within 5% of qualification limits.'
        : 'IN_DOMAIN: All input parameters strictly within qualification envelope.'
    };
  }

  /**
   * Validates temporal causality and prevents future data leakage.
   */
  public static validateTemporalInvariants(
    trainingTimestamp?: string,
    evaluationTimestamp?: string
  ): { valid: boolean; details: string } {
    if (trainingTimestamp && evaluationTimestamp) {
      const trainEpoch = new Date(trainingTimestamp).getTime();
      const evalEpoch = new Date(evaluationTimestamp).getTime();

      if (isNaN(trainEpoch) || isNaN(evalEpoch)) {
        return { valid: false, details: 'TEMPORAL_INVALID: Malformed ISO-8601 date string.' };
      }

      if (trainEpoch > evalEpoch) {
        return {
          valid: false,
          details: `FUTURE_DATA_LEAKAGE: Model training timestamp (${trainingTimestamp}) post-dates evaluation timestamp (${evaluationTimestamp}).`
        };
      }
    }

    return { valid: true, details: 'TEMPORAL_INVARIANTS_SATISFIED' };
  }
}
