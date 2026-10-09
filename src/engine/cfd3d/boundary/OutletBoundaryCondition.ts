/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Outlet Boundary Condition
 */

import {
  BoundaryConditionType,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface OutletBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class OutletBoundaryCondition {
  public readonly boundaryConditionId: string;
  public readonly patchId: string;
  public readonly outletType: BoundaryConditionType;
  public readonly pressure?: number;
  public readonly massFlowRate?: number;
  public readonly allowBackflow: boolean;

  constructor(
    boundaryConditionId: string,
    patchId: string,
    outletType: BoundaryConditionType,
    params: {
      pressure?: number;
      massFlowRate?: number;
      allowBackflow?: boolean;
    } = {}
  ) {
    this.boundaryConditionId = boundaryConditionId;
    this.patchId = patchId;
    this.outletType = outletType;
    this.pressure = params.pressure;
    this.massFlowRate = params.massFlowRate;
    this.allowBackflow = params.allowBackflow ?? false;
  }

  public validateFlowDirection(velocity: Vector3D, outwardNormal: Vector3D): OutletBCValidationResult {
    // Outward flux: u . n
    const flux = velocity[0] * outwardNormal[0] + velocity[1] * outwardNormal[1] + velocity[2] * outwardNormal[2];

    if (flux < 0 && !this.allowBackflow) {
      return {
        valid: false,
        diagnostics: [`Backflow detected at outlet patch '${this.patchId}' (flux ${flux.toExponential(3)} m/s) when allowBackflow is false.`],
        code: BoundaryDiagnosticCode.BOUNDARY_FLUX_MISMATCH
      };
    }

    return { valid: true, diagnostics: [] };
  }
}
