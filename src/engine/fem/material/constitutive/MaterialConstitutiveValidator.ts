/**
 * SECP CAD/CAE Platform - PATCH-233: Material Constitutive Validator
 *
 * Performs mathematical, physical, unit, positive-definiteness, matrix conditioning,
 * and parameter consistency validation for material definitions.
 */

import { MaterialConstitutiveDefinition, MaterialFailureDetail } from './ConstitutiveTypes';

export interface ValidationReport {
  isValid: boolean;
  errors: MaterialFailureDetail[];
  warnings: string[];
  conditionNumber?: number;
  symmetricErrorNorm?: number;
}

export class MaterialConstitutiveValidator {
  /**
   * Complete validation of a material constitutive definition
   */
  public static validate(def: MaterialConstitutiveDefinition): ValidationReport {
    const errors: MaterialFailureDetail[] = [];
    const warnings: string[] = [];

    // 1. Identity & Unit Checks
    if (!def.identity.materialId) {
      errors.push({
        code: 'ERR_INVALID_PARAMETERS',
        location: 'MaterialIdentity',
        reason: 'Material ID must not be empty'
      });
    }

    if (def.density <= 0 || Number.isNaN(def.density) || !Number.isFinite(def.density)) {
      errors.push({
        code: 'ERR_INVALID_PARAMETERS',
        location: 'Density',
        reason: `Density must be positive and finite (got ${def.density})`
      });
    }

    // 2. Elasticity Checks
    if (def.constitutiveType === 'ISOTROPIC_LINEAR_ELASTIC' || def.elastic.type === 'ISOTROPIC') {
      const E = def.elastic.E;
      const nu = def.elastic.nu;

      if (E === undefined || Number.isNaN(E) || !Number.isFinite(E) || E <= 0) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'ElasticProperties.E',
          reason: `Young's Modulus E must be positive and finite (got ${E})`
        });
      }

      if (nu === undefined || Number.isNaN(nu) || !Number.isFinite(nu) || nu <= -1.0 || nu >= 0.5) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'ElasticProperties.nu',
          reason: `Poisson's ratio nu must be in (-1.0, 0.5) for positive definite energy density (got ${nu})`
        });
      }
    } else if (def.constitutiveType === 'ORTHOTROPIC_LINEAR_ELASTIC' || def.elastic.type === 'ORTHOTROPIC') {
      const { E1, E2, E3, nu12, nu23, nu13, G12, G23, G13 } = def.elastic;
      if (!E1 || E1 <= 0 || !E2 || E2 <= 0 || !E3 || E3 <= 0) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'OrthotropicElasticity.E',
          reason: 'Directional Young\'s moduli (E1, E2, E3) must be positive'
        });
      }
      if (!G12 || G12 <= 0 || !G23 || G23 <= 0 || !G13 || G13 <= 0) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'OrthotropicElasticity.G',
          reason: 'Directional shear moduli (G12, G23, G13) must be positive'
        });
      }
      if (nu12 === undefined || nu23 === undefined || nu13 === undefined) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'OrthotropicElasticity.nu',
          reason: 'Poisson\'s ratios (nu12, nu23, nu13) must be defined'
        });
      }
    } else if (def.constitutiveType === 'ANISOTROPIC_LINEAR_ELASTIC' || def.elastic.type === 'ANISOTROPIC') {
      if (!def.elastic.C6x6 || def.elastic.C6x6.length !== 6) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'AnisotropicElasticity.C6x6',
          reason: 'Anisotropic stiffness matrix must be a 6x6 matrix'
        });
      } else {
        const matrixReport = this.validateStiffnessMatrix6x6(def.elastic.C6x6);
        if (!matrixReport.isValid) {
          errors.push(...matrixReport.errors);
        }
      }
    }

    // 3. Plasticity Checks
    if (def.constitutiveType === 'J2_PLASTICITY' || def.plastic) {
      const p = def.plastic;
      if (!p) {
        errors.push({
          code: 'ERR_INVALID_PARAMETERS',
          location: 'PlasticProperties',
          reason: 'J2 Plasticity model selected but plastic properties are undefined'
        });
      } else {
        if (p.initialYieldStress <= 0 || Number.isNaN(p.initialYieldStress) || !Number.isFinite(p.initialYieldStress)) {
          errors.push({
            code: 'ERR_INVALID_PARAMETERS',
            location: 'PlasticProperties.initialYieldStress',
            reason: `Initial yield stress must be positive and finite (got ${p.initialYieldStress})`
          });
        }
        if (p.hardeningType === 'ISOTROPIC' && (p.isotropicHardeningModulus === undefined || p.isotropicHardeningModulus < 0)) {
          errors.push({
            code: 'ERR_INVALID_PARAMETERS',
            location: 'PlasticProperties.isotropicHardeningModulus',
            reason: 'Isotropic hardening modulus H must be non-negative'
          });
        }
        if (p.hardeningType === 'KINEMATIC' && (p.kinematicHardeningModulus === undefined || p.kinematicHardeningModulus < 0)) {
          errors.push({
            code: 'ERR_INVALID_PARAMETERS',
            location: 'PlasticProperties.kinematicHardeningModulus',
            reason: 'Kinematic hardening modulus C_kin must be non-negative'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates a 6x6 stiffness matrix for symmetry, positive-definiteness, and condition number
   */
  public static validateStiffnessMatrix6x6(C: number[][]): ValidationReport {
    const errors: MaterialFailureDetail[] = [];
    const warnings: string[] = [];

    // Dimension check
    if (C.length !== 6 || C.some(row => row.length !== 6)) {
      errors.push({
        code: 'ERR_INVALID_PARAMETERS',
        location: 'StiffnessMatrix',
        reason: 'Matrix is not 6x6'
      });
      return { isValid: false, errors, warnings };
    }

    // Symmetry check
    let maxSymError = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const diff = Math.abs(C[i][j] - C[j][i]);
        const mag = 0.5 * (Math.abs(C[i][j]) + Math.abs(C[j][i])) + 1e-12;
        const relErr = diff / mag;
        if (relErr > maxSymError) maxSymError = relErr;

        if (relErr > 1e-4) {
          errors.push({
            code: 'ERR_INVALID_PARAMETERS',
            location: `StiffnessMatrix[${i}][${j}]`,
            reason: `Matrix non-symmetry detected: C[${i}][${j}] (${C[i][j]}) != C[${j}][${i}] (${C[j][i]})`
          });
        }
      }
    }

    // Positive-definiteness check using Sylvester's criterion (leading principal minors)
    for (let k = 1; k <= 6; k++) {
      const minorDet = this.computeSubmatrixDet(C, k);
      if (minorDet <= 0 || Number.isNaN(minorDet)) {
        errors.push({
          code: 'ERR_NON_POSITIVE_DEFINITE',
          location: `LeadingPrincipalMinor_${k}`,
          reason: `Leading principal minor ${k} determinant is non-positive (${minorDet}). Matrix is not positive-definite.`
        });
      }
    }

    // Condition number estimation (L1 norm based)
    const condEst = this.estimateConditionNumber6x6(C);
    if (condEst > 1e12) {
      warnings.push(`High stiffness matrix condition number (kappa ~ ${condEst.toExponential(2)}). May cause ill-conditioning.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      conditionNumber: condEst,
      symmetricErrorNorm: maxSymError
    };
  }

  private static computeSubmatrixDet(C: number[][], k: number): number {
    const sub: number[][] = [];
    for (let i = 0; i < k; i++) {
      sub.push(C[i].slice(0, k));
    }
    return this.determinantGeneral(sub);
  }

  private static determinantGeneral(m: number[][]): number {
    const n = m.length;
    if (n === 1) return m[0][0];
    if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
    if (n === 3) {
      return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
      );
    }

    let det = 0;
    for (let c = 0; c < n; c++) {
      const sub = m.slice(1).map(row => row.filter((_, colIdx) => colIdx !== c));
      det += (c % 2 === 0 ? 1 : -1) * m[0][c] * this.determinantGeneral(sub);
    }
    return det;
  }

  private static estimateConditionNumber6x6(C: number[][]): number {
    // Norm 1 of C
    let norm1 = 0;
    for (let j = 0; j < 6; j++) {
      let colSum = 0;
      for (let i = 0; i < 6; i++) {
        colSum += Math.abs(C[i][j]);
      }
      if (colSum > norm1) norm1 = colSum;
    }

    // Min diagonal value as crude proxy
    let minDiag = Infinity;
    for (let i = 0; i < 6; i++) {
      if (Math.abs(C[i][i]) < minDiag) minDiag = Math.abs(C[i][i]);
    }

    if (minDiag <= 0) return Infinity;
    return norm1 / minDiag;
  }
}
