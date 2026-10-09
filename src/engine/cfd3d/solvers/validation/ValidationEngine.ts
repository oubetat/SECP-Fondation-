/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-071: CFD Validation Engine with Experimental Uncertainty Comparisons
 */

import { PhysicalReferenceData, ValidationMetricResult } from './ValidationTypes';

export class ValidationEngine {
  public static validateField(
    numericalValues: readonly number[],
    ref: PhysicalReferenceData,
    numericalUncertainty: number // U_num (discretization error, GCI, etc.)
  ): ValidationMetricResult {
    const size = numericalValues.length;
    if (size !== ref.values.length) {
      throw new Error(`VALIDATION_ERROR: Size mismatch between numerical values (${size}) and experimental reference values (${ref.values.length})`);
    }

    let sumSq = 0.0;
    let sumAbs = 0.0;
    let maxDiff = 0.0;
    let validatedCount = 0;
    let inconclusiveCount = 0;

    for (let i = 0; i < size; i++) {
      const diff = Math.abs(numericalValues[i] - ref.values[i]);
      sumSq += diff * diff;
      sumAbs += diff;
      if (diff > maxDiff) {
        maxDiff = diff;
      }

      // Combined Validation Uncertainty: U_val = sqrt(U_num^2 + U_exp^2)
      const u_exp = ref.uncertainty[i] !== undefined ? ref.uncertainty[i] : 0.05;
      const u_val = Math.sqrt(numericalUncertainty * numericalUncertainty + u_exp * u_exp);

      if (diff <= u_val) {
        validatedCount++;
      } else if (diff <= u_val * 1.5) {
        inconclusiveCount++;
      }
    }

    const L2Discrepancy = Math.sqrt(sumSq / size);
    const L1Discrepancy = sumAbs / size;
    const LMaxDiscrepancy = maxDiff;

    let validationVerdict: 'VALIDATED' | 'NOT_VALIDATED' | 'INCONCLUSIVE' = 'NOT_VALIDATED';
    const validationRatio = validatedCount / size;

    if (validationRatio >= 0.9) {
      validationVerdict = 'VALIDATED';
    } else if (validationRatio + inconclusiveCount / size >= 0.7) {
      validationVerdict = 'INCONCLUSIVE';
    }

    return {
      L1Discrepancy,
      L2Discrepancy,
      LMaxDiscrepancy,
      validationVerdict
    };
  }
}
