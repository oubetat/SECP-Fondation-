/**
 * SECP Industrial OS v2 — Initial Condition Validator
 * PATCH-046: Initial Condition Framework
 */

import { 
  CanonicalInitialCondition, 
  InitialState, 
  InitialConditionType,
  InitialValueModel,
  VectorConstantValue,
  TensorConstantValue,
  ScalarConstantValue,
  TableInitialValue,
  FunctionInitialValue,
  FieldInitialValue,
  SimulationConditionSet
} from './InitialTypes';
import { PhysicsDomain } from '../PhysicsTypes';
import { Dimension } from '../units/Dimension';
import { Quantity } from '../units/Quantity';
import { BoundaryValidator } from '../boundary/BoundaryValidator';
import * as crypto from 'crypto';

export type InitialValidationStatus = 
  | 'VALID' 
  | 'COMPLETE'
  | 'INCOMPLETE'
  | 'CONFLICTING' 
  | 'INVALID' 
  | 'MISSING_DATA' 
  | 'DIMENSION_MISMATCH' 
  | 'CROSS_DOMAIN_MISUSE'
  | 'UNPROVEN';

export interface InitialValidationResult {
  valid: boolean;
  status: InitialValidationStatus;
  errors: string[];
  warnings: string[];
}

export class InitialValidator {

  private static readonly DIMENSION_MAP: Record<string, Dimension> = {
    'INITIAL_VELOCITY': Dimension.VELOCITY,
    'INITIAL_PRESSURE': Dimension.PRESSURE,
    'INITIAL_DENSITY': Dimension.DENSITY,
    'INITIAL_TEMPERATURE': Dimension.TEMPERATURE,
    'INITIAL_DISPLACEMENT': Dimension.LENGTH,
    'INITIAL_ACCELERATION': Dimension.ACCELERATION,
    'INITIAL_STRESS': Dimension.PRESSURE,
    'INITIAL_STRAIN': Dimension.SCALAR,
    'INITIAL_MASS_FRACTION': Dimension.SCALAR,
    'INITIAL_THERMAL_STATE': Dimension.TEMPERATURE
  };

  private static readonly DOMAIN_MAPPING: Record<string, PhysicsDomain[]> = {
    'INITIAL_VELOCITY': [PhysicsDomain.FLUID, PhysicsDomain.STRUCTURAL],
    'INITIAL_PRESSURE': [PhysicsDomain.FLUID],
    'INITIAL_DENSITY': [PhysicsDomain.FLUID],
    'INITIAL_TEMPERATURE': [PhysicsDomain.THERMAL, PhysicsDomain.FLUID],
    'INITIAL_MASS_FRACTION': [PhysicsDomain.FLUID],
    'INITIAL_DISPLACEMENT': [PhysicsDomain.STRUCTURAL],
    'INITIAL_ACCELERATION': [PhysicsDomain.STRUCTURAL],
    'INITIAL_STRESS': [PhysicsDomain.STRUCTURAL],
    'INITIAL_STRAIN': [PhysicsDomain.STRUCTURAL],
    'INITIAL_THERMAL_STATE': [PhysicsDomain.THERMAL]
  };

  public static validateInitialCondition(ic: CanonicalInitialCondition): InitialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: InitialValidationStatus = 'VALID';

    // 1. Missing Data
    if (!ic) {
      return { valid: false, status: 'MISSING_DATA', errors: ['Initial condition object is null/undefined'], warnings };
    }
    if (!ic.initialConditionId || ic.initialConditionId.trim() === '') {
      errors.push('Missing initialConditionId');
    }
    if (!ic.target || !ic.target.targetId || ic.target.targetId.trim() === '') {
      errors.push('Missing targetId in target specification');
    }
    if (!ic.target || !ic.target.kind) {
      errors.push('Missing target kind in target specification');
    }
    if (!ic.type) {
      errors.push('Missing initial condition type');
    }
    if (!ic.physicsDomain) {
      errors.push('Missing physicsDomain');
    }
    if (!ic.value) {
      errors.push('Missing initial condition value model');
    }

    if (errors.length > 0) {
      return { valid: false, status: 'MISSING_DATA', errors, warnings };
    }

    // 2. Cross Domain Misuse
    const allowedDomains = this.DOMAIN_MAPPING[ic.type];
    if (allowedDomains && !allowedDomains.includes(ic.physicsDomain)) {
      errors.push(`Cross-domain misuse: IC type ${ic.type} is not applicable to domain ${ic.physicsDomain} (allowed: ${allowedDomains.join(', ')})`);
      status = 'CROSS_DOMAIN_MISUSE';
    }

