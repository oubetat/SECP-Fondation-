/**
 * SECP Industrial OS — Engineering Truth OS
 * EulerColumnBenchmark.test.ts
 * 
 * Comprehensive Analytical Verification Suite for SECP-FEM-UPGRADE-006:
 * Verifies FEM critical buckling loads against exact Euler column analytical solutions
 * for all standard end conditions (Pinned-Pinned, Fixed-Free, Fixed-Pinned, Fixed-Fixed),
 * mesh convergence rates, and physical scaling laws (E, I, L, P_ref).
 */

import { describe, it, expect } from 'vitest';
import { LinearBucklingAnalysis } from '../LinearBucklingAnalysis';
import { DOFComponent, FEMModel } from '../../core/FEMTypes';

function buildColumnModel(
  L: number,
  numElems: number,
  E: number,
  I: number,
  A: number,
  Pref: number,
  endConditions: 'PINNED_PINNED' | 'FIXED_FREE' | 'FIXED_PINNED' | 'FIXED_FIXED'
): FEMModel {
  const dL = L / numElems;
  const nodes = new Map();
  for (let i = 0; i <= numElems; i++) {
    nodes.set(`N${i+1}`, { nodeId: `N${i+1}`, x: 0, y: i * dL, z: 0 });
  }

  const elements = new Map();
  for (let i = 0; i < numElems; i++) {
    elements.set(`E${i+1}`, {
      elementId: `E${i+1}`,
      nodeIds: [`N${i+1}`, `N${i+2}`],
      materialId: 'M1',
      sectionId: 'S1',
      formulationId: 'FRAME_2D'
    });
  }

  const topNodeId = `N${numElems+1}`;

  const loads = [
    { nodeId: topNodeId, dof: DOFComponent.UY, value: -Pref } // Compressive load
  ];

  const boundaryConditions = [];

  // Bottom boundary conditions at N1 (y = 0)
  if (endConditions === 'PINNED_PINNED') {
    boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UX, value: 0 });
    boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UY, value: 0 });
  } else if (endConditions === 'FIXED_FREE' || endConditions === 'FIXED_PINNED' || endConditions === 'FIXED_FIXED') {
    boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UX, value: 0 });
    boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UY, value: 0 });
    boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.RZ, value: 0 });
  }

  // Top boundary conditions at topNodeId (y = L)
  if (endConditions === 'PINNED_PINNED') {
    boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.UX, value: 0 });
  } else if (endConditions === 'FIXED_FREE') {
    // Top is completely free in UX and RZ
  } else if (endConditions === 'FIXED_PINNED') {
    boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.UX, value: 0 });
  } else if (endConditions === 'FIXED_FIXED') {
    boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.UX, value: 0 });
    boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.RZ, value: 0 });
  }

  return {
    nodes,
    elements,
    materials: new Map([
      ['M1', { materialId: 'M1', E, nu: 0.3 }]
    ]),
    sections: new Map([
      ['S1', { sectionId: 'S1', area: A, I }]
    ]),
    loads,
    boundaryConditions
  };
}

