/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Field Definition & Dimensional Identity
 */

import { BoundaryFieldType, Vector3D, BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface FieldValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class BoundaryField {
  public readonly fieldType: BoundaryFieldType;
  public readonly isVector: boolean;
  public readonly expectedUnits: string;
  public readonly dimensions: {
    readonly mass: number;
    readonly length: number;
    readonly time: number;
    readonly temperature: number;
  };
  public readonly minValidValue?: number;
  public readonly maxValidValue?: number;

  constructor(
    fieldType: BoundaryFieldType,
    isVector: boolean,
    expectedUnits: string,
    dimensions: { mass: number; length: number; time: number; temperature: number },
    minValidValue?: number,
    maxValidValue?: number
  ) {
    this.fieldType = fieldType;
    this.isVector = isVector;
    this.expectedUnits = expectedUnits;
    this.dimensions = Object.freeze({ ...dimensions });
    this.minValidValue = minValidValue;
    this.maxValidValue = maxValidValue;
  }

  public validateValue(value: number | Vector3D, units: string): FieldValidationResult {
    const diagnostics: string[] = [];

    // 1. Vector/Scalar type match
    if (this.isVector) {
      if (!Array.isArray(value) || value.length !== 3) {
        diagnostics.push(`Field '${this.fieldType}' expects 3D vector [x,y,z], received ${typeof value}.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
      const [v0, v1, v2] = value as Vector3D;
      if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2)) {
        diagnostics.push(`Field '${this.fieldType}' vector contains non-finite numbers ([${v0}, ${v1}, ${v2}]).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
      }
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        diagnostics.push(`Field '${this.fieldType}' expects scalar finite number, received ${value}.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
      }
      if (this.minValidValue !== undefined && value < this.minValidValue) {
        diagnostics.push(`Field '${this.fieldType}' value ${value} below minimum valid limit ${this.minValidValue}.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
      if (this.maxValidValue !== undefined && value > this.maxValidValue) {
        diagnostics.push(`Field '${this.fieldType}' value ${value} exceeds maximum valid limit ${this.maxValidValue}.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    }

    // 2. Units check
    if (units.toLowerCase() !== this.expectedUnits.toLowerCase()) {
      diagnostics.push(`Field '${this.fieldType}' expected units '${this.expectedUnits}', received '${units}'.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }

  public static getFieldDefinition(fieldType: BoundaryFieldType): BoundaryField {
    switch (fieldType) {
      case BoundaryFieldType.VELOCITY:
        return new BoundaryField(
          BoundaryFieldType.VELOCITY,
          true,
          'm/s',
          { mass: 0, length: 1, time: -1, temperature: 0 }
        );
      case BoundaryFieldType.PRESSURE:
        return new BoundaryField(
          BoundaryFieldType.PRESSURE,
          false,
          'pa',
          { mass: 1, length: -1, time: -2, temperature: 0 }
        );
      case BoundaryFieldType.TEMPERATURE:
        return new BoundaryField(
          BoundaryFieldType.TEMPERATURE,
          false,
          'k',
          { mass: 0, length: 0, time: 0, temperature: 1 },
          0 // K > 0
        );
      case BoundaryFieldType.INTERNAL_ENERGY:
      case BoundaryFieldType.TOTAL_ENERGY:
        return new BoundaryField(
          fieldType,
          false,
          'j/kg',
          { mass: 0, length: 2, time: -2, temperature: 0 }
        );
      case BoundaryFieldType.MASS_FLOW:
        return new BoundaryField(
          BoundaryFieldType.MASS_FLOW,
          false,
          'kg/s',
          { mass: 1, length: 0, time: -1, temperature: 0 }
        );
      case BoundaryFieldType.HEAT_FLUX:
        return new BoundaryField(
          BoundaryFieldType.HEAT_FLUX,
          false,
          'w/m^2',
          { mass: 1, length: 0, time: -3, temperature: 0 }
        );
      default:
        throw new Error(`Unsupported boundary field type: ${fieldType}`);
    }
  }
}
