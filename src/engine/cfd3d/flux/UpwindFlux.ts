/**
 * SECP Industrial OS v2 — Baseline Upwind Flux Scheme (Rusanov / Local Lax-Friedrichs)
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, FluxDiagnostic, Vector3 } from './FluxTypes';
import { NumericalFluxScheme } from './FluxScheme';
import { PhysicalFluxEngine } from './PhysicalFlux';

export class UpwindFluxScheme implements NumericalFluxScheme {
  public readonly id = 'RUSANOV_UPWIND_FLUX_EULER_3D';
  public readonly version = '1.0.0';

  public compute(
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    physicalModel: PhysicsModel
  ): FluxResult {
    const fL = PhysicalFluxEngine.computePhysicalFlux(left, normal, physicalModel);
    if (!fL.validity) {
      return fL;
    }

    const fR = PhysicalFluxEngine.computePhysicalFlux(right, normal, physicalModel);
    if (!fR.validity) {
      return fR;
    }

    const maxWaveSpeed = Math.max(fL.waveSpeed ?? 0, fR.waveSpeed ?? 0);

    // Rusanov / Local Lax-Friedrichs dissipation term: 0.5 * S_max * (U_R - U_L)
    const flux: ConservativeState = {
      rho: 0.5 * (fL.flux.rho + fR.flux.rho) - 0.5 * maxWaveSpeed * (right.rho - left.rho),
      rhoU: 0.5 * (fL.flux.rhoU + fR.flux.rhoU) - 0.5 * maxWaveSpeed * (right.rhoU - left.rhoU),
      rhoV: 0.5 * (fL.flux.rhoV + fR.flux.rhoV) - 0.5 * maxWaveSpeed * (right.rhoV - left.rhoV),
      rhoW: 0.5 * (fL.flux.rhoW + fR.flux.rhoW) - 0.5 * maxWaveSpeed * (right.rhoW - left.rhoW),
      rhoE: 0.5 * (fL.flux.rhoE + fR.flux.rhoE) - 0.5 * maxWaveSpeed * (right.rhoE - left.rhoE)
    };

    return {
      flux,
      schemeId: this.id,
      validity: true,
      diagnostics: [],
      waveSpeed: maxWaveSpeed,
      evidenceMetadata: {
        schemeVersion: this.version,
        waveSpeedLeft: fL.waveSpeed,
        waveSpeedRight: fR.waveSpeed,
        maxWaveSpeed
      }
    };
  }
}