describe('SECP-FEM-UPGRADE-006: Analytical Euler Column Benchmarks', () => {
  const analysis = new LinearBucklingAnalysis();

  const E = 210000; // MPa
  const I = 1000;   // mm^4
  const A = 100;    // mm^2
  const L = 1000;   // mm
  const Pref = 1000;// N

  it('EULER-001: Pinned-Pinned column benchmark (K_eff = 1.0)', () => {
    // Exact P_cr = pi^2 * E * I / L^2
    const P_exact = (Math.PI * Math.PI * E * I) / (L * L); // 2072.6169 N

    const model = buildColumnModel(L, 8, E, I, A, Pref, 'PINNED_PINNED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });

    const P_fem = res.modes[0].criticalLoad;
    const relErr = Math.abs(P_fem - P_exact) / P_exact;

    expect(relErr).toBeLessThan(0.005); // Less than 0.5% error with 8 elements
  });

  it('EULER-002: Fixed-Free cantilever column benchmark (K_eff = 2.0)', () => {
    // Exact P_cr = pi^2 * E * I / (2L)^2 = pi^2 * E * I / (4 L^2)
    const P_exact = (Math.PI * Math.PI * E * I) / (4 * L * L); // 518.154 N

    const model = buildColumnModel(L, 8, E, I, A, Pref, 'FIXED_FREE');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });

    const P_fem = res.modes[0].criticalLoad;
    const relErr = Math.abs(P_fem - P_exact) / P_exact;

    expect(relErr).toBeLessThan(0.005); // Less than 0.5% error
  });

  it('EULER-003: Fixed-Pinned column benchmark (K_eff = 0.699156)', () => {
    // Exact P_cr = pi^2 * E * I / (0.699156 * L)^2 ~ 20.1907 * E * I / L^2
    const K_eff = 0.699156;
    const P_exact = (Math.PI * Math.PI * E * I) / ((K_eff * L) ** 2); // ~ 4238.18 N

    const model = buildColumnModel(L, 8, E, I, A, Pref, 'FIXED_PINNED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });

    const P_fem = res.modes[0].criticalLoad;
    const relErr = Math.abs(P_fem - P_exact) / P_exact;

    expect(relErr).toBeLessThan(0.01); // Less than 1% error
  });

  it('EULER-004: Fixed-Fixed column benchmark (K_eff = 0.5)', () => {
    // Exact P_cr = 4 * pi^2 * E * I / L^2
    const P_exact = (4 * Math.PI * Math.PI * E * I) / (L * L); // 8290.467 N

    const model = buildColumnModel(L, 16, E, I, A, Pref, 'FIXED_FIXED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });

    const P_fem = res.modes[0].criticalLoad;
    const relErr = Math.abs(P_fem - P_exact) / P_exact;

    expect(relErr).toBeLessThan(0.01); // Less than 1% error
  });

  it('EULER-005: Physical scaling laws - E, I, L, and reference load invariance', () => {
    const P_base = (Math.PI * Math.PI * E * I) / (L * L);

    // 1. Double E -> P_cr doubles
    const model2E = buildColumnModel(L, 8, 2 * E, I, A, Pref, 'PINNED_PINNED');
    const P_2E = analysis.runBucklingAnalysis(model2E).modes[0].criticalLoad;
    expect(P_2E / P_base).toBeCloseTo(2.0, 2);

    // 2. Double I -> P_cr doubles
    const model2I = buildColumnModel(L, 8, E, 2 * I, A, Pref, 'PINNED_PINNED');
    const P_2I = analysis.runBucklingAnalysis(model2I).modes[0].criticalLoad;
    expect(P_2I / P_base).toBeCloseTo(2.0, 2);

    // 3. Double L -> P_cr drops by factor of 4
    const model2L = buildColumnModel(2 * L, 8, E, I, A, Pref, 'PINNED_PINNED');
    const P_2L = analysis.runBucklingAnalysis(model2L).modes[0].criticalLoad;
    expect(P_2L / P_base).toBeCloseTo(0.25, 2);

    // 4. Double Pref -> lambda halves, physical P_cr = lambda * Pref remains invariant!
    const model5Pref = buildColumnModel(L, 8, E, I, A, 5 * Pref, 'PINNED_PINNED');
    const res5Pref = analysis.runBucklingAnalysis(model5Pref);
    expect(res5Pref.modes[0].criticalLoad).toBeCloseTo(P_base, 0);
  });

  it('EULER-006: Mesh refinement convergence study (N = 2, 4, 8, 16 elements)', () => {
    const P_exact = (Math.PI * Math.PI * E * I) / (L * L);
    const elementCounts = [2, 4, 8, 16];
    const errors: number[] = [];

    for (const N of elementCounts) {
      const model = buildColumnModel(L, N, E, I, A, Pref, 'PINNED_PINNED');
      const P_fem = analysis.runBucklingAnalysis(model).modes[0].criticalLoad;
      const relErr = Math.abs(P_fem - P_exact) / P_exact;
      errors.push(relErr);
    }

    // Monotonic error reduction with mesh refinement
    expect(errors[1]).toBeLessThan(errors[0]); // N=4 error < N=2 error
    expect(errors[2]).toBeLessThan(errors[1]); // N=8 error < N=4 error
    expect(errors[3]).toBeLessThan(errors[2]); // N=16 error < N=8 error
    expect(errors[3]).toBeLessThan(0.001);     // N=16 error < 0.1%
  });
});
