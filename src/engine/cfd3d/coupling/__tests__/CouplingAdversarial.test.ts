/**
 * SECP Industrial OS v2 — Pressure-Velocity Coupling Adversarial Tests
 * PATCH-054: Pressure-Velocity Coupling
 */

import { describe, it, expect } from 'vitest';
import { CFDMeshBuilder } from '../../mesh/CFDMeshBuilder';
import { 
  SimpleCouplingScheme, 
  CouplingIterationEngine, 
  CouplingVerificationPrimitives,
  PressureReferencePolicy,
  UnderRelaxationConfig,
  CouplingDiagnostic,
  RhieChowEngine
} from '../index';

describe('PATCH-054: Pressure-Velocity Coupling Adversarial Tests', () => {

  const mesh = CFDMeshBuilder.buildBoxMesh([2, 2, 2], [1.0, 1.0, 1.0]).mesh!;
  const density = 1.225;
  const viscosity = 1.81e-5;
  const numCells = mesh.cells.length;

  it('1. rejects missing pressure reference when all boundaries are Neumann/Wall/Inlet', () => {
    const closedMesh = {
      ...mesh,
      boundaryConditions: [
        { type: 'INLET' as any, faceIds: [0] },
        { type: 'WALL' as any, faceIds: [1, 2, 3, 4, 5] }
      ]
    };
    const missingRef: PressureReferencePolicy = { type: 'NONE' };
    const rep = CouplingVerificationPrimitives.verifyPressureReference(closedMesh, missingRef);

    expect(rep.passed).toBe(false);
    expect(rep.diagnostics).toContain(CouplingDiagnostic.MISSING_PRESSURE_REFERENCE);
  });

  it('2. handles invalid reference cell index gracefully', () => {
    const invalidRefCell: PressureReferencePolicy = { type: 'FIXED_CELL', referenceCellId: 99999 };

    const scheme = new SimpleCouplingScheme();
    const state = scheme.initialize(mesh, density, viscosity, new Float64Array(numCells), {
      u: new Float64Array(numCells), v: new Float64Array(numCells), w: new Float64Array(numCells)
    });

    const relaxation: UnderRelaxationConfig = { pressureRelaxation: 0.3, velocityRelaxation: 0.7 };
    const res = CouplingIterationEngine.stepIteration(mesh, density, viscosity, state, scheme, relaxation, invalidRefCell);

    expect(res.status).toBe('INVALID');
    expect(res.diagnostics.length).toBeGreaterThan(0);
  });

  it('3. rejects non-finite pressure or velocity inputs', () => {
    const scheme = new SimpleCouplingScheme();
    const nanPressure = new Float64Array(numCells).fill(NaN);
    const state = scheme.initialize(mesh, density, viscosity, nanPressure, {
      u: new Float64Array(numCells), v: new Float64Array(numCells), w: new Float64Array(numCells)
    });

    const relaxation: UnderRelaxationConfig = { pressureRelaxation: 0.3, velocityRelaxation: 0.7 };
    const refPolicy: PressureReferencePolicy = { type: 'FIXED_CELL', referenceCellId: 0, referencePressure: 101325 };

    const res = CouplingIterationEngine.stepIteration(mesh, density, viscosity, state, scheme, relaxation, refPolicy);
    expect(res.status).toBe('INVALID');
  });

  it('4. suppresses checkerboarding on collocated grids via Rhie-Chow momentum interpolation', () => {
    // Checkerboard pressure pattern: +100, -100, +100, -100
    const pO = 100; const pN = -100;
    const gPO: [number, number, number] = [0, 0, 0];
    const gPN: [number, number, number] = [0, 0, 0];

    const rcRes = RhieChowEngine.interpolateFaceVelocity(
      0, 0, 0, 0, 0, 0,
      10.0, 10.0, 1.0, 1.0,
      pO, pN, gPO, gPN,
      [1, 0, 0], 1.0,
      [0, 0, 0], [1, 0, 0]
    );

    // Rhie-Chow should generate non-zero face velocity to smooth out checkerboard pressure difference
    expect(rcRes.velocityNormal).not.toBe(0);
  });

  it('5. detects non-finite values in verification primitives', () => {
    const invalidState: any = {
      velocity: { uCorrection: [NaN], vCorrection: [0], wCorrection: [0] },
      pressure: { correction: [NaN] },
      faceFlux: { fluxCorrection: [0] }
    };

    const rep = CouplingVerificationPrimitives.verifyPressureCorrection(invalidState);
    expect(rep.passed).toBe(false);
    expect(rep.diagnostics).toContain(CouplingDiagnostic.NON_FINITE_VALUE);
  });

});
