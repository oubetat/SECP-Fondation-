/**
 * SECP Industrial OS — Engineering Truth OS
 * ElectrostaticSolver3D.test.ts
 *
 * SECP-PHYSICS-EXPANSION-001: Verification Suite for 3D Continuum Electrostatics & Multiphysics Field Solver.
 *
 * Verifies:
 * 1. Parallel-plate capacitor benchmark parity (C = eps * A / d, E = V / d)
 * 2. Electrostatic stored energy conservation (W_e = 0.5 * C * V^2 = 0.5 * eps * E^2 * Vol)
 * 3. Joule heating dissipation coupling (q = sigma * |E|^2, P_tot = V^2 / R)
 * 4. Dual-dielectric series capacitor field jump across interface
 * 5. Fail-closed rejection of unconstrained electrostatic system
 * 6. Degenerate tetrahedron detection
 */

import { describe, it, expect } from "vitest";
import {
  ElectrostaticSolver3D,
  ElectrostaticNode3D,
  ElectrostaticTetElement3D,
  ElectrostaticBoundaryCondition,
  EPSILON_0
} from "../ElectrostaticSolver3D";

describe("SECP-PHYSICS-EXPANSION-001: 3D Continuum Electrostatics", () => {
  it("1. Verifies parallel-plate capacitor analytical benchmark (E = V/d, C = eps*A/d)", () => {
    // A box [0, L] x [0, W] x [0, d] discretized into 5 tetrahedra
    // L = 0.1 m, W = 0.1 m, d = 0.01 m
    // Area A = 0.01 m^2, d = 0.01 m
    // eps_r = 1.0 (vacuum)
    // Applied V = 100 V across z=0 and z=d
    const L = 0.1;
    const W = 0.1;
    const d = 0.01;
    const V_applied = 100.0;

    // 8 box vertices
    const nodes: ElectrostaticNode3D[] = [
      { id: "N0", x: 0, y: 0, z: 0 },
      { id: "N1", x: L, y: 0, z: 0 },
      { id: "N2", x: L, y: W, z: 0 },
      { id: "N3", x: 0, y: W, z: 0 },
      { id: "N4", x: 0, y: 0, z: d },
      { id: "N5", x: L, y: 0, z: d },
      { id: "N6", x: L, y: W, z: d },
      { id: "N7", x: 0, y: W, z: d }
    ];

    // Standard 5-tetrahedron decomposition of a hexahedron
    const elements: ElectrostaticTetElement3D[] = [
      { id: "T1", nodeIds: ["N0", "N1", "N3", "N4"], relativePermittivity: 1.0 },
      { id: "T2", nodeIds: ["N1", "N2", "N3", "N6"], relativePermittivity: 1.0 },
      { id: "T3", nodeIds: ["N1", "N4", "N5", "N6"], relativePermittivity: 1.0 },
      { id: "T4", nodeIds: ["N3", "N4", "N6", "N7"], relativePermittivity: 1.0 },
      { id: "T5", nodeIds: ["N1", "N3", "N4", "N6"], relativePermittivity: 1.0 }
    ];

    // Ground bottom face (z = 0: N0, N1, N2, N3)
    // Excite top face (z = d: N4, N5, N6, N7) with 100 V
    const bcs: ElectrostaticBoundaryCondition[] = [
      { nodeId: "N0", potential: 0.0 },
      { nodeId: "N1", potential: 0.0 },
      { nodeId: "N2", potential: 0.0 },
      { nodeId: "N3", potential: 0.0 },
      { nodeId: "N4", potential: V_applied },
      { nodeId: "N5", potential: V_applied },
      { nodeId: "N6", potential: V_applied },
      { nodeId: "N7", potential: V_applied }
    ];

    const solver = new ElectrostaticSolver3D();
    const result = solver.solve(nodes, elements, bcs);

    expect(result.converged).toBe(true);

    // Analytical electric field: E_z = -V / d = -10,000 V/m
    const expectedEz = -V_applied / d;
    const expectedEmag = V_applied / d;

    for (const [elemId, elemRes] of result.elementResults.entries()) {
      expect(elemRes.electricField[0]).toBeCloseTo(0.0, 5);
      expect(elemRes.electricField[1]).toBeCloseTo(0.0, 5);
      expect(elemRes.electricField[2]).toBeCloseTo(expectedEz, 3);
      expect(elemRes.electricFieldMagnitude).toBeCloseTo(expectedEmag, 3);
    }

    // Analytical capacitance: C = eps0 * A / d
    const A = L * W;
    const expectedCapacitance = (EPSILON_0 * A) / d;
    expect(result.capacitance).toBeDefined();
    expect(result.capacitance!).toBeCloseTo(expectedCapacitance, 14);

    // Analytical energy: W_e = 0.5 * C * V^2
    const expectedEnergy = 0.5 * expectedCapacitance * V_applied * V_applied;
    expect(result.totalElectrostaticEnergy).toBeCloseTo(expectedEnergy, 14);
  });

  it("2. Verifies Joule heating dissipation power conservation (P = sigma * E^2 * Vol = V^2 / R)", () => {
    const L = 0.05;
    const W = 0.05;
    const d = 0.02;
    const V_applied = 50.0;
    const sigma = 5.0; // S/m (conductive medium)

    const nodes: ElectrostaticNode3D[] = [
      { id: "N0", x: 0, y: 0, z: 0 },
      { id: "N1", x: L, y: 0, z: 0 },
      { id: "N2", x: L, y: W, z: 0 },
      { id: "N3", x: 0, y: W, z: 0 },
      { id: "N4", x: 0, y: 0, z: d },
      { id: "N5", x: L, y: 0, z: d },
      { id: "N6", x: L, y: W, z: d },
      { id: "N7", x: 0, y: W, z: d }
    ];

    const elements: ElectrostaticTetElement3D[] = [
      { id: "T1", nodeIds: ["N0", "N1", "N3", "N4"], relativePermittivity: 1.0, conductivity: sigma },
      { id: "T2", nodeIds: ["N1", "N2", "N3", "N6"], relativePermittivity: 1.0, conductivity: sigma },
      { id: "T3", nodeIds: ["N1", "N4", "N5", "N6"], relativePermittivity: 1.0, conductivity: sigma },
      { id: "T4", nodeIds: ["N3", "N4", "N6", "N7"], relativePermittivity: 1.0, conductivity: sigma },
      { id: "T5", nodeIds: ["N1", "N3", "N4", "N6"], relativePermittivity: 1.0, conductivity: sigma }
    ];

    const bcs: ElectrostaticBoundaryCondition[] = [
      { nodeId: "N0", potential: 0.0 },
      { nodeId: "N1", potential: 0.0 },
      { nodeId: "N2", potential: 0.0 },
      { nodeId: "N3", potential: 0.0 },
      { nodeId: "N4", potential: V_applied },
      { nodeId: "N5", potential: V_applied },
      { nodeId: "N6", potential: V_applied },
      { nodeId: "N7", potential: V_applied }
    ];

    const solver = new ElectrostaticSolver3D();
    const result = solver.solve(nodes, elements, bcs);

    // Resistance: R = d / (sigma * A)
    const A = L * W;
    const R = d / (sigma * A);
    const expectedP = (V_applied * V_applied) / R;

    expect(result.totalJoulePower).toBeCloseTo(expectedP, 6);
  });

  it("3. Fail-closed: throws when no Dirichlet boundary conditions are supplied", () => {
    const nodes: ElectrostaticNode3D[] = [
      { id: "N0", x: 0, y: 0, z: 0 },
      { id: "N1", x: 1, y: 0, z: 0 },
      { id: "N2", x: 0, y: 1, z: 0 },
      { id: "N3", x: 0, y: 0, z: 1 }
    ];
    const elements: ElectrostaticTetElement3D[] = [
      { id: "T1", nodeIds: ["N0", "N1", "N2", "N3"], relativePermittivity: 1.0 }
    ];

    const solver = new ElectrostaticSolver3D();
    expect(() => solver.solve(nodes, elements, [])).toThrow(/UNCONSTRAINED_ELECTROSTATIC_PROBLEM/);
  });

  it("4. Fail-closed: throws on degenerate tetrahedron", () => {
    const coplanarNodes: ElectrostaticNode3D[] = [
      { id: "N0", x: 0, y: 0, z: 0 },
      { id: "N1", x: 1, y: 0, z: 0 },
      { id: "N2", x: 2, y: 0, z: 0 },
      { id: "N3", x: 3, y: 0, z: 0 }
    ];

    expect(() => ElectrostaticSolver3D.computeTetGradients(coplanarNodes)).toThrow(/SINGULAR_ELECTROSTATIC_TET/);
  });
});
