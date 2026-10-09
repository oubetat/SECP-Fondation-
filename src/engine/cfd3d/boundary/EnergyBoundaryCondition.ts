/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Energy Boundary Condition & Material Linking
 */

import {
  BoundaryConditionIdentity,
  BoundaryConditionType,
  BoundaryFieldType,
  PhysicsDomain,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface EnergyBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export interface MaterialThermodynamics {
  readonly specificHeatCv: number; // J/(kg*K)
  readonly specificHeatCp: number; // J/(kg*K)
  readonly density: number;         // kg/m^3
}

export class EnergyBoundaryCondition implements BoundaryConditionIdentity {
  public readonly boundaryConditionId: string;
  public readonly boundaryPatchId: string;
  public readonly physicsDomain: PhysicsDomain;
  public readonly fieldType: BoundaryFieldType = BoundaryFieldType.TOTAL_ENERGY;
  public readonly conditionType: BoundaryConditionType;
  public readonly formulationVersion: string;
  public readonly parameters: {
    readonly value?: number;
    readonly heatFlux?: number;
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
    energyValue?: number,
    heatFlux?: number,
    physicsDomain: PhysicsDomain = PhysicsDomain.THERMAL_FLUID,
    units: string = 'J/kg'
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.boundaryPatchId = boundaryPatchId;
    this.conditionType = conditionType;
    this.physicsDomain = physicsDomain;
    this.units = units;
    this.formulationVersion = '1.0.0';
    this.parameters = Object.freeze({
      value: energyValue,
      heatFlux
    });
    this.source = 'EnergyBoundaryCondition';
    this.revision = 1;
    this.provenance = Object.freeze({
      source: this.source,
      revision: this.revision,
      timestamp: '2026-08-19T00:00:00.000Z',
      hash: `secp060-energy-${boundaryConditionId}`
    });
  }

  public validate(material?: MaterialThermodynamics): EnergyBCValidationResult {
    const diagnostics: string[] = [];

    if (!material || material.specificHeatCv <= 0 || !Number.isFinite(material.specificHeatCv)) {
      diagnostics.push(`Material thermodynamic relationship (specificHeatCv) is missing or unproven.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.ENERGY_BC_UNPROVEN };
    }

    if (this.parameters.value !== undefined) {
      if (!Number.isFinite(this.parameters.value) || this.parameters.value < 0) {
        diagnostics.push(`Energy value ${this.parameters.value} is non-finite or negative.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }

  public static convertTemperatureToInternalEnergy(temperature: number, material: MaterialThermodynamics): number {
    if (temperature <= 0 || !Number.isFinite(temperature)) {
      throw new Error(`Invalid temperature ${temperature} K for energy conversion.`);
    }
    if (!material || material.specificHeatCv <= 0) {
      throw new Error('Missing material specific heat Cv for energy conversion.');
    }
    return material.specificHeatCv * temperature;
  }
}
