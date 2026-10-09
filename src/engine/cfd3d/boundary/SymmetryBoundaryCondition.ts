/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Symmetry Boundary Condition
 */

import { Vector3D, BoundaryDiagnosticCode } from './BoundaryConditionTypes';

export interface SymmetryValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class SymmetryBoundaryCondition {
  public readonly boundaryConditionId: string;
  public readonly patchId: string;

  constructor(boundaryConditionId: string, patchId: string) {
    this.boundaryConditionId = boundaryConditionId;
    this.patchId = patchId;
  }

  public enforceSymmetryVelocity(interiorVelocity: Vector3D, outwardNormal: Vector3D): Vector3D {
    // Normal component: u_n = u . n
    const dot = interiorVelocity[0] * outwardNormal[0] +
                interiorVelocity[1] * outwardNormal[1] +
                interiorVelocity[2] * outwardNormal[2];

    // Remove normal component: u_sym = u - (u . n) * n
    const ux = interiorVelocity[0] - dot * outwardNormal[0];
    const uy = interiorVelocity[1] - dot * outwardNormal[1];
    const uz = interiorVelocity[2] - dot * outwardNormal[2];

    return [ux, uy, uz];
  }

  public validateNormalVelocity(velocity: Vector3D, normal: Vector3D): SymmetryValidationResult {
    const dot = Math.abs(
      velocity[0] * normal[0] +
      velocity[1] * normal[1] +
      velocity[2] * normal[2]
    );

    if (dot > 1e-6) {
      return {
        valid: false,
        diagnostics: [`Normal velocity component on symmetry plane non-zero (${dot.toExponential(3)} m/s).`],
        code: BoundaryDiagnosticCode.BOUNDARY_FLUX_MISMATCH
      };
    }

    return { valid: true, diagnostics: [] };
  }
}
