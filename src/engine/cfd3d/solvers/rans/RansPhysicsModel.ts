/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Physics Model
 */

import { Vector3D, MaterialProperties } from '../laminar/LaminarSolverTypes';
import { RansTurbulenceVariables, ReynoldsStressField } from './RansSolverTypes';

export interface RansPhysicsModelData {
  readonly density: number;
  readonly molecularViscosity: number;
  readonly bodyForce: Vector3D;
  readonly activeClosureModel?: string;
  readonly wallTreatment?: string;
}

export class RansPhysicsModel {
  public readonly data: RansPhysicsModelData;

  constructor(data: RansPhysicsModelData) {
    this.data = Object.freeze({ ...data });
    this.validate();
  }

  private validate(): void {
    if (this.data.density <= 0) throw new Error('Density must be positive');
    if (this.data.molecularViscosity <= 0) throw new Error('Molecular viscosity must be positive');
  }
}
