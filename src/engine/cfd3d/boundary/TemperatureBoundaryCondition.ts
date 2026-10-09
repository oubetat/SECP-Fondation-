/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Temperature Boundary Condition
 */

import {
  BoundaryConditionIdentity,
  BoundaryConditionType,
  BoundaryFieldType,
  PhysicsDomain,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryField } from './BoundaryField';

export interface TemperatureBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class TemperatureBoundaryCondition implements BoundaryConditionIdentity {
  public readonly boundaryConditionId: string;
  public readonly boundaryPatchId: string;
  public readonly physicsDomain: PhysicsDomain;
  public readonly fieldType: BoundaryFieldType = BoundaryFieldType.TEMPERATURE;
  public readonly conditionType: BoundaryConditionType;
  public readonly formulationVersion: string;
  public readonly parameters: {
    readonly value?: number;
    readonly heatFlux?: number;
    readonly heatTransferCoefficient?: number;
    readonly ambientTemperature?: number;
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
    temperatureValue?: number,
    heatFlux?: number,
    heatTransferCoefficient?: number,
    ambientTemperature?: number,
    physicsDomain: PhysicsDomain = PhysicsDomain.HEAT_TRANSFER,
    units: string = 'K'
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.boundaryPatchId = boundaryPatchId;
    this.conditionType = conditionType;
    this.physicsDomain = physicsDomain;
    this.units = units;
    this.formulationVersion = '1.0.0';
    this.parameters = Object.freeze({
      value: temperatureValue,
      heatFlux,
      heatTransferCoefficient,
      ambientTemperature
    });
    this.source = 'TemperatureBoundaryCondition';
    this.revision = 1;
    this.provenance = Object.freeze({
      source: this.source,
      revision: this.revision,
      timestamp: '2026-08-19T00:00:00.000Z',
      hash: `secp060-temp-${boundaryConditionId}`
    });
  }

  public validate(): TemperatureBCValidationResult {
    const diagnostics: string[] = [];

    const validTempTypes = [
      BoundaryConditionType.FIXED_TEMPERATURE,
      BoundaryConditionType.ADIABATIC_WALL,
      BoundaryConditionType.FIXED_HEAT_FLUX,
      BoundaryConditionType.CONVECTIVE_HEAT_TRANSFER
    ];

    if (!validTempTypes.includes(this.conditionType)) {
      diagnostics.push(`Condition type '${this.conditionType}' is invalid for Temperature field.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    if (this.conditionType === BoundaryConditionType.FIXED_TEMPERATURE) {
      if (this.parameters.value === undefined || this.parameters.value <= 0 || !Number.isFinite(this.parameters.value)) {
        diagnostics.push(`Fixed temperature value must be a positive finite number (received ${this.parameters.value} K).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
      const fieldDef = BoundaryField.getFieldDefinition(BoundaryFieldType.TEMPERATURE);
      const res = fieldDef.validateValue(this.parameters.value, this.units);
      if (!res.valid) {
        return { valid: false, diagnostics: res.diagnostics, code: res.code };
      }
    } else if (this.conditionType === BoundaryConditionType.FIXED_HEAT_FLUX) {
      if (this.parameters.heatFlux === undefined || !Number.isFinite(this.parameters.heatFlux)) {
        diagnostics.push(`Fixed heat flux must be a finite number (received ${this.parameters.heatFlux}).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    } else if (this.conditionType === BoundaryConditionType.CONVECTIVE_HEAT_TRANSFER) {
      if (
        this.parameters.heatTransferCoefficient === undefined ||
        this.parameters.heatTransferCoefficient < 0 ||
        !Number.isFinite(this.parameters.heatTransferCoefficient) ||
        this.parameters.ambientTemperature === undefined ||
        this.parameters.ambientTemperature <= 0 ||
        !Number.isFinite(this.parameters.ambientTemperature)
      ) {
        diagnostics.push(`Convective heat transfer parameters (h=${this.parameters.heatTransferCoefficient}, T_inf=${this.parameters.ambientTemperature}) are invalid.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
