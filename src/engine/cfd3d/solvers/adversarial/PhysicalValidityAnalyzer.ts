/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Physical & Field Validity Analyzer
 */

import { ValidityPolicy } from './AdversarialTypes';

export interface FieldAuditResult {
  readonly isValid: boolean;
  readonly hasNaN: boolean;
  readonly hasInf: boolean;
  readonly hasNegativeValues: boolean;
  readonly totalElements: number;
  readonly invalidIndices: readonly number[];
  readonly reasons: readonly string[];
}

export interface MeshAuditResult {
  readonly isValid: boolean;
  readonly hasNegativeVolume: boolean;
  readonly hasZeroVolume: boolean;
  readonly hasInvertedCells: boolean;
  readonly reasons: readonly string[];
}

export class PhysicalValidityAnalyzer {
  public static auditField(
    fieldName: string,
    values: readonly number[],
    policy: ValidityPolicy
  ): FieldAuditResult {
    const invalidIndices: number[] = [];
    const reasons: string[] = [];
    let hasNaN = false;
    let hasInf = false;
    let hasNegativeValues = false;

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (Number.isNaN(v)) {
        hasNaN = true;
        invalidIndices.push(i);
      } else if (!Number.isFinite(v)) {
        hasInf = true;
        invalidIndices.push(i);
      } else if (v < 0) {
        if (fieldName === 'density' && !policy.allowNegativeDensity) {
          hasNegativeValues = true;
          invalidIndices.push(i);
        } else if (fieldName === 'viscosity' && !policy.allowNegativeViscosity) {
          hasNegativeValues = true;
          invalidIndices.push(i);
        } else if (fieldName === 'pressure' && !policy.allowNegativePressure) {
          hasNegativeValues = true;
          invalidIndices.push(i);
        }
      }
    }

    if (hasNaN) reasons.push(`Field '${fieldName}' contains NaN values.`);
    if (hasInf) reasons.push(`Field '${fieldName}' contains Infinite values.`);
    if (hasNegativeValues) reasons.push(`Field '${fieldName}' contains unphysical negative values.`);

    const isValid = !hasNaN && !hasInf && !hasNegativeValues;

    return {
      isValid,
      hasNaN,
      hasInf,
      hasNegativeValues,
      totalElements: values.length,
      invalidIndices,
      reasons
    };
  }

  public static auditMesh(
    cellVolumes: readonly number[],
    invertedCellFlags: readonly boolean[]
  ): MeshAuditResult {
    const reasons: string[] = [];
    let hasNegativeVolume = false;
    let hasZeroVolume = false;
    let hasInvertedCells = false;

    for (let i = 0; i < cellVolumes.length; i++) {
      const vol = cellVolumes[i];
      if (vol < 0) {
        hasNegativeVolume = true;
      } else if (vol === 0) {
        hasZeroVolume = true;
      }
    }

    for (let i = 0; i < invertedCellFlags.length; i++) {
      if (invertedCellFlags[i]) {
        hasInvertedCells = true;
      }
    }

    if (hasNegativeVolume) reasons.push('Mesh contains negative volume cells.');
    if (hasZeroVolume) reasons.push('Mesh contains zero volume cells.');
    if (hasInvertedCells) reasons.push('Mesh contains inverted geometric cells.');

    const isValid = !hasNegativeVolume && !hasZeroVolume && !hasInvertedCells;

    return {
      isValid,
      hasNegativeVolume,
      hasZeroVolume,
      hasInvertedCells,
      reasons
    };
  }
}
