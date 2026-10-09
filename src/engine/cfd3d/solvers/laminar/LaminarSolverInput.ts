/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Input Container
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { MaterialProperties, FieldState } from './LaminarSolverTypes';
import { BoundaryConditionSet } from '../../boundary/BoundaryConditionSet';
import { LaminarSolverConfig } from './LaminarSolverConfig';

export interface LaminarSolverInput {
  readonly mesh: CFDMesh3D;
  readonly material: MaterialProperties;
  readonly initialState: FieldState;
  readonly boundaryConditions: BoundaryConditionSet;
  readonly config: LaminarSolverConfig;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialStateHash: string;
}

export class LaminarSolverInputValidator {
  public static validate(input: LaminarSolverInput): string[] {
    const errors: string[] = [];

    if (input.material.density <= 0 || !Number.isFinite(input.material.density)) {
      errors.push('INVALID_MATERIAL: density must be positive and finite');
    }
    if (input.material.viscosity <= 0 || !Number.isFinite(input.material.viscosity)) {
      errors.push('INVALID_MATERIAL: viscosity must be positive and finite');
    }

    if (!input.mesh.cells || input.mesh.cells.length === 0) {
      errors.push('INVALID_MESH: no cells found');
    }

    // Field validity
    for (const v of input.initialState.velocity) {
      if (!v.every(val => Number.isFinite(val))) {
        errors.push('INVALID_INITIAL_STATE: non-finite velocity detected');
        break;
      }
    }
    for (const p of input.initialState.pressure) {
      if (!Number.isFinite(p)) {
        errors.push('INVALID_INITIAL_STATE: non-finite pressure detected');
        break;
      }
    }

    if (input.initialState.velocity.length !== input.mesh.cells.length) {
      errors.push('INVALID_INITIAL_STATE: velocity field size mismatch');
    }

    if (input.initialState.pressure.length !== input.mesh.cells.length) {
      errors.push('INVALID_INITIAL_STATE: pressure field size mismatch');
    }

    return errors;
  }
}
