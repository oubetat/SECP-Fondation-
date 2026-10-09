/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver Input
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { MaterialProperties } from '../laminar/LaminarSolverTypes';
import { RansFieldState } from './RansSolverTypes';
import { BoundaryConditionSet } from '../../boundary/BoundaryConditionSet';
import { RansSolverConfig } from './RansSolverConfig';

export interface RansSolverInput {
  readonly mesh: CFDMesh3D;
  readonly material: MaterialProperties;
  readonly initialMeanState: RansFieldState;
  readonly initialTurbulenceState: RansFieldState;
  readonly boundaryConditions: BoundaryConditionSet;
  readonly config: RansSolverConfig;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialStateHash: string;
}

export class RansSolverInputValidator {
  public static validate(input: RansSolverInput): string[] {
    const errors: string[] = [];
    if (!input.mesh || !input.mesh.cells.length) errors.push('INVALID_MESH');
    if (input.material.density <= 0) errors.push('INVALID_MATERIAL: density');
    if (input.material.viscosity <= 0) errors.push('INVALID_MATERIAL: viscosity');
    return errors;
  }
}
