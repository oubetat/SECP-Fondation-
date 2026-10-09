/**
 * SECP Industrial OS v2 — Flux Framework Adversarial Tests
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
  FluxDiagnostic
} from '../index';

describe('PATCH-053: Flux Framework Adversarial Tests', () => {

  const physicsModel: PhysicsModel = {
    modelType: 'EULER_3D',
    gamma: 1.4,
    gasConstant: 287.05
  };

  const validState: ConservativeState = { rho: 1.225, rhoU: 122.5, rhoV: 0, rhoW: 0, rhoE: 250000 };

  it('1. rejects zero or negative density', () => {
    const zeroDensity: PrimitiveState = { rho: 0, u: 10, v: 0, w: 0, p: 100000, T: 300 };
    const negDensity: PrimitiveState = { rho: -0.5, u: 10, v: 0, w: 0, p: 100000, T: 300 };

    expect(FluxStateEngine.validatePrimitiveState(zeroDensity, physicsModel).valid).toBe(false);
    expect(FluxStateEngine.validatePrimitiveState(negDensity, physicsModel).valid).toBe(false);

    const zeroCons: ConservativeState = { rho: 0, rhoU: 0, rhoV: 0, rhoW: 0, rhoE: 100000 };
    expect(FluxStateEngine.validateConservativeState(zeroCons, physicsModel).valid).toBe(false);
  });

  it('2. rejects zero or negative pressure', () => {
    const zeroPressure: PrimitiveState = { rho: 1.0, u: 0, v: 0, w: 0, p: 0, T: 300 };
    const negPressure: PrimitiveState = { rho: 1.0, u: 0, v: 0, w: 0, p: -500, T: 300 };

    expect(FluxStateEngine.validatePrimitiveState(zeroPressure, physicsModel).valid).toBe(false);
    expect(FluxStateEngine.validatePrimitiveState(negPressure, physicsModel).valid).toBe(false);
  });

  it('3. rejects NaN and Infinity values in states', () => {
    const nanState: ConservativeState = { rho: NaN, rhoU: 0, rhoV: 0, rhoW: 0, rhoE: 100000 };
    const infState: ConservativeState = { rho: 1.0, rhoU: Infinity, rhoV: 0, rhoW: 0, rhoE: 100000 };

    expect(FluxStateEngine.validateConservativeState(nanState, physicsModel).valid).toBe(false);
    expect(FluxStateEngine.validateConservativeState(infState, physicsModel).valid).toBe(false);
  });

  it('4. rejects zero-length normal vector', () => {
    const zeroNormal: [number, number, number] = [0, 0, 0];
    const res = PhysicalFluxEngine.computePhysicalFlux(validState, zeroNormal, physicsModel);

    expect(res.validity).toBe(false);
    expect(res.diagnostics).toContain(FluxDiagnostic.ZERO_NORMAL);
  });

  it('5. handles non-finite normal components gracefully', () => {
    const nanNormal: [number, number, number] = [1, NaN, 0];
    const res = PhysicalFluxEngine.computePhysicalFlux(validState, nanNormal, physicsModel);

    expect(res.validity).toBe(false);
    expect(res.diagnostics).toContain(FluxDiagnostic.NON_FINITE_VALUE);
  });

  it('6. rejects unsupported physics model', () => {
    const badModel = { modelType: 'NAVIER_STOKES_UNSUPPORTED' as any, gamma: 1.4, gasConstant: 287.05 };
    const res = PhysicalFluxEngine.computePhysicalFlux(validState, [1, 0, 0], badModel);

    expect(res.validity).toBe(false);
    expect(res.diagnostics).toContain(FluxDiagnostic.UNSUPPORTED_MODEL);
  });

  it('7. rejects duplicate scheme registration in FluxRegistry', () => {
    const registry = FluxRegistry.getInstance();
    const central = new CentralFluxScheme();

    const firstTry = registry.registerScheme(central);
    expect(firstTry.success).toBe(false); // Already registered by default constructor
    expect(firstTry.error).toContain('Duplicate scheme ID');
  });

  it('8. rejects invalid boundary condition type', () => {
    const res = FluxBoundaryHandler.computeBoundaryFlux('UNKNOWN_BOUNDARY' as any, validState, null, [1, 0, 0], physicsModel);

    expect(res.capability).toBe('UNSUPPORTED');
    expect(res.fluxResult.validity).toBe(false);
  });

  it('9. handles numerical overflow smoothly without crashing', () => {
    const hugeState: ConservativeState = {
      rho: 1e300,
      rhoU: 1e300,
      rhoV: 1e300,
      rhoW: 1e300,
      rhoE: 1e300
    };

    const scheme = new CentralFluxScheme();
    const res = scheme.compute(hugeState, validState, [1, 0, 0], physicsModel);
    // Should return result gracefully without throwing
    expect(typeof res.validity).toBe('boolean');
  });

});
