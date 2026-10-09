/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Value Container
 */

import { Vector3D } from './BoundaryConditionTypes';

export class BoundaryValue {
  public readonly scalarValue?: number;
  public readonly vectorValue?: Vector3D;
  public readonly units: string;

  constructor(value: number | Vector3D, units: string) {
    if (Array.isArray(value)) {
      if (value.length !== 3 || !value.every(v => typeof v === 'number' && Number.isFinite(v))) {
        throw new Error(`Invalid vector value: [${value.join(', ')}]`);
      }
      this.vectorValue = Object.freeze([...value]) as Vector3D;
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Invalid scalar value: ${value}`);
      }
      this.scalarValue = value;
    }
    this.units = units.trim();
  }

  public isVector(): boolean {
    return this.vectorValue !== undefined;
  }

  public getAsVector(): Vector3D {
    if (!this.vectorValue) {
      throw new Error('BoundaryValue is a scalar, not a vector.');
    }
    return this.vectorValue;
  }

  public getAsScalar(): number {
    if (this.scalarValue === undefined) {
      throw new Error('BoundaryValue is a vector, not a scalar.');
    }
    return this.scalarValue;
  }
}
