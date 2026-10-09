/**
 * SECP Industrial OS v2 — Momentum Conservation Unit Tests
 * PATCH-058
 */

import { describe, test, expect } from 'vitest';
import { MomentumVector, MomentumConservationStatus } from '../MomentumConservationTypes';
import { MomentumFluxCalculator } from '../MomentumFluxCalculator';
import { MomentumControlVolumeBalance } from '../MomentumControlVolumeBalance';
import { GlobalMomentumBalance } from '../GlobalMomentumBalance';
import { CFDMesh3D } from '../../../mesh/CFDMeshTypes';

describe('PATCH-058 — Momentum Conservation Framework Tests', () => {

  const createMockMesh = (): CFDMesh3D => ({
    cells: [{ id: 0,  volume: 1,  neighbors: [] }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [], boundaryConditions: [], metadata: { name: 'mock', description: '' }
  });

  test('1. Momentum Vector Math', () => {
    const v1 = new MomentumVector(1, 0, 0);
    const v2 = new MomentumVector(0, 1, 0);
    const sum = v1.add(v2);
    expect(sum.x).toBe(1);
    expect(sum.y).toBe(1);
    expect(sum.magnitude()).toBeCloseTo(Math.sqrt(2));
  });

  test('2. Convective Flux Calculation', () => {
    const mesh = createMockMesh();
    // rho=1.0, u=[1,0,0], n=[-1,0,0], A=1. mdot = -1. Flux = mdot * u = [-1, 0, 0]
    const flux = MomentumFluxCalculator.calculateConvectiveFlux(mesh.faces[0], 1.0, [1, 0, 0], [-1, 0, 0]);
    expect(flux.x).toBe(-1);
    expect(flux.y).toBeCloseTo(0);
    expect(flux.z).toBeCloseTo(0);
  });

  test('3. Pressure Force Calculation', () => {
    const mesh = createMockMesh();
    // p=10, n=[-1,0,0], A=1. F = -p*n*A = -10*[-1,0,0]*1 = [10, 0, 0]
    const force = MomentumFluxCalculator.calculatePressureForce(mesh.faces[0], 10, [-1, 0, 0]);
    expect(force.x).toBe(10);
  });

  test('4. Cell Momentum Balance', () => {
    const mesh = createMockMesh();
    const f0 = new MomentumVector(-1, 0, 0);
    const f1 = new MomentumVector(1, 0, 0);
    const p0 = new MomentumVector(10, 0, 0);
    const p1 = new MomentumVector(-10, 0, 0);

    const terms = {
      convectiveFluxes: [f0, f1],
      pressureForces: [p0, p1],
      viscousForces: [MomentumVector.zero(), MomentumVector.zero()],
      bodyForce: MomentumVector.zero(),
      sourceTerms: MomentumVector.zero(),
      accumulation: MomentumVector.zero()
    };

    const balance = MomentumControlVolumeBalance.calculateCellBalance(0, mesh, terms);
    // Net Convective: Outflow (f1) - (-Inflow (f0)) = 1 - 1 = 0
    // Wait. Cell 0 faces: 0 (owner), 1 (owner).
    // Sum convective = f0 + f1 = [-1,0,0] + [1,0,0] = [0,0,0]
    // Sum pressure = p0 + p1 = [10,0,0] + [-10,0,0] = [0,0,0]
    // Imbalance = [0,0,0]
    expect(balance.imbalance.magnitude()).toBe(0);
  });

  test('5. Global Momentum Balance and Component Status', () => {
    const mesh = createMockMesh();
    const c0 = {
      cellId: 0,
      accumulation: MomentumVector.zero(),
      convectiveFlux: new MomentumVector(0.1, 0, 0), // Imbalance in X
      pressureForce: MomentumVector.zero(),
      viscousForce: MomentumVector.zero(),
      bodyForce: MomentumVector.zero(),
      sourceTerms: MomentumVector.zero(),
      imbalance: new MomentumVector(0.1, 0, 0),
      normalizedImbalance: new MomentumVector(0.1, 0, 0),
      finite: true,
      diagnostics: []
    };

    const global = GlobalMomentumBalance.calculateGlobalBalance(mesh, [c0]);
    expect(global.globalImbalance.x).toBe(0.1);
    expect(global.componentStatus.x).toBe(MomentumConservationStatus.NOT_CONSERVATIVE);
    expect(global.componentStatus.y).toBe(MomentumConservationStatus.CONSERVATIVE);
  });
});
