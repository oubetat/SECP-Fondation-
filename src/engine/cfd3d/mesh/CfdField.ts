/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — General CFD Mesh Interface
 */

import { Vector3 } from './CfdGeneralMeshTypes';

/**
 * CfdField: Generic container for physical variables on the mesh.
 */
export class CfdField<T> {
  private values: Map<string, T> = new Map();

  constructor(
    public readonly name: string,
    public readonly unit: string,
    public readonly mapping: 'CELL' | 'FACE' | 'NODE'
  ) {}

  public setValue(id: string, value: T): void {
    this.values.set(id, value);
  }

  public getValue(id: string): T {
    const val = this.values.get(id);
    if (val === undefined) throw new Error(`Field ${this.name} not initialized for ID ${id}`);
    return val;
  }

  public getAllValues(): Map<string, T> {
    return this.values;
  }
}

export class CfdScalarField extends CfdField<number> {
  constructor(name: string, unit: string, mapping: 'CELL' | 'FACE' | 'NODE' = 'CELL') {
    super(name, unit, mapping);
  }
}

export class CfdVectorField extends CfdField<Vector3> {
  constructor(name: string, unit: string, mapping: 'CELL' | 'FACE' | 'NODE' = 'CELL') {
    super(name, unit, mapping);
  }
}
