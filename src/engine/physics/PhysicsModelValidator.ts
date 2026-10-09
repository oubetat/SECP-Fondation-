/**
 * SECP Industrial OS v2 — Physics Model Validator
 * PATCH-042: Physics Foundation
 */

import { PhysicsModel } from './PhysicsModel';
import { PhysicsModelStatus } from './PhysicsTypes';
import { UnitRegistry } from './units/Unit';
import { Dimension } from './units/Dimension';
import * as crypto from 'crypto';

export interface PhysicsValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  canonicalHash?: string;
}

export class PhysicsModelValidator {
  /**
   * Validates structural and dimensional integrity of the PhysicsModel.
   * This ensures BCs and Fields are physically consistent.
   */
  public static validate(model: PhysicsModel): PhysicsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Identity & Domain
    if (!model.id) errors.push('PhysicsModel must have a unique ID');
    if (!model.domain) errors.push('PhysicsModel must have a defined PhysicsDomain');

    // 2. Duplicate IDs
    const regionIds = new Set<string>();
    for (const region of model.regions) {
      if (regionIds.has(region.regionId)) {
        errors.push(`Duplicate Region ID detected: ${region.regionId}`);
      }
      regionIds.add(region.regionId);
    }

    const fieldIds = new Map<string, string>(); // id -> quantityDimension string
    for (const field of model.fields) {
      if (fieldIds.has(field.fieldId)) {
        errors.push(`Duplicate Field ID detected: ${field.fieldId}`);
      }
      fieldIds.set(field.fieldId, field.quantityDimension);
    }

    // 3. References
    for (const region of model.regions) {
      // Field assignments
      for (const fieldId of region.fieldAssignments) {
        if (!fieldIds.has(fieldId)) {
          errors.push(`Region ${region.regionId} refers to non-existent Field: ${fieldId}`);
        }
      }
      // Boundary assignments
      const bcIds = new Set(model.boundaryConditions.map(bc => bc.id));
      for (const bcId of region.boundaryAssignments) {
        if (!bcIds.has(bcId)) {
          errors.push(`Region ${region.regionId} refers to non-existent BoundaryCondition: ${bcId}`);
        }
      }
    }

    // 3. Dimensional Validation of Fields
    const fieldDimensionMap: Record<string, Dimension> = {
      'PRESSURE': Dimension.PRESSURE,
      'VELOCITY': Dimension.VELOCITY,
      'TEMPERATURE': Dimension.TEMPERATURE,
      'DENSITY': Dimension.DENSITY,
      'FORCE': Dimension.FORCE,
      'ENERGY': Dimension.ENERGY,
      'POWER': Dimension.POWER,
      'DISPLACEMENT': Dimension.LENGTH
    };

    for (const field of model.fields) {
      const expected = fieldDimensionMap[field.name.toUpperCase()];
      if (expected) {
        // Simple string check for now, or parse if complex
        // For PATCH-043 we expect canonical string representation
      }
    }

    // 4. Boundary Conditions Dimensional Consistency
    for (const bc of model.boundaryConditions) {
      if (UnitRegistry.has(bc.quantity.unit)) {
        const unit = UnitRegistry.get(bc.quantity.unit);
        
        // Match BC type to expected dimension
        if (bc.type === 'INLET' && bc.field === 'VELOCITY') {
          if (!unit.dimension.equals(Dimension.VELOCITY)) {
            errors.push(`BoundaryCondition ${bc.id}: Velocity Inlet requires Velocity dimension, but got ${unit.dimension.toString()}`);
          }
        }
        if (bc.field === 'PRESSURE') {
          if (!unit.dimension.equals(Dimension.PRESSURE)) {
            errors.push(`BoundaryCondition ${bc.id}: Pressure BC requires Pressure dimension, but got ${unit.dimension.toString()}`);
          }
        }
        if (bc.field === 'TEMPERATURE') {
          if (!unit.dimension.equals(Dimension.TEMPERATURE)) {
            errors.push(`BoundaryCondition ${bc.id}: Temperature BC requires Temperature dimension, but got ${unit.dimension.toString()}`);
          }
        }

        // Verify provided dimension vector matches unit dimension
        if (JSON.stringify(bc.quantity.dimension) !== JSON.stringify(unit.dimension.vector)) {
          errors.push(`BoundaryCondition ${bc.id}: Dimension spoofing detected. Provided dimension does not match unit.`);
        }

      } else {
        errors.push(`BoundaryCondition ${bc.id} uses unknown unit: ${bc.quantity.unit}`);
      }

      if (!regionIds.has(bc.targetRegion)) {
        errors.push(`BoundaryCondition ${bc.id} refers to non-existent Region: ${bc.targetRegion}`);
      }
    }

    // 5. Initial Conditions
    for (const ic of model.initialConditions) {
      if (!regionIds.has(ic.targetRegion)) {
        errors.push(`InitialCondition ${ic.id} refers to non-existent Region: ${ic.targetRegion}`);
      }
      if (UnitRegistry.has(ic.quantity.unit)) {
        const unit = UnitRegistry.get(ic.quantity.unit);
        if (JSON.stringify(ic.quantity.dimension) !== JSON.stringify(unit.dimension.vector)) {
          errors.push(`InitialCondition ${ic.id}: Dimension spoofing detected.`);
        }
      }
    }

    // 6. Geometry & Mesh references
    if (model.geometryRef) {
      if (!model.geometryRef.artifactId || !model.geometryRef.artifactHash) {
        errors.push('GeometryReference is malformed (missing artifactId or artifactHash)');
      }
    }

    // Canonical Hash Calculation (if valid so far)
    let canonicalHash: string | undefined;
    if (errors.length === 0) {
      canonicalHash = this.calculateCanonicalHash(model);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canonicalHash
    };
  }

  /**
   * Calculates a stable canonical hash for the physics model.
   * Determinism: Independent of property order.
   */
  public static calculateCanonicalHash(model: PhysicsModel): string {
    const canonicalObject = this.toCanonicalForm(model);
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

    if (Array.isArray(obj)) {
      // Sort arrays of objects by a common 'id' field if available to ensure determinism
      const sortedArray = [...obj].map(item => this.toCanonicalForm(item));
      if (sortedArray.length > 0 && typeof sortedArray[0] === 'object' && sortedArray[0] !== null) {
        const idField = ['id', 'regionId', 'fieldId', 'interfaceId', 'artifactId'].find(f => sortedArray[0][f] !== undefined);
        if (idField) {
          sortedArray.sort((a, b) => String(a[idField]).localeCompare(String(b[idField])));
        }
      }
      return sortedArray;
    }

    // Sort keys of objects
    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Skip timestamps that would break determinism
      if (key === 'updatedAt' || key === 'createdAt' || key === 'validatedAt') continue;
      sortedObj[key] = this.toCanonicalForm(obj[key]);
    }
    return sortedObj;
  }
}
