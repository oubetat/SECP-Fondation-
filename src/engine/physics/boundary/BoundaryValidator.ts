/**
 * SECP Industrial OS v2 — Boundary Validator
 * PATCH-045: Boundary Condition Framework
 */

import { CanonicalBoundaryCondition, BoundaryConditionSet, BoundaryConditionType } from './BoundaryTypes';
import { PhysicsDomain } from '../PhysicsTypes';
import { Dimension } from '../units/Dimension';
import { Quantity } from '../units/Quantity';
import * as crypto from 'crypto';

export interface BoundaryValidationResult {
  valid: boolean;
  status: 'VALID' | 'CONFLICTING' | 'INVALID' | 'MISSING_DATA' | 'DIMENSION_MISMATCH' | 'CROSS_DOMAIN_MISUSE';
  errors: string[];
  warnings: string[];
}

export class BoundaryValidator {
  
  private static readonly DIMENSION_REQUIREMENTS: Record<string, Dimension> = {
    // CFD
    'VELOCITY_INLET': Dimension.VELOCITY,
    'PRESSURE_INLET': Dimension.PRESSURE,
    'PRESSURE_OUTLET': Dimension.PRESSURE,
    'MASS_FLOW_INLET': Dimension.MASS.divide(Dimension.TIME),
    // Structural
    'PRESCRIBED_DISPLACEMENT': Dimension.LENGTH,
    'PRESCRIBED_VELOCITY': Dimension.VELOCITY,
    'FORCE': Dimension.FORCE,
    'PRESSURE_LOAD': Dimension.PRESSURE,
    'TRACTION': Dimension.PRESSURE,
    // Thermal
    'PRESCRIBED_TEMPERATURE': Dimension.TEMPERATURE,
    'HEAT_FLUX': Dimension.POWER.divide(Dimension.LENGTH.multiply(Dimension.LENGTH)),
    'CONVECTION': Dimension.POWER.divide(Dimension.LENGTH.multiply(Dimension.LENGTH).multiply(Dimension.TEMPERATURE))
  };

  private static readonly DOMAIN_MAPPING: Record<string, PhysicsDomain> = {
    'VELOCITY_INLET': PhysicsDomain.FLUID,
    'PRESSURE_INLET': PhysicsDomain.FLUID,
    'MASS_FLOW_INLET': PhysicsDomain.FLUID,
    'PRESSURE_OUTLET': PhysicsDomain.FLUID,
    'WALL': PhysicsDomain.FLUID, // Note: Wall can be fluid or thermal, but we restrict it strictly or rely on explicit domain in BC.
    
    'FIXED_SUPPORT': PhysicsDomain.STRUCTURAL,
    'PRESCRIBED_DISPLACEMENT': PhysicsDomain.STRUCTURAL,
    'PRESCRIBED_VELOCITY': PhysicsDomain.STRUCTURAL,
    'FORCE': PhysicsDomain.STRUCTURAL,
    'PRESSURE_LOAD': PhysicsDomain.STRUCTURAL,
    'TRACTION': PhysicsDomain.STRUCTURAL,
    
    'PRESCRIBED_TEMPERATURE': PhysicsDomain.THERMAL,
    'HEAT_FLUX': PhysicsDomain.THERMAL,
    'CONVECTION': PhysicsDomain.THERMAL,
    'RADIATION': PhysicsDomain.THERMAL
  };

  private static readonly VALUELESS_BCS = new Set<string>([
    'FIXED_SUPPORT', 'SYMMETRY', 'PERIODIC', 'WALL'
  ]);

  public static validateBoundaryCondition(bc: CanonicalBoundaryCondition): BoundaryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: BoundaryValidationResult['status'] = 'VALID';

    // 1. Missing Data
    if (!bc.boundaryConditionId) errors.push('Missing boundaryConditionId');
    if (!bc.target || !bc.target.targetId) errors.push('Missing valid targetId');
    if (!bc.type) errors.push('Missing type');
    if (!bc.physicsDomain) errors.push('Missing physicsDomain');

    if (errors.length > 0) return { valid: false, status: 'MISSING_DATA', errors, warnings };

    // 2. Cross Domain Misuse
    const expectedDomain = this.DOMAIN_MAPPING[bc.type as string];
    // We allow WALL and SYMMETRY to cross over domains if properly contextualized, but strict on specific ones
    if (expectedDomain && expectedDomain !== bc.physicsDomain && bc.type !== 'WALL' && bc.type !== 'SYMMETRY') {
      errors.push(`Cross-domain misuse: BC type ${bc.type} expects ${expectedDomain} but assigned to ${bc.physicsDomain}`);
      status = 'CROSS_DOMAIN_MISUSE';
    }

    // 3. Missing Value for Required Types
    if (!this.VALUELESS_BCS.has(bc.type) && !bc.value) {
      errors.push(`BC type ${bc.type} requires a value but none was provided`);
      status = 'MISSING_DATA';
    }

