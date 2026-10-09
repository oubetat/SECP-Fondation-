/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Inlet Boundary Condition
 */

import {
  BoundaryConditionType,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface InletBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class InletBoundaryCondition {
  public readonly boundaryConditionId: string;
  public readonly patchId: string;
  public readonly inletType: BoundaryConditionType;
  public readonly velocity?: Vector3D;
  public readonly massFlowRate?: number;
  public readonly pressure?: number;
  public readonly temperature?: number;
  public readonly density?: number;

  constructor(
    boundaryConditionId: string,
    patchId: string,
    inletType: BoundaryConditionType,
    params: {
      velocity?: Vector3D;
      massFlowRate?: number;
      pressure?: number;
      temperature?: number;
      density?: number;
    }
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.patchId = patchId;
    this.inletType = inletType;
    this.velocity = params.velocity ? Object.freeze([...params.velocity]) as Vector3D : undefined;
    this.massFlowRate = params.massFlowRate;
    this.pressure = params.pressure;
    this.temperature = params.temperature;
    this.density = params.density;
  }

  public validateConsistency(patchArea: number): InletBCValidationResult {
    const diagnostics: string[] = [];

    if (patchArea <= 0 || !Number.isFinite(patchArea)) {
      diagnostics.push(`Inlet patch area must be positive finite (${patchArea}).`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_PATCH };
    }

    // Velocity Inlet
    if (this.inletType === BoundaryConditionType.VELOCITY_INLET) {
      if (!this.velocity || !this.velocity.every(v => Number.isFinite(v))) {
        diagnostics.push(`Velocity inlet requires valid finite velocity vector.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
      }
    }

    // Mass-Flow Inlet
    if (this.inletType === BoundaryConditionType.MASS_FLOW_INLET) {
      if (this.massFlowRate === undefined || this.massFlowRate <= 0 || !Number.isFinite(this.massFlowRate)) {
        diagnostics.push(`Mass flow inlet requires positive finite mass flow rate (${this.massFlowRate}).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    }

    // Consistency check if BOTH velocity and mass flow rate are specified
    if (this.velocity && this.massFlowRate && this.density && this.density > 0) {
      const vMag = Math.sqrt(this.velocity[0] ** 2 + this.velocity[1] ** 2 + this.velocity[2] ** 2);
      const expectedMassFlow = this.density * vMag * patchArea;
      if (Math.abs(expectedMassFlow - this.massFlowRate) > 1e-4 * Math.max(expectedMassFlow, this.massFlowRate)) {
        diagnostics.push(`Contradictory velocity (${vMag} m/s) and mass flow rate (${this.massFlowRate} kg/s) for density ${this.density} kg/m^3 and area ${patchArea} m^2 (expected ${expectedMassFlow} kg/s).`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.CONFLICTING_BOUNDARY_CONDITIONS };
      }
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }
}
