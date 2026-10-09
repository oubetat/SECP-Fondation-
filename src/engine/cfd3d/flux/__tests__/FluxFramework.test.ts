/**
 * SECP Industrial OS v2 — Flux Framework Unit Tests
 * PATCH-053: Flux Framework
 */

import { describe, it, expect } from 'vitest';
import { 
  PhysicsModel, 
  PrimitiveState, 
  ConservativeState,
  FluxStateEngine,
  PhysicalFluxEngine,
  CentralFluxScheme,
  UpwindFluxScheme,
  FluxBoundaryHandler,
  FluxRegistry,
  FluxVerificationPrimitives,
  FluxEvidenceEngine,
  NumericalFluxEngine
} from '../index';
import { BoundaryType } from '../../mesh/CFDMeshTypes';

describe('PATCH-053: Flux Framework Core Tests', () => {

  const physicsModel: PhysicsModel = {
    modelType: 'EULER_3D',
    gamma: 1.4,
    gasConstant: 287.05
  };

  const primLeft: PrimitiveState = { rho: 1.225, u: 100, v: 0, w: 0, p: 101325, T: 101325 / (1.225 * 287.05) };
  const primRight: PrimitiveState = { rho: 1.0, u: 80, v: 10, w: -5, p: 90000, T: 280.0 };

  it('A. converts primitive state to conservative and back accurately', () => {
    const cons = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    expect(cons.rho).toBeCloseTo(1.225, 6);
    expect(cons.rhoU).toBeCloseTo(122.5, 6);

    const primBack = FluxStateEngine.conservativeToPrimitive(cons, physicsModel);
    expect(primBack.rho).toBeCloseTo(primLeft.rho, 6);
    expect(primBack.u).toBeCloseTo(primLeft.u, 6);
    expect(primBack.p).toBeCloseTo(primLeft.p, 6);
    expect(primBack.T).toBeCloseTo(primLeft.T, 6);
  });

  it('B. detects invalid states during state validation', () => {
    const invalidPrim: PrimitiveState = { rho: -1.0, u: 0, v: 0, w: 0, p: 100000, T: 300 };
    const val = FluxStateEngine.validatePrimitiveState(invalidPrim, physicsModel);
    expect(val.valid).toBe(false);
    expect(val.diagnostics.length).toBeGreaterThan(0);

    expect(() => FluxStateEngine.primitiveToConservative(invalidPrim, physicsModel)).toThrow();
  });

  it('C. calculates physical flux for 3D Euler equations analytically', () => {
    const cons = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const pFlux = PhysicalFluxEngine.computePhysicalFlux(cons, normal, physicsModel);
    expect(pFlux.validity).toBe(true);
    // Mass flux = rho * u = 1.225 * 100 = 122.5
    expect(pFlux.flux.rho).toBeCloseTo(122.5, 6);
    // Momentum X flux = rho * u^2 + p = 122.5 * 100 + 101325 = 12250 + 101325 = 113575
    expect(pFlux.flux.rhoU).toBeCloseTo(113575, 6);
  });

  it('D. verifies Central Flux symmetry F(L, R, n) = -F(R, L, -n)', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const consR = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const scheme = new CentralFluxScheme();
    const rep = FluxVerificationPrimitives.verifyFluxSymmetry(scheme, consL, consR, normal, physicsModel);
    expect(rep.passed).toBe(true);
    expect(rep.maxError).toBeLessThan(1e-10);
  });

  it('E. verifies interior face antisymmetry (conservation)', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const consR = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const scheme = new UpwindFluxScheme();
    const rep = FluxVerificationPrimitives.verifyFluxConservation(scheme, consL, consR, normal, physicsModel);
    expect(rep.passed).toBe(true);
    expect(rep.maxError).toBeLessThan(1e-10);
  });

  it('F. verifies uniform state behavior (L = R => Numerical Flux equals Physical Flux)', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const scheme = new UpwindFluxScheme();
    const rep = FluxVerificationPrimitives.verifyUniformState(scheme, consL, normal, physicsModel);
    expect(rep.passed).toBe(true);
    expect(rep.maxError).toBeLessThan(1e-10);
  });

  it('G. handles reversed face normal correctly', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const consR = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    const normalPos: [number, number, number] = [0, 1, 0];
    const normalNeg: [number, number, number] = [0, -1, 0];

    const scheme = new CentralFluxScheme();
    const fPos = scheme.compute(consL, consR, normalPos, physicsModel);
    const fNeg = scheme.compute(consL, consR, normalNeg, physicsModel);

    expect(fPos.flux.rho).toBeCloseTo(-fNeg.flux.rho, 6);
    expect(fPos.flux.rhoV).toBeCloseTo(-fNeg.flux.rhoV, 6);
  });

  it('H. handles boundary fluxes (Wall slip condition)', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const res = FluxBoundaryHandler.computeBoundaryFlux(BoundaryType.WALL, consL, null, normal, physicsModel);
    expect(res.capability).toBe('SUPPORTED');
    expect(res.fluxResult.validity).toBe(true);
    expect(res.fluxResult.flux.rho).toBe(0); // Mass flux 0 across wall
    expect(res.fluxResult.flux.rhoU).toBeCloseTo(101325, 6); // Pressure force
  });

  it('I. satisfies deterministic replay contract', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const consR = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];

    const scheme = new UpwindFluxScheme();
    const detRep = FluxVerificationPrimitives.verifyFluxDeterminism(scheme, consL, consR, normal, physicsModel);
    expect(detRep.passed).toBe(true);
  });

  it('J. enforces registry integrity and rejects duplicates', () => {
    const registry = FluxRegistry.getInstance();
    expect(registry.listSchemes()).toContain('CENTRAL_FLUX_EULER_3D');

    const duplicateRes = registry.registerScheme(new CentralFluxScheme());
    expect(duplicateRes.success).toBe(false);
  });

  it('K. produces valid evidence generation and verification', () => {
    const consL = FluxStateEngine.primitiveToConservative(primLeft, physicsModel);
    const consR = FluxStateEngine.primitiveToConservative(primRight, physicsModel);
    const normal: [number, number, number] = [1, 0, 0];
    const scheme = new CentralFluxScheme();

    const fRes = scheme.compute(consL, consR, normal, physicsModel);
    const evidence = FluxEvidenceEngine.createEvidenceRecord(
      'CASE_TEST_01', scheme.id, scheme.version, physicsModel, consL, consR, normal, fRes, []
    );

    expect(evidence.patchId).toBe('PATCH-053');
    expect(FluxEvidenceEngine.verifyEvidenceIntegrity(evidence)).toBe(true);
  });

});