    // 3. Dimensional and Value Validation
    const valRes = this.validateInitialConditionValue(ic.type, ic.value);
    if (!valRes.valid) {
      errors.push(...valRes.errors);
      warnings.push(...valRes.warnings);
      status = valRes.status;
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? status : 'VALID',
      errors,
      warnings
    };
  }

  public static validateInitialConditionValue(type: InitialConditionType, value: InitialValueModel): InitialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: InitialValidationStatus = 'VALID';

    const expectedDimension = this.DIMENSION_MAP[type];

    // Validate based on rank & model
    if ('type' in value && value.type === 'TABLE') {
      const tbl = value as TableInitialValue;
      if (!tbl.points || tbl.points.length === 0) {
        errors.push('Table initial condition must have at least one sample point');
        status = 'INVALID';
      } else {
        for (let i = 1; i < tbl.points.length; i++) {
          if (tbl.points[i].input.value <= tbl.points[i-1].input.value) {
            errors.push('Table sample input coordinates must be strictly monotonically increasing');
            status = 'INVALID';
          }
        }
      }
    } else if ('type' in value && value.type === 'FUNCTION') {
      const fn = value as FunctionInitialValue;
      if (!fn.expression || fn.expression.trim() === '') {
        errors.push('Function initial condition has empty expression');
        status = 'INVALID';
      }
    } else if ('type' in value && value.type === 'FIELD') {
      const fld = value as FieldInitialValue;
      if (!fld.fieldDescriptor || fld.fieldDescriptor.trim() === '') {
        errors.push('Field initial condition requires a non-empty fieldDescriptor');
        status = 'INVALID';
      }
    } else if ('rank' in value) {
      if (value.rank === 'SCALAR') {
        const scalarVal = value as ScalarConstantValue;
        if (!scalarVal.value) {
          errors.push('Missing scalar Quantity value');
          return { valid: false, status: 'MISSING_DATA', errors, warnings };
        }
        const q = scalarVal.value;
        if (isNaN(q.value) || !isFinite(q.value)) {
          errors.push('Invalid numeric value (NaN or Infinity) in scalar initial condition');
          status = 'INVALID';
        }
        if (expectedDimension && !q.dimension.equals(expectedDimension)) {
          errors.push(`Dimensional mismatch for ${type}: Expected ${expectedDimension.toString()}, got ${q.dimension.toString()}`);
          status = 'DIMENSION_MISMATCH';
        }

        // Domain-specific physics constraints
        if (type === 'INITIAL_DENSITY' && q.value < 0) {
          errors.push(`Physically invalid negative initial density: ${q.value}`);
          status = 'INVALID';
        }
        if (type === 'INITIAL_TEMPERATURE' && q.unit.id === 'kelvin' && q.value < 0) {
          errors.push(`Physically invalid negative absolute initial temperature: ${q.value} K`);
          status = 'INVALID';
        }
      } else if (value.rank === 'VECTOR') {
        const vecVal = value as VectorConstantValue;
        if (!vecVal.components || !Array.isArray(vecVal.components)) {
          errors.push('Vector initial condition must have an array of 3 components');
          return { valid: false, status: 'INVALID', errors, warnings };
        }
        if (vecVal.components.length !== 3) {
          errors.push(`Vector initial condition must have exactly 3 components, got ${vecVal.components.length}`);
          status = 'INVALID';
        }
        if (!vecVal.coordinateSystem || !vecVal.coordinateSystem.id || !vecVal.coordinateSystem.type) {
          errors.push('Vector initial condition requires a valid coordinateSystem definition');
          status = 'INVALID';
        }
        for (let i = 0; i < vecVal.components.length; i++) {
          const comp = vecVal.components[i];
          if (!comp) {
            errors.push(`Vector component at index ${i} is missing or undefined`);
            status = 'MISSING_DATA';
            continue;
          }
          if (isNaN(comp.value) || !isFinite(comp.value)) {
            errors.push(`Vector component at index ${i} has invalid numeric value (NaN or Infinity)`);
            status = 'INVALID';
          }
          if (expectedDimension && !comp.dimension.equals(expectedDimension)) {
            errors.push(`Vector component at index ${i} has Dimensional mismatch for ${type}: Expected ${expectedDimension.toString()}, got ${comp.dimension.toString()}`);
            status = 'DIMENSION_MISMATCH';
          }
        }
      } else if (value.rank === 'TENSOR') {
        const tensorVal = value as TensorConstantValue;
        if (!tensorVal.components || typeof tensorVal.components !== 'object') {
          errors.push('Tensor initial condition must define components');
          return { valid: false, status: 'INVALID', errors, warnings };
        }
        if (!tensorVal.coordinateSystem || !tensorVal.coordinateSystem.id) {
          errors.push('Tensor initial condition requires a valid coordinateSystem definition');
          status = 'INVALID';
        }
        const requiredComps = ['xx', 'yy', 'zz', 'xy', 'yz', 'zx'];
        for (const compKey of requiredComps) {
          const comp = (tensorVal.components as any)[compKey];
          if (!comp) {
            errors.push(`Missing required symmetric tensor component: ${compKey}`);
            status = 'INVALID';
            continue;
          }
          if (isNaN(comp.value) || !isFinite(comp.value)) {
            errors.push(`Tensor component ${compKey} has invalid numeric value (NaN or Infinity)`);
            status = 'INVALID';
          }
          if (expectedDimension && !comp.dimension.equals(expectedDimension)) {
            errors.push(`Tensor component ${compKey} has Dimensional mismatch for ${type}: Expected ${expectedDimension.toString()}, got ${comp.dimension.toString()}`);
            status = 'DIMENSION_MISMATCH';
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? status : 'VALID',
      errors,
      warnings
    };
  }

  public static validateInitialState(state: InitialState, requiredTypes?: InitialConditionType[]): InitialValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!state) {
      return { valid: false, status: 'MISSING_DATA', errors: ['InitialState object is null or undefined'], warnings };
    }
    if (!state.stateId || state.stateId.trim() === '') {
      errors.push('Missing stateId in InitialState');
    }
    if (!state.modelId || state.modelId.trim() === '') {
      errors.push('Missing modelId in InitialState');
    }
    if (!state.physicsDomain) {
      errors.push('Missing physicsDomain in InitialState');
    }
    if (!state.conditions || !Array.isArray(state.conditions)) {
      errors.push('InitialState conditions must be an array');
      return { valid: false, status: 'INVALID', errors, warnings };
    }

    // Validate each condition individually
    for (const condition of state.conditions) {
      const condRes = this.validateInitialCondition(condition);
      if (!condRes.valid) {
        errors.push(...condRes.errors);
        warnings.push(...condRes.warnings);
      }
    }

    // Check for target conflicts (same target + same IC type)
    const targetTypeMap = new Map<string, CanonicalInitialCondition[]>();
    for (const ic of state.conditions) {
      const key = `${ic.target.targetId}::${ic.type}`;
      const list = targetTypeMap.get(key) || [];
      list.push(ic);
      targetTypeMap.set(key, list);
    }

    for (const [key, list] of targetTypeMap.entries()) {
      if (list.length > 1) {
        errors.push(`Conflicting multiple initial conditions for identical target and type: ${key}`);
      }
    }

    // Check completeness if requiredTypes are provided
    if (requiredTypes && requiredTypes.length > 0) {
      const presentTypes = new Set(state.conditions.map(c => c.type));
      const missing = requiredTypes.filter(rt => !presentTypes.has(rt));
      if (missing.length > 0) {
        warnings.push(`Initial state is incomplete for required fields: ${missing.join(', ')}`);
        if (errors.length === 0) {
          return {
            valid: true,
            status: 'INCOMPLETE',
            errors,
            warnings
          };
        }
      }
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? 'CONFLICTING' : (warnings.length > 0 ? 'INCOMPLETE' : 'COMPLETE'),
      errors,
      warnings
    };
  }

  public static detectInitialConditionConflicts(state: InitialState): InitialValidationResult {
    return this.validateInitialState(state);
  }

  public static calculateCanonicalHash(state: InitialState): string {
    const canonicalObject = this.toCanonicalForm(state);
    const serialized = JSON.stringify(canonicalObject);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public static calculateSimulationConditionSetHash(simSet: SimulationConditionSet): string {
    const canonicalObject = this.toCanonicalForm(simSet);
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
      if (sortedArray.length > 0 && typeof sortedArray[0] === 'object' && sortedArray[0] !== null) {
        const idField = ['initialConditionId', 'boundaryConditionId', 'targetId', 'stateId', 'setId', 'input'].find(f => sortedArray[0][f] !== undefined);
        if (idField) {
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
      if (key === 'metadata' || key === 'canonicalHash') continue;
      sortedObj[key] = this.toCanonicalForm(obj[key]);
    }
    return sortedObj;
  }
}
