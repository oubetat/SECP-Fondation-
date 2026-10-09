/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Velocity Boundary Condition
 */

import {
  BoundaryConditionIdentity,
  BoundaryConditionType,
  BoundaryFieldType,
  PhysicsDomain,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryField } from './BoundaryField';

export interface VelocityBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class VelocityBoundaryCondition implements BoundaryConditionIdentity {
  public readonly boundaryConditionId: string;
  public readonly boundaryPatchId: string;
  public readonly physicsDomain: PhysicsDomain;
  public readonly fieldType: BoundaryFieldType = BoundaryFieldType.VELOCITY;
  public readonly conditionType: BoundaryConditionType;
  public readonly formulationVersion: string;
  public readonly parameters: {
    readonly value?: Vector3D;
    readonly referenceValue?: number;
  };
  public readonly units: string;
  public readonly referenceFrame: 'GLOBAL_STATIONARY' | 'MOVING_WALL' | 'LOCAL_SURFACE';
  public readonly timeDefinition: 'STEADY' | 'TRANSIENT';
  public readonly spatialDefinition: 'UNIFORM' | 'PROFILE' | 'FIELD';
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
    velocityVector: Vector3D = [0, 0, 0],
    physicsDomain: PhysicsDomain = PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES,
    units: string = 'm/s',
    referenceFrame: 'GLOBAL_STATIONARY' | 'MOVING_WALL' | 'LOCAL_SURFACE' = 'GLOBAL_STATIONARY'
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.boundaryPatchId = boundaryPatchId;
    this.conditionType = conditionType;
    this.physicsDomain = physicsDomain;
    this.units = units;
    this.referenceFrame = referenceFrame;
    this.formulationVersion = '1.0.0';
    this.parameters = Object.freeze({ value: Object.freeze([...velocityVector]) as Vector3D });
    this.timeDefinition = 'STEADY';
    this.spatialDefinition = 'UNIFORM';
    this.source = 'VelocityBoundaryCondition';
    this.revision = 1;
    this.provenance = Object.freeze({
      source: this.source,
      revision: this.revision,
      timestamp: '2026-08-19T00:00:00.000Z',
      hash: `secp060-vel-${boundaryConditionId}`
    });
  }

  public validate(): VelocityBCValidationResult {
    const diagnostics: string[] = [];

    // Valid condition types for velocity
    const validVelocityTypes = [
      BoundaryConditionType.FIXED_VELOCITY,
      BoundaryConditionType.NO_SLIP_WALL,
      BoundaryConditionType.SLIP_WALL,
      BoundaryConditionType.SYMMETRY,
      BoundaryConditionType.VELOCITY_INLET
    ];

    if (!validVelocityTypes.includes(this.conditionType)) {
      diagnostics.push(`Condition type '${this.conditionType}' is invalid for Velocity field.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    // Units check via BoundaryField
    const fieldDef = BoundaryField.getFieldDefinition(BoundaryFieldType.VELOCITY);
    const val = this.parameters.value || [0, 0, 0];
    const valRes = fieldDef.validateValue(val, this.units);

    if (!valRes.valid) {
      return { valid: false, diagnostics: valRes.diagnostics, code: valRes.code };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
