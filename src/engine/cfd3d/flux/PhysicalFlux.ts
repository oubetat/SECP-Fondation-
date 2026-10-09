/**
 * SECP Industrial OS v2 — Physical Flux (3D Euler Inviscid)
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, FluxDiagnostic, Vector3 } from './FluxTypes';
import { FluxStateEngine } from './FluxState';
import { FluxDiagnosticsHelper } from './FluxDiagnostics';

export class PhysicalFluxEngine {

  /**
   * Computes the physical 3D Euler flux vector projected onto face normal.
   */
  public static computePhysicalFlux(
    state: ConservativeState,
    normal: Vector3,
    physicsModel: PhysicsModel
  ): FluxResult {
    const diagnostics: FluxDiagnostic[] = [];

    // 1. Validate normal vector
    if (!FluxDiagnosticsHelper.isFiniteVector3(normal)) {
      diagnostics.push(FluxDiagnostic.NON_FINITE_VALUE);
      diagnostics.push(FluxDiagnostic.ZERO_NORMAL);
      return this.invalidFlux('PHYSICAL_FLUX_EULER_3D', diagnostics);
    }

    const normLen = FluxDiagnosticsHelper.vectorLength(normal);
    if (normLen <= 1e-15) {
      diagnostics.push(FluxDiagnostic.ZERO_NORMAL);
      return this.invalidFlux('PHYSICAL_FLUX_EULER_3D', diagnostics);
    }

    // Normalize normal vector if length != 1
    const nX = normal[0] / normLen;
    const nY = normal[1] / normLen;
    const nZ = normal[2] / normLen;

    // 2. Validate physics model
    if (!physicsModel || physicsModel.modelType !== 'EULER_3D') {
      diagnostics.push(FluxDiagnostic.UNSUPPORTED_MODEL);
      return this.invalidFlux('PHYSICAL_FLUX_EULER_3D', diagnostics);
    }

    // 3. Validate state
    const stateVal = FluxStateEngine.validateConservativeState(state, physicsModel);
    if (!stateVal.valid) {
      return this.invalidFlux('PHYSICAL_FLUX_EULER_3D', stateVal.diagnostics);
    }

    // 4. Compute primitive quantities
    const rho = state.rho;
    const u = state.rhoU / rho;
    const v = state.rhoV / rho;
    const w = state.rhoW / rho;
    const qSq = u * u + v * v + w * w;

    const gamma = physicsModel.gamma;
    const eInt = (state.rhoE / rho) - 0.5 * qSq;
    const p = (gamma - 1) * rho * eInt;

    if (p <= 0) {
      diagnostics.push(FluxDiagnostic.NON_POSITIVE_PRESSURE);
      return this.invalidFlux('PHYSICAL_FLUX_EULER_3D', diagnostics);
    }

    // Speed of sound c = sqrt(gamma * p / rho)
    const c = Math.sqrt((gamma * p) / rho);
    const vN = u * nX + v * nY + w * nZ;
    const maxWaveSpeed = Math.abs(vN) + c;

    // 5. Compute Flux vector projected on unit normal n
    // F_mass = rho * vN
    // F_momX = rho * u * vN + p * nX
    // F_momY = rho * v * vN + p * nY
    // F_momZ = rho * w * vN + p * nZ
    // F_energy = (rhoE + p) * vN
    const fluxMass = rho * vN;
    const fluxMomX = state.rhoU * vN + p * nX;
    const fluxMomY = state.rhoV * vN + p * nY;
    const fluxMomZ = state.rhoW * vN + p * nZ;
    const fluxEnergy = (state.rhoE + p) * vN;

    const flux: ConservativeState = {
      rho: fluxMass,
      rhoU: fluxMomX,
      rhoV: fluxMomY,
      rhoW: fluxMomZ,
      rhoE: fluxEnergy
    };

    return {
      flux,
      schemeId: 'PHYSICAL_FLUX_EULER_3D',
      validity: true,
      diagnostics: [],
      waveSpeed: maxWaveSpeed,
      evidenceMetadata: {
        normalUnit: [nX, nY, nZ],
        normalLength: normLen,
        speedOfSound: c,
        normalVelocity: vN
      }
    };
  }

  private static invalidFlux(schemeId: string, diagnostics: FluxDiagnostic[]): FluxResult {
    return {
      flux: { rho: NaN, rhoU: NaN, rhoV: NaN, rhoW: NaN, rhoE: NaN },
      schemeId,
      validity: false,
      diagnostics
    };
  }
}
