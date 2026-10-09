/**
 * SECP Industrial OS v2 — Flux Boundary Handler
 * PATCH-053: Flux Framework
 */

import { BoundaryType } from '../mesh/CFDMeshTypes';
import { ConservativeState, PhysicsModel, BoundaryFluxResult, BoundaryCapability, FluxDiagnostic, Vector3 } from './FluxTypes';
import { PhysicalFluxEngine } from './PhysicalFlux';
import { FluxStateEngine } from './FluxState';
import { FluxDiagnosticsHelper } from './FluxDiagnostics';

export class FluxBoundaryHandler {

  public static getBoundaryCapability(boundaryType: BoundaryType | string): BoundaryCapability {
    switch (boundaryType) {
      case BoundaryType.WALL:
      case BoundaryType.INLET:
      case BoundaryType.OUTLET:
      case BoundaryType.SYMMETRY:
        return 'SUPPORTED';
      case BoundaryType.PERIODIC:
        return 'PARTIAL';
      default:
        return 'UNSUPPORTED';
    }
  }

  /**
   * Computes boundary flux for a given boundary condition type.
   */
  public static computeBoundaryFlux(
    boundaryType: BoundaryType | string,
    interiorState: ConservativeState,
    boundaryState: ConservativeState | null,
    outwardNormal: Vector3,
    physicsModel: PhysicsModel
  ): BoundaryFluxResult {
    const capability = this.getBoundaryCapability(boundaryType);

    if (capability === 'UNSUPPORTED') {
      return {
        capability,
        fluxResult: {
          flux: { rho: NaN, rhoU: NaN, rhoV: NaN, rhoW: NaN, rhoE: NaN },
          schemeId: 'BOUNDARY_FLUX_HANDLER',
          validity: false,
          diagnostics: [FluxDiagnostic.UNSUPPORTED_MODEL]
        },
        diagnostics: [FluxDiagnostic.UNSUPPORTED_MODEL]
      };
    }

    // Validate interior state
    const intVal = FluxStateEngine.validateConservativeState(interiorState, physicsModel);
    if (!intVal.valid) {
      return {
        capability,
        fluxResult: {
          flux: { rho: NaN, rhoU: NaN, rhoV: NaN, rhoW: NaN, rhoE: NaN },
          schemeId: 'BOUNDARY_FLUX_HANDLER',
          validity: false,
          diagnostics: intVal.diagnostics
        },
        diagnostics: intVal.diagnostics
      };
    }

    const normNormalized = FluxDiagnosticsHelper.normalizeVector(outwardNormal);
    if (!normNormalized) {
      return {
        capability,
        fluxResult: {
          flux: { rho: NaN, rhoU: NaN, rhoV: NaN, rhoW: NaN, rhoE: NaN },
          schemeId: 'BOUNDARY_FLUX_HANDLER',
          validity: false,
          diagnostics: [FluxDiagnostic.ZERO_NORMAL]
        },
        diagnostics: [FluxDiagnostic.ZERO_NORMAL]
      };
    }

    const [nX, nY, nZ] = normNormalized;

    // Boundary-specific physics
    if (boundaryType === BoundaryType.WALL || boundaryType === BoundaryType.SYMMETRY) {
      // Slip Wall / Symmetry: Normal velocity V_n = 0
      // Mass flux = 0, Energy flux = 0
      // Momentum flux = p * n
      const rho = interiorState.rho;
      const u = interiorState.rhoU / rho;
      const v = interiorState.rhoV / rho;
      const w = interiorState.rhoW / rho;
      const qSq = u * u + v * v + w * w;
      const gamma = physicsModel.gamma;
      const eInt = (interiorState.rhoE / rho) - 0.5 * qSq;
      const p = (gamma - 1) * rho * eInt;

      const wallFlux: ConservativeState = {
        rho: 0,
        rhoU: p * nX,
        rhoV: p * nY,
        rhoW: p * nZ,
        rhoE: 0
      };

      return {
        capability: 'SUPPORTED',
        fluxResult: {
          flux: wallFlux,
          schemeId: 'BOUNDARY_SLIP_WALL',
          validity: true,
          diagnostics: []
        },
        diagnostics: []
      };
    }

    if (boundaryType === BoundaryType.INLET || boundaryType === BoundaryType.OUTLET || boundaryType === BoundaryType.PERIODIC) {
      const stateToUse = boundaryState ?? interiorState;
      const pFlux = PhysicalFluxEngine.computePhysicalFlux(stateToUse, outwardNormal, physicsModel);

      return {
        capability,
        fluxResult: pFlux,
        diagnostics: pFlux.diagnostics
      };
    }

    return {
      capability: 'UNSUPPORTED',
      fluxResult: {
        flux: { rho: NaN, rhoU: NaN, rhoV: NaN, rhoW: NaN, rhoE: NaN },
        schemeId: 'BOUNDARY_FLUX_HANDLER',
        validity: false,
        diagnostics: [FluxDiagnostic.UNSUPPORTED_MODEL]
      },
      diagnostics: [FluxDiagnostic.UNSUPPORTED_MODEL]
    };
  }
}
