/**
 * SECP Industrial OS v2 — AP242 PMI Validator
 * PATCH-035: AP242 PMI
 */

import { PmiObject, PmiValidationResult } from './AP242PmiTypes';

export class AP242PmiValidator {
  public static validate(pmi: PmiObject): PmiValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pmi.id) errors.push('MISSING_ID');
    if (!pmi.category) errors.push('MISSING_CATEGORY');

    if (pmi.isSemantic) {
      if (pmi.category === 'DIMENSION' && (pmi.value === undefined || pmi.value < 0)) {
        errors.push('INVALID_NOMINAL_VALUE');
      }
      if (pmi.tolerance) {
        if (pmi.tolerance.lowerTolerance > pmi.tolerance.upperTolerance) {
          errors.push('INVALID_TOLERANCE_RANGE');
        }
      }
      if (pmi.category === 'FEATURE_CONTROL_FRAME') {
        if (!pmi.semanticType) errors.push('MISSING_CHARACTERISTIC');
      }
    } else {
      warnings.push('GRAPHICAL_PMI_ONLY');
    }

    if (!pmi.geometryReferences || pmi.geometryReferences.length === 0) {
      if (pmi.isSemantic) {
        errors.push('DANGLING_ASSOCIATION');
      } else {
        warnings.push('UNASSOCIATED_GRAPHICAL_PMI');
      }
    }

    // Check duplicate IDs (done at pipeline level typically, but we can return status)

    return {
      status: errors.length > 0 ? 'INVALID' : 'VALID',
      errors,
      warnings,
      pmiId: pmi.id
    };
  }

  public static validateCollection(pmis: PmiObject[]): PmiValidationResult[] {
    const ids = new Set<string>();
    const results = pmis.map(p => {
      const res = this.validate(p);
      if (ids.has(p.id)) {
        return { ...res, status: 'INVALID' as const, errors: [...res.errors, 'DUPLICATE_ID'] };
      }
      ids.add(p.id);
      return res;
    });
    return results;
  }
}
