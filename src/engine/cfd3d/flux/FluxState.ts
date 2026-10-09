/**
 * SECP Industrial OS v2 — Flux State Transformations & Validation
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PrimitiveState, PhysicsModel, FluxDiagnostic } from './FluxTypes';
import { FluxDiagnosticsHelper } from './FluxDiagnostics';

export class FluxStateEngine {

  /**
   * Validates primitive state for thermodynamic and numerical integrity.
   */
  public static validatePrimitiveState(
    p: PrimitiveState,
    physicsModel?: PhysicsModel
  ): { valid: boolean; diagnostics: FluxDiagnostic[] } {
    const diagnostics: FluxDiagnostic[] = [];

    if (
      !FluxDiagnosticsHelper.isFiniteNumber(p.rho) ||
      !FluxDiagnosticsHelper.isFiniteNumber(p.u) ||
      !FluxDiagnosticsHelper.isFiniteNumber(p.v) ||
      !FluxDiagnosticsHelper.isFiniteNumber(p.w) ||
      !FluxDiagnosticsHelper.isFiniteNumber(p.p) ||
      !FluxDiagnosticsHelper.isFiniteNumber(p.T)
    ) {
      diagnostics.push(FluxDiagnostic.NON_FINITE_VALUE);
      diagnostics.push(FluxDiagnostic.INVALID_STATE);
      return { valid: false, diagnostics };
    }

    if (p.rho <= 0) {
      diagnostics.push(FluxDiagnostic.NEGATIVE_DENSITY);
    }

    if (p.p <= 0) {
      diagnostics.push(FluxDiagnostic.NON_POSITIVE_PRESSURE);
    }

    if (p.T <= 0) {
      diagnostics.push(FluxDiagnostic.INVALID_STATE);
    }

    if (diagnostics.length > 0) {
      return { valid: false, diagnostics };
    }

    return { valid: true, diagnostics: [] };
  }

  /**
   * Validates conservative state for thermodynamic and numerical integrity.
   */
  public static validateConservativeState(
    c: ConservativeState,
    physicsModel?: PhysicsModel
  ): { valid: boolean; diagnostics: FluxDiagnostic[] } {
    const diagnostics: FluxDiagnostic[] = [];

    if (
      !FluxDiagnosticsHelper.isFiniteNumber(c.rho) ||
      !FluxDiagnosticsHelper.isFiniteNumber(c.rhoU) ||
      !FluxDiagnosticsHelper.isFiniteNumber(c.rhoV) ||
      !FluxDiagnosticsHelper.isFiniteNumber(c.rhoW) ||
      !FluxDiagnosticsHelper.isFiniteNumber(c.rhoE)
    ) {
      diagnostics.push(FluxDiagnostic.NON_FINITE_VALUE);
      diagnostics.push(FluxDiagnostic.INVALID_STATE);
      return { valid: false, diagnostics };
    }

    if (c.rho <= 0) {
      diagnostics.push(FluxDiagnostic.NEGATIVE_DENSITY);
      return { valid: false, diagnostics };
    }

    const gamma = physicsModel?.gamma ?? 1.4;
    const u = c.rhoU / c.rho;
    const v = c.rhoV / c.rho;
    const w = c.rhoW / c.rho;
    const qSq = u * u + v * v + w * w;

    const eInt = (c.rhoE / c.rho) - 0.5 * qSq;
    const p = (gamma - 1) * c.rho * eInt;

    if (p <= 0 || !FluxDiagnosticsHelper.isFiniteNumber(p)) {
      diagnostics.push(FluxDiagnostic.NON_POSITIVE_PRESSURE);
    }

    if (diagnostics.length > 0) {
      return { valid: false, diagnostics };
    }

    return { valid: true, diagnostics: [] };
  }

  /**
   * Converts PrimitiveState -> ConservativeState.
   */
  public static primitiveToConservative(p: PrimitiveState, physicsModel: PhysicsModel): ConservativeState {
    const validation = this.validatePrimitiveState(p, physicsModel);
    if (!validation.valid) {
      throw new Error(`Invalid PrimitiveState: ${FluxDiagnosticsHelper.formatDiagnostics(validation.diagnostics)}`);
    }

    const gamma = physicsModel.gamma;
    const qSq = p.u * p.u + p.v * p.v + p.w * p.w;
    const eInt = p.p / (p.rho * (gamma - 1));
    const totalEnergySpecific = eInt + 0.5 * qSq;
    const rhoE = p.rho * totalEnergySpecific;

    return {
      rho: p.rho,
      rhoU: p.rho * p.u,
      rhoV: p.rho * p.v,
      rhoW: p.rho * p.w,
      rhoE
    };
  }

  /**
   * Converts ConservativeState -> PrimitiveState.
   */
  public static conservativeToPrimitive(c: ConservativeState, physicsModel: PhysicsModel): PrimitiveState {
    const validation = this.validateConservativeState(c, physicsModel);
    if (!validation.valid) {
      throw new Error(`Invalid ConservativeState: ${FluxDiagnosticsHelper.formatDiagnostics(validation.diagnostics)}`);
    }

    const gamma = physicsModel.gamma;
    const R = physicsModel.gasConstant;

    const u = c.rhoU / c.rho;
    const v = c.rhoV / c.rho;
    const w = c.rhoW / c.rho;
    const qSq = u * u + v * v + w * w;

    const eInt = (c.rhoE / c.rho) - 0.5 * qSq;
    const p = (gamma - 1) * c.rho * eInt;
    const T = p / (c.rho * R);

    return {
      rho: c.rho,
      u,
      v,
      w,
      p,
      T
    };
  }
}
