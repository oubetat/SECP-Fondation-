/**
 * SECP Industrial OS v2 — Central Flux Scheme
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, FluxDiagnostic, Vector3 } from './FluxTypes';
import { NumericalFluxScheme } from './FluxScheme';
import { PhysicalFluxEngine } from './PhysicalFlux';
import { FluxDiagnosticsHelper } from './FluxDiagnostics';

export class CentralFluxScheme implements NumericalFluxScheme {
  public readonly id = 'CENTRAL_FLUX_EULER_3D';
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

    const waveSpeed = Math.max(fL.waveSpeed ?? 0, fR.waveSpeed ?? 0);

    const flux: ConservativeState = {
      rho: 0.5 * (fL.flux.rho + fR.flux.rho),
      rhoU: 0.5 * (fL.flux.rhoU + fR.flux.rhoU),
      rhoV: 0.5 * (fL.flux.rhoV + fR.flux.rhoV),
      rhoW: 0.5 * (fL.flux.rhoW + fR.flux.rhoW),
      rhoE: 0.5 * (fL.flux.rhoE + fR.flux.rhoE)
    };

    return {
      flux,
      schemeId: this.id,
      validity: true,
      diagnostics: [],
      waveSpeed,
      evidenceMetadata: {
        schemeVersion: this.version,
        waveSpeedLeft: fL.waveSpeed,
        waveSpeedRight: fR.waveSpeed
      }
    };
  }
}
