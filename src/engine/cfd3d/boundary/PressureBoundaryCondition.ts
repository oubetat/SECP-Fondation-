/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Pressure Boundary Condition
 */

import {
  BoundaryConditionIdentity,
  BoundaryConditionType,
  BoundaryFieldType,
  PhysicsDomain,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryField } from './BoundaryField';

export interface PressureBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class PressureBoundaryCondition implements BoundaryConditionIdentity {
  public readonly boundaryConditionId: string;
  public readonly boundaryPatchId: string;
  public readonly physicsDomain: PhysicsDomain;
  public readonly fieldType: BoundaryFieldType = BoundaryFieldType.PRESSURE;
  public readonly conditionType: BoundaryConditionType;
  public readonly formulationVersion: string;
  public readonly parameters: {
    readonly value?: number;
    readonly referenceValue?: number;
  };
  public readonly units: string;
  public readonly referenceFrame: 'GLOBAL_STATIONARY' | 'MOVING_WALL' | 'LOCAL_SURFACE' = 'GLOBAL_STATIONARY';
  public readonly timeDefinition: 'STEADY' | 'TRANSIENT' = 'STEADY';
  public readonly spatialDefinition: 'UNIFORM' | 'PROFILE' | 'FIELD' = 'UNIFORM';
  public readonly source: string;
  public readonly revision: number;
  public readonly provenance: {
    readonly source: string;
    readonly revision: number;
    readonly timestamp: string;
    readonly hash: string;
  };

  constructor(
    boundaryConditionId: string,
    boundaryPatchId: string,
    conditionType: BoundaryConditionType,
    pressureValue: number = 0,
    referenceValue?: number,
    physicsDomain: PhysicsDomain = PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES,
    units: string = 'Pa'
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.boundaryPatchId = boundaryPatchId;
    this.conditionType = conditionType;
    this.physicsDomain = physicsDomain;
    this.units = units;
    this.formulationVersion = '1.0.0';
    this.parameters = Object.freeze({
      value: pressureValue,
      referenceValue
    });
    this.source = 'PressureBoundaryCondition';
    this.revision = 1;
    this.provenance = Object.freeze({
      source: this.source,
      revision: this.revision,
      timestamp: '2026-08-19T00:00:00.000Z',
      hash: `secp060-press-${boundaryConditionId}`
    });
  }

  public validate(): PressureBCValidationResult {
    const diagnostics: string[] = [];

    const validPressureTypes = [
      BoundaryConditionType.FIXED_PRESSURE,
      BoundaryConditionType.PRESSURE_OUTLET,
      BoundaryConditionType.PRESSURE_INLET,
      BoundaryConditionType.ZERO_GRADIENT_OUTLET
    ];

    if (!validPressureTypes.includes(this.conditionType)) {
      diagnostics.push(`Condition type '${this.conditionType}' is invalid for Pressure field.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    const fieldDef = BoundaryField.getFieldDefinition(BoundaryFieldType.PRESSURE);
    const pVal = this.parameters.value ?? 0;
    const valRes = fieldDef.validateValue(pVal, this.units);

    if (!valRes.valid) {
      return { valid: false, diagnostics: valRes.diagnostics, code: valRes.code };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
