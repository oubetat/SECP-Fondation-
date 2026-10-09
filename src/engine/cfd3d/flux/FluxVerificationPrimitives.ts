/**
 * SECP Industrial OS v2 — Verification Primitives for Flux Framework
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, FluxDiagnostic, Vector3 } from './FluxTypes';
import { NumericalFluxScheme } from './FluxScheme';
import { NumericalFluxEngine } from './NumericalFlux';
import { PhysicalFluxEngine } from './PhysicalFlux';
import { FluxDiagnosticsHelper } from './FluxDiagnostics';

export interface FluxVerificationReport {
  readonly primitive: string;
  readonly passed: boolean;
  readonly diagnostics: FluxDiagnostic[];
  readonly maxError: number;
  readonly tolerance: number;
  readonly details?: Record<string, any>;
}

export class FluxVerificationPrimitives {

  /**
   * Verifies that for any interior face: F_owner + F_neighbor = 0 (Conservation)
   */
  public static verifyFluxConservation(
    scheme: NumericalFluxScheme,
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    physicsModel: PhysicsModel,
    tolerance: number = 1e-10
  ): FluxVerificationReport {
    const { fluxOwner, fluxNeighbor } = NumericalFluxEngine.computeInternalFaceFluxPair(
      left, right, normal, scheme, physicsModel
    );

    if (!fluxOwner.validity || !fluxNeighbor.validity) {
      return {
        primitive: 'verifyFluxConservation',
        passed: false,
        diagnostics: [...fluxOwner.diagnostics, ...fluxNeighbor.diagnostics],
        maxError: Infinity,
        tolerance
      };
    }

    const errMass = Math.abs(fluxOwner.flux.rho + fluxNeighbor.flux.rho);
    const errMomX = Math.abs(fluxOwner.flux.rhoU + fluxNeighbor.flux.rhoU);
    const errMomY = Math.abs(fluxOwner.flux.rhoV + fluxNeighbor.flux.rhoV);
    const errMomZ = Math.abs(fluxOwner.flux.rhoW + fluxNeighbor.flux.rhoW);
    const errEnergy = Math.abs(fluxOwner.flux.rhoE + fluxNeighbor.flux.rhoE);

    const maxError = Math.max(errMass, errMomX, errMomY, errMomZ, errEnergy);
    const passed = maxError <= tolerance;

    return {
      primitive: 'verifyFluxConservation',
      passed,
      diagnostics: passed ? [] : [FluxDiagnostic.FLUX_NON_CONSERVATIVE],
      maxError,
      tolerance,
      details: { errMass, errMomX, errMomY, errMomZ, errEnergy }
    };
  }

  /**
   * Verifies symmetry: F(L, R, n) = -F(R, L, -n)
   */
  public static verifyFluxSymmetry(
    scheme: NumericalFluxScheme,
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    physicsModel: PhysicsModel,
    tolerance: number = 1e-10
  ): FluxVerificationReport {
    const normalRev: Vector3 = [-normal[0], -normal[1], -normal[2]];

    const fForward = scheme.compute(left, right, normal, physicsModel);
    const fReversed = scheme.compute(right, left, normalRev, physicsModel);

    if (!fForward.validity || !fReversed.validity) {
      return {
        primitive: 'verifyFluxSymmetry',
        passed: false,
        diagnostics: [...fForward.diagnostics, ...fReversed.diagnostics],
        maxError: Infinity,
        tolerance
      };
    }

    const errMass = Math.abs(fForward.flux.rho + fReversed.flux.rho);
    const errMomX = Math.abs(fForward.flux.rhoU + fReversed.flux.rhoU);
    const errMomY = Math.abs(fForward.flux.rhoV + fReversed.flux.rhoV);
    const errMomZ = Math.abs(fForward.flux.rhoW + fReversed.flux.rhoW);
    const errEnergy = Math.abs(fForward.flux.rhoE + fReversed.flux.rhoE);

    const maxError = Math.max(errMass, errMomX, errMomY, errMomZ, errEnergy);
    const passed = maxError <= tolerance;

    return {
      primitive: 'verifyFluxSymmetry',
      passed,
      diagnostics: passed ? [] : [FluxDiagnostic.FLUX_SYMMETRY_FAILURE],
      maxError,
      tolerance
    };
  }

  /**
   * Verifies uniform flow behavior: L = R => Numerical Flux equals Physical Flux
   */
  public static verifyUniformState(
    scheme: NumericalFluxScheme,
    state: ConservativeState,
    normal: Vector3,
    physicsModel: PhysicsModel,
    tolerance: number = 1e-10
  ): FluxVerificationReport {
    const numFlux = scheme.compute(state, state, normal, physicsModel);
    const physFlux = PhysicalFluxEngine.computePhysicalFlux(state, normal, physicsModel);

    if (!numFlux.validity || !physFlux.validity) {
      return {
        primitive: 'verifyUniformState',
        passed: false,
        diagnostics: [...numFlux.diagnostics, ...physFlux.diagnostics],
        maxError: Infinity,
        tolerance
      };
    }

    const errMass = Math.abs(numFlux.flux.rho - physFlux.flux.rho);
    const errMomX = Math.abs(numFlux.flux.rhoU - physFlux.flux.rhoU);
    const errMomY = Math.abs(numFlux.flux.rhoV - physFlux.flux.rhoV);
    const errMomZ = Math.abs(numFlux.flux.rhoW - physFlux.flux.rhoW);
    const errEnergy = Math.abs(numFlux.flux.rhoE - physFlux.flux.rhoE);

    const maxError = Math.max(errMass, errMomX, errMomY, errMomZ, errEnergy);
    const passed = maxError <= tolerance;

    return {
      primitive: 'verifyUniformState',
      passed,
      diagnostics: passed ? [] : [FluxDiagnostic.FLUX_NON_CONSERVATIVE],
      maxError,
      tolerance
    };
  }

  /**
   * Verifies that flux result contains finite values and no overflow/NaN
   */
  public static verifyFluxFinite(fluxResult: FluxResult): FluxVerificationReport {
    if (!fluxResult || !fluxResult.validity) {
      return {
        primitive: 'verifyFluxFinite',
        passed: false,
        diagnostics: fluxResult?.diagnostics ?? [FluxDiagnostic.INVALID_STATE],
        maxError: Infinity,
        tolerance: 0
      };
    }

    const f = fluxResult.flux;
    const isFinite =
      FluxDiagnosticsHelper.isFiniteNumber(f.rho) &&
      FluxDiagnosticsHelper.isFiniteNumber(f.rhoU) &&
      FluxDiagnosticsHelper.isFiniteNumber(f.rhoV) &&
      FluxDiagnosticsHelper.isFiniteNumber(f.rhoW) &&
      FluxDiagnosticsHelper.isFiniteNumber(f.rhoE);

    return {
      primitive: 'verifyFluxFinite',
      passed: isFinite,
      diagnostics: isFinite ? [] : [FluxDiagnostic.NON_FINITE_VALUE],
      maxError: isFinite ? 0 : Infinity,
      tolerance: 0
    };
  }

  /**
   * Verifies determinism: Replay identical computation 5 times, check exact byte/value equality
   */
  public static verifyFluxDeterminism(
    scheme: NumericalFluxScheme,
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    physicsModel: PhysicsModel
  ): FluxVerificationReport {
    const runs: FluxResult[] = [];
    for (let i = 0; i < 5; i++) {
      runs.push(scheme.compute(left, right, normal, physicsModel));
    }

    const base = runs[0];
    let passed = true;

    for (let i = 1; i < runs.length; i++) {
      const cur = runs[i];
      if (
        cur.validity !== base.validity ||
        cur.flux.rho !== base.flux.rho ||
        cur.flux.rhoU !== base.flux.rhoU ||
        cur.flux.rhoV !== base.flux.rhoV ||
        cur.flux.rhoW !== base.flux.rhoW ||
        cur.flux.rhoE !== base.flux.rhoE
      ) {
        passed = false;
        break;
      }
    }

    return {
      primitive: 'verifyFluxDeterminism',
      passed,
      diagnostics: passed ? [] : [FluxDiagnostic.FLUX_NON_CONSERVATIVE],
      maxError: passed ? 0 : 1.0,
      tolerance: 0
    };
  }
}
