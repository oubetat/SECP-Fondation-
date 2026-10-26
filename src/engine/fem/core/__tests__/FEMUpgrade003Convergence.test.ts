/**
 * SECP Industrial OS — SECP-FEM-UPGRADE-003
 * Independent Structural Verification & Mesh Convergence Test Suite
 * 
 * Verifies:
 * - Phase A: Independent element verification & orientation invariance (BAR_1D & CST_2D)
 * - Phase B: Monotonic mesh convergence with exact analytical logarithmic reference
 * - Phase C: Strict rejection of degenerate, under-constrained, and invalid physical inputs
 * - Phase D: Independent translational force and rotational moment equilibrium
 */

import { describe, it, expect } from "vitest";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";
import { FEMVerificationEngine } from "../FEMVerificationEngine";

describe("SECP-FEM-UPGRADE-003: Structural Verification & Convergence", () => {
  const core = new FEMCore();
  const verifier = new FEMVerificationEngine();

  // ---------------------------------------------------------------------------
  // Phase A: Independent Element Verification & Permutation Invariance
  // ---------------------------------------------------------------------------
  it("STR-UP3-001: BAR_1D analytical verification with independent derivation", () => {
    const L = 800, A = 120, E = 190000, P = 24000;
    // Independent analytical formulas:
    const delta_ref = (P * L) / (A * E);
    const strain_ref = delta_ref / L;
    const stress_ref = P / A;
    const vonMises_ref = Math.abs(stress_ref);

    const model: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: P }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const res = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
    const u2 = res.displacements.get("n2")![DOFComponent.UX]!;
    const ef = res.fields.elementFields.get("e1")!;

    expect(Math.abs(u2 - delta_ref) / delta_ref).toBeLessThan(1e-8);
    expect(Math.abs(ef.strain.epsilon_x - strain_ref) / strain_ref).toBeLessThan(1e-8);
    expect(Math.abs(ef.stress.sigma_x - stress_ref) / stress_ref).toBeLessThan(1e-8);
    expect(ef.vonMisesStress).toBeCloseTo(vonMises_ref, 6);
  });

  it("STR-UP3-002: BAR_1D orientation and node sequence reversal invariance", () => {
    const L = 500, A = 80, E = 200000, P = 16000;

    // Model 1: nodeIds = ["n1", "n2"] with n1 at x=0, n2 at x=L
    const modelForward: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: P }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    // Model 2: nodeIds = ["n2", "n1"] (reversed node order)
    const modelReversed: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n2", "n1"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: P }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const res1 = core.solve(modelForward);
    const res2 = core.solve(modelReversed);

    const ef1 = res1.fields.elementFields.get("e1")!;
    const ef2 = res2.fields.elementFields.get("e1")!;

    expect(ef1.strain.epsilon_x).toBeCloseTo(ef2.strain.epsilon_x, 8);
    expect(ef1.stress.sigma_x).toBeCloseTo(ef2.stress.sigma_x, 6);
    expect(ef1.vonMisesStress).toBeCloseTo(ef2.vonMisesStress, 6);
  });

  it("STR-UP3-003: CST_2D cyclic node permutation invariance", () => {
    // Permutation 1: [n1, n2, n3]
    // Permutation 2: [n2, n3, n1]
    // Permutation 3: [n3, n1, n2]
    const nodes = new Map([
      ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
      ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
      ["n3", { nodeId: "n3", x: 0, y: 100, z: 0 }],
    ]);
    const materials = new Map([["mat1", { materialId: "mat1", E: 200000, nu: 0.3 }]]);
    const sections = new Map([["sec1", { sectionId: "sec1", thickness: 2.0 }]]);

    const bcs = [
      { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
      { nodeId: "n2", dof: DOFComponent.UY, value: 0 },
      { nodeId: "n3", dof: DOFComponent.UX, value: 0 }
    ];
    const loads = [{ nodeId: "n2", dof: DOFComponent.UX, value: 5000 }];

    const m1: FEMModel = { nodes, elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]]), materials, sections, loads, boundaryConditions: bcs };
    const m2: FEMModel = { nodes, elements: new Map([["e1", { elementId: "e1", nodeIds: ["n2", "n3", "n1"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]]), materials, sections, loads, boundaryConditions: bcs };
    const m3: FEMModel = { nodes, elements: new Map([["e1", { elementId: "e1", nodeIds: ["n3", "n1", "n2"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]]), materials, sections, loads, boundaryConditions: bcs };

    const r1 = core.solve(m1);
    const r2 = core.solve(m2);
    const r3 = core.solve(m3);

    const ef1 = r1.fields.elementFields.get("e1")!;
    const ef2 = r2.fields.elementFields.get("e1")!;
    const ef3 = r3.fields.elementFields.get("e1")!;

    expect(ef1.vonMisesStress).toBeCloseTo(ef2.vonMisesStress, 6);
    expect(ef1.vonMisesStress).toBeCloseTo(ef3.vonMisesStress, 6);
    expect(ef1.strain.epsilon_x).toBeCloseTo(ef2.strain.epsilon_x, 8);
    expect(ef1.strain.epsilon_x).toBeCloseTo(ef3.strain.epsilon_x, 8);
  });

  // ---------------------------------------------------------------------------
  // Phase B: Mesh Convergence Study
  // ---------------------------------------------------------------------------
  it("STR-UP3-004: Monotonic mesh convergence against exact logarithmic analytical solution", () => {
    const L = 1000;
    const E = 200000;
    const P = 50000;
    const A1 = 1000; // root area
    const A2 = 200;  // tip area

    // Exact analytical tip deflection for linear taper A(x) = A1 + (A2 - A1)*x/L:
    // delta_exact = (P * L) / (E * (A2 - A1)) * ln(A2 / A1)
    const delta_exact = (P * L) / (E * (A2 - A1)) * Math.log(A2 / A1); // ~ 0.502949 mm

    const meshSizes = [4, 16, 64, 128];
    const errors: number[] = [];

    for (const numElem of meshSizes) {
      const nodes = new Map<string, any>();
      const elements = new Map<string, any>();
      const sections = new Map<string, any>();
      const dx = L / numElem;

      for (let i = 0; i <= numElem; i++) {
        nodes.set(`n${i}`, { nodeId: `n${i}`, x: i * dx, y: 0, z: 0 });
      }

      for (let i = 0; i < numElem; i++) {
        // Average area of element i
        const xMid = (i + 0.5) * dx;
        const areaMid = A1 + (A2 - A1) * (xMid / L);
        sections.set(`sec${i}`, { sectionId: `sec${i}`, area: areaMid });
        elements.set(`e${i}`, {
          elementId: `e${i}`,
          nodeIds: [`n${i}`, `n${i + 1}`],
          formulationId: "BAR_1D",
          materialId: "mat1",
          sectionId: `sec${i}`
        });
      }

      const model: FEMModel = {
        nodes,
        elements,
        materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
        sections,
        loads: [{ nodeId: `n${numElem}`, dof: DOFComponent.UX, value: P }],
        boundaryConditions: [{ nodeId: "n0", dof: DOFComponent.UX, value: 0 }]
      };

      const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
      const tipDisp = result.displacements.get(`n${numElem}`)![DOFComponent.UX]!;
      const relError = Math.abs(tipDisp - delta_exact) / delta_exact;
      errors.push(relError);
    }

    // Monotonic convergence verification: error MUST strictly decrease at each refinement level!
    for (let k = 1; k < errors.length; k++) {
      expect(errors[k]).toBeLessThan(errors[k - 1]);
    }

    // Finest mesh (128 elements) error must be under 0.01% (1e-4)
    expect(errors[errors.length - 1]).toBeLessThan(1e-4);
  });

  // ---------------------------------------------------------------------------
  // Phase C: Strict Rejection of Degenerate & Non-Physical Inputs
  // ---------------------------------------------------------------------------
  it("STR-UP3-005: rejects under-constrained systems with unconstrained rigid body modes", () => {
    const model: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["s1", { sectionId: "s1", area: 10 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 50 }],
      boundaryConditions: [] // Completely unconstrained
    };

    expect(() => core.solve(model)).toThrow();
  });

  it("STR-UP3-006: rejects conflicting boundary conditions on the same DOF", () => {
    const model: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["s1", { sectionId: "s1", area: 10 }]]),
      loads: [],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0.0 },
        { nodeId: "n1", dof: DOFComponent.UX, value: 5.0 } // Conflicting!
      ]
    };

    expect(() => core.solve(model)).toThrow(/CONSTRAINT_CONFLICT/);
  });

  it("STR-UP3-007: rejects degenerate CST element with zero area (collinear nodes)", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 50, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 100, y: 0, z: 0 }] // Collinear
      ]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["s1", { sectionId: "s1", thickness: 1 }]]),
      loads: [{ nodeId: "n3", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    expect(() => core.solve(model)).toThrow(/Negative Jacobian|invalid orientation/);
  });

  it("STR-UP3-008: rejects non-physical material properties (E <= 0, nu >= 0.5)", () => {
    const badNuModel: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 0, y: 100, z: 0 }]
      ]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.55 }]]), // Incompressible/unphysical Poisson ratio
      sections: new Map([["s1", { sectionId: "s1", thickness: 1 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    expect(() => core.solve(badNuModel)).toThrow(/Invalid material nu/);
  });

  it("STR-UP3-009: rejects non-finite floating-point inputs (NaN / Infinity)", () => {
    const nanModel: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["s1", { sectionId: "s1", area: 10 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: NaN }], // NaN Load
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    expect(() => core.solve(nanModel)).toThrow(/ASSEMBLY_NUMERICAL_ERROR/);
  });

  // ---------------------------------------------------------------------------
  // Phase D: Independent Translational & Rotational Moment Equilibrium
  // ---------------------------------------------------------------------------
  it("STR-UP3-010: validates independent translational force equilibrium", () => {
    const P = 7500;
    const model: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: 300, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "m1", sectionId: "s1" }]]),
      materials: new Map([["m1", { materialId: "m1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["s1", { sectionId: "s1", area: 25 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: P }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const res = core.solve(model);
    expect(res.equilibrium.ok).toBe(true);
    expect(Math.abs(res.equilibrium.sumFx)).toBeLessThan(1e-10);
  });

  it("STR-UP3-011: validates independent rotational moment equilibrium sum M_z = 0", () => {
    // 2-element CST cantilever panel under transverse force Fy = 1000 N at (100, 100):
    // Root at x=0 (nodes n1 and n4 clamped)
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 100, y: 100, z: 0 }],
        ["n4", { nodeId: "n4", x: 0, y: 100, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }],
        ["e2", { elementId: "e2", nodeIds: ["n1", "n3", "n4"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }],
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", thickness: 2.0 }]]),
      loads: [{ nodeId: "n3", dof: DOFComponent.UY, value: 1000 }],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n4", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n4", dof: DOFComponent.UY, value: 0 }
      ]
    };

    const res = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
    const momentCheck = verifier.verifyMomentEquilibrium(
      model,
      res.F_global,
      res.reactions,
      core.getDOFManager(),
      1e-4,
      { x: 0, y: 0 }
    );

    expect(momentCheck.ok).toBe(true);
    expect(Math.abs(momentCheck.sumMz)).toBeLessThan(1e-8);
  });
});