    // 4. Dimensional Validation & Numerical Safety
    if (bc.value) {
      if (bc.value.type === 'CONSTANT') {
        const q = bc.value.value;
        if (isNaN(q.value) || !isFinite(q.value)) {
          errors.push(`Invalid numerical value (NaN or Infinity) for BC ${bc.boundaryConditionId}`);
          status = 'INVALID';
        }

        const expectedDimension = this.DIMENSION_REQUIREMENTS[bc.type as string];
        if (expectedDimension && !q.dimension.equals(expectedDimension)) {
          errors.push(`Dimensional mismatch for ${bc.type}: Expected ${expectedDimension.toString()}, got ${q.dimension.toString()}`);
          status = 'DIMENSION_MISMATCH';
        }

        // Some rudimentary physical bound checks
        if (bc.type === 'PRESCRIBED_TEMPERATURE' && q.unit.id === 'kelvin' && q.value < 0) {
          errors.push(`Physically invalid negative absolute temperature in BC ${bc.boundaryConditionId}`);
          status = 'INVALID';
        }
      } else if (bc.value.type === 'TABLE') {
        if (!bc.value.points || bc.value.points.length === 0) {
           errors.push(`Table for BC ${bc.boundaryConditionId} is empty`);
           status = 'INVALID';
        }
        // Check for duplicate or unsorted points
        for (let i = 1; i < bc.value.points.length; i++) {
           if (bc.value.points[i].input.value <= bc.value.points[i-1].input.value) {
             errors.push(`Table coordinates for BC ${bc.boundaryConditionId} must be strictly monotonically increasing`);
             status = 'INVALID';
           }
        }
      } else if (bc.value.type === 'FUNCTION') {
        if (!bc.value.expression || bc.value.expression.trim() === '') {
           errors.push(`Function expression for BC ${bc.boundaryConditionId} is malformed or empty`);
           status = 'INVALID';
        }
      }
    }

    if (errors.length > 0 && status === 'VALID') status = 'INVALID';

    return {
      valid: errors.length === 0,
      status,
      errors,
      warnings
    };
  }

  public static detectConflicts(bcSet: BoundaryConditionSet): BoundaryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // First validate all BCs individually
    for (const bc of bcSet.boundaryConditions) {
      const bcRes = this.validateBoundaryCondition(bc);
      if (!bcRes.valid) {
        return bcRes; // Fast fail on individual errors
      }
    }

    // Check for target conflicts
    const targetMap = new Map<string, CanonicalBoundaryCondition[]>();
    for (const bc of bcSet.boundaryConditions) {
      const bcs = targetMap.get(bc.target.targetId) || [];
      bcs.push(bc);
      targetMap.set(bc.target.targetId, bcs);
    }

    for (const [targetId, bcs] of targetMap.entries()) {
      if (bcs.length > 1) {
        // We have multiple BCs on the same target.
        // Check for duplicates
        const uniqueIds = new Set(bcs.map(b => b.boundaryConditionId));
        if (uniqueIds.size !== bcs.length) {
          errors.push(`Duplicate BCs detected on target ${targetId}`);
        }

        // Check for fundamentally conflicting types on the same target within the same domain.
        // For simplicity: A target shouldn't have two different driving BCs for the same domain.
        const domainBCs = new Map<PhysicsDomain, CanonicalBoundaryCondition[]>();
        for (const bc of bcs) {
          const list = domainBCs.get(bc.physicsDomain) || [];
          list.push(bc);
          domainBCs.set(bc.physicsDomain, list);
        }

        for (const [domain, list] of domainBCs.entries()) {
          if (list.length > 1) {
             errors.push(`Conflicting multiple boundary conditions applied to target ${targetId} for domain ${domain}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? 'CONFLICTING' : 'VALID',
      errors,
      warnings
    };
  }

  public static calculateCanonicalHash(bcSet: BoundaryConditionSet): string {
    const canonicalObject = this.toCanonicalForm(bcSet);
    const serialized = JSON.stringify(canonicalObject);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private static toCanonicalForm(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (isNaN(obj)) return '__NAN__';
        if (obj === Infinity) return '__INF__';
        if (obj === -Infinity) return '__NEG_INF__';
      }
      return obj;
    }

    if (obj instanceof Quantity) {
      return {
        value: obj.value,
        unit: obj.unit.id,
        dimension: obj.dimension.vector
      };
    }

    if (Array.isArray(obj)) {
      const sortedArray = [...obj].map(item => this.toCanonicalForm(item));
      // Deterministic sort for arrays of objects with an ID
      if (sortedArray.length > 0 && typeof sortedArray[0] === 'object' && sortedArray[0] !== null) {
        const idField = ['boundaryConditionId', 'targetId', 'setId', 'input'].find(f => sortedArray[0][f] !== undefined);
        if (idField) {
           // For input (Table coordinates), we sort numerically
           if (idField === 'input') {
             sortedArray.sort((a, b) => {
               const valA = a.input && a.input.value !== undefined ? a.input.value : 0;
               const valB = b.input && b.input.value !== undefined ? b.input.value : 0;
               return valA - valB;
             });
           } else {
             sortedArray.sort((a, b) => String(a[idField]).localeCompare(String(b[idField])));
           }
        }
      }
      return sortedArray;
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Exclude ephemeral metadata from hash determinism
      if (key === 'metadata' || key === 'canonicalHash') continue;
      sortedObj[key] = this.toCanonicalForm(obj[key]);
    }
    return sortedObj;
  }
}
