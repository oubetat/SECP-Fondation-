/**
 * SECP Industrial OS v2 — Pressure-Velocity Coupling Unit Tests
 * PATCH-054: Pressure-Velocity Coupling
 */

import { describe, it, expect } from 'vitest';
import { CFDMeshBuilder } from '../../mesh/CFDMeshBuilder';
import { 
  SimpleCouplingScheme, 
  CouplingIterationEngine, 
  RhieChowEngine, 
  CouplingRegistry, 
  CouplingVerificationPrimitives,
  PressureReferencePolicy,
  UnderRelaxationConfig
} from '../index';

describe('PATCH-054: Pressure-Velocity Coupling Core Tests', () => {

  const mesh = CFDMeshBuilder.buildBoxMesh([2, 2, 2], [1.0, 1.0, 1.0]).mesh!;
  const density = 1.225;
  const viscosity = 1.81e-5;
  const numCells = mesh.cells.length;

  const initialPressure = new Float64Array(numCells);
  const initialVelocity = {
    u: new Float64Array(numCells).fill(10.0),
    v: new Float64Array(numCells),
    w: new Float64Array(numCells)
  };

  const relaxation: UnderRelaxationConfig = { pressureRelaxation: 0.3, velocityRelaxation: 0.7 };
  const refPolicy: PressureReferencePolicy = { type: 'FIXED_CELL', referenceCellId: 0, referencePressure: 101325 };

  it('1. initializes coupling state cleanly with initial pressure and velocity', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    expect(state.pressure.pressure.length).toBe(numCells);
    expect(state.velocity.u.length).toBe(numCells);
    expect(state.faceFlux.predictedFlux.length).toBe(mesh.faces.length);
    expect(state.iteration).toBe(0);
  });

  it('2. predicts momentum star velocity field and evaluates coefficients', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const pred = scheme.predictMomentum(mesh, density, viscosity, state, relaxation);
    expect(pred.valid).toBe(true);
    expect(pred.uStar.length).toBe(numCells);
    expect(pred.coefficients.aP.length).toBe(numCells);
    expect(pred.coefficients.aP[0]).toBeGreaterThan(0);
  });

  it('3. interpolates face velocity using Rhie-Chow momentum interpolation', () => {
    const rcRes = RhieChowEngine.interpolateFaceVelocity(
      10.0, 0, 0, 8.0, 0, 0,
      100.0, 100.0, 0.125, 0.125,
      101325, 100000,
      [-10, 0, 0], [10, 0, 0],
      [1, 0, 0], 0.25,
      [0.25, 0.25, 0.25], [0.75, 0.25, 0.25]
    );

    expect(typeof rcRes.velocityNormal).toBe('number');
    expect(Number.isFinite(rcRes.velocityNormal)).toBe(true);
  });

  it('4. corrects pressure and velocity fields using under-relaxation', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const iterRes = CouplingIterationEngine.stepIteration(
      mesh, density, viscosity, state, scheme, relaxation, refPolicy
    );

    expect(iterRes.status).toBe('NOT_CONVERGED');
    expect(iterRes.state.iteration).toBe(1);
    expect(iterRes.state.pressure.pressure.length).toBe(numCells);
    expect(iterRes.state.velocity.u.length).toBe(numCells);
  });

  it('5. computes face mass flux correction and updates total face mass flux', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const iterRes = CouplingIterationEngine.stepIteration(
      mesh, density, viscosity, state, scheme, relaxation, refPolicy
    );

    expect(iterRes.state.faceFlux.correctedFlux.length).toBe(mesh.faces.length);
    expect(iterRes.state.faceFlux.fluxCorrection.length).toBe(mesh.faces.length);
  });

  it('6. measures continuity equation residual sum(m_f)', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const cont = scheme.checkContinuity(mesh, state.faceFlux.correctedFlux);
    expect(typeof cont.absoluteResidual).toBe('number');
    expect(cont.absoluteResidual).toBeGreaterThanOrEqual(0);
  });

  it('7. calculates independent global mass balance across boundary faces', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const mBal = scheme.checkGlobalMassBalance(mesh, state.faceFlux.correctedFlux);
    expect(typeof mBal.netMassImbalance).toBe('number');
    expect(mBal.netMassImbalance).toBeGreaterThanOrEqual(0);
  });

  it('8. satisfies pressure reference policy and verification primitives', () => {
    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, initialPressure, initialVelocity);

    const rPRef = CouplingVerificationPrimitives.verifyPressureReference(mesh, refPolicy);
    expect(rPRef.passed).toBe(true);
  });

  it('9. verifies deterministic iteration replay contract', () => {
    const rDet = CouplingVerificationPrimitives.verifyCouplingDeterminism(
      mesh, density, viscosity, initialPressure, initialVelocity, refPolicy
    );
    expect(rDet.passed).toBe(true);
  });

  it('10. enforces registry integrity and rejects duplicate scheme registration', () => {
    const registry = CouplingRegistry.getInstance();
    expect(registry.listSchemes()).toContain('SIMPLE_COUPLING_INCOMPRESSIBLE_3D');

    const duplicateRes = registry.registerScheme(new SimpleCouplingScheme());
    expect(duplicateRes.success).toBe(false);
  });

});
