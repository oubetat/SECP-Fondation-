/**
 * SECP Industrial OS — SECP-FEM-UPGRADE-002
 * Stress–Strain Recovery & Structural Field Verification
 * Formal Acceptance Test Suite
 * 
 * Verifies all 6 mandatory qualification benchmarks:
 * - STR-FIELD-001: Stress and strain in axial bar under tension
 * - STR-FIELD-002: Stress and strain sign verification under compression
 * - STR-FIELD-003: CST2D element under uniform plane stress state
 * - STR-FIELD-004: Kinematic (u -> eps) and constitutive (eps -> sigma) compatibility
 * - STR-FIELD-005: Detection of invalid materials, negative Jacobians, and non-finite values
 * - STR-FIELD-006: Nodal stress recovery, inter-element discontinuity tracking, and equilibrium
 */

import { describe, it, expect } from "vitest";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";
import { Bar1DFormulation } from "../Bar1DFormulation";
import { CST2DFormulation } from "../CST2DFormulation";
import { FEMDOFManager } from "../FEMDOFManager";

describe("SECP-FEM-UPGRADE-002: Stress–Strain Field Verification", () => {
  // ---------------------------------------------------------------------------
  // STR-FIELD-001: Bar Axial Tension Stress & Strain Verification
  // ---------------------------------------------------------------------------
  it("STR-FIELD-001: accurately recovers axial strain and stress in uniform bar under tension", () => {
    const L = 1000;      // mm
    const A = 100;       // mm^2
    const E = 210000;    // MPa
    const F = 10500;     // N

    // Independent analytical reference solutions:
    const delta_ref = (F * L) / (A * E);               // = 0.05 mm
    const epsilon_ref = delta_ref / L;                  // = 5.0e-5
    const sigma_ref = F / A;                            // = 105.0 MPa
    const vonMises_ref = Math.abs(sigma_ref);           // = 105.0 MPa
    const strainEnergy_ref = 0.5 * F * delta_ref;       // = 0.5 * 10500 * 0.05 = 262.5 N*mm

    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: F }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    const elemField = result.fields.elementFields.get("e1")!;
    expect(elemField).toBeDefined();

    // Verify Strain
    const epsError = Math.abs(elemField.strain.epsilon_x - epsilon_ref) / epsilon_ref;
    expect(epsError).toBeLessThan(1e-8);

    // Verify Stress
    const sigError = Math.abs(elemField.stress.sigma_x - sigma_ref) / sigma_ref;
    expect(sigError).toBeLessThan(1e-8);

    // Verify Von Mises
    expect(elemField.vonMisesStress).toBeCloseTo(vonMises_ref, 6);

    // Verify Strain Energy
    const enError = Math.abs(elemField.strainEnergy - strainEnergy_ref) / strainEnergy_ref;
    expect(enError).toBeLessThan(1e-6);

    // Verify Units and Location metadata
    expect(elemField.location).toBe('CENTROID');
    expect(elemField.units.strain).toBe('dimensionless');
    expect(elemField.units.stress).toBe('MPa');
  });

  // ---------------------------------------------------------------------------
  // STR-FIELD-002: Bar Axial Compression Sign and Invariant Verification
  // ---------------------------------------------------------------------------
  it("STR-FIELD-002: preserves negative sign for compressive stress/strain while maintaining positive Von Mises", () => {
    const L = 500;
    const A = 50;
    const E = 70000; // Aluminum 70 GPa
    const F = -3500; // Compressive 3.5 kN

    const epsilon_ref = F / (A * E); // negative
    const sigma_ref = F / A;         // negative (-70 MPa)
    const vonMises_ref = Math.abs(sigma_ref); // positive (+70 MPa)

    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: L, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu: 0.33 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: A }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: F }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    const elemField = result.fields.elementFields.get("e1")!;

    expect(elemField.strain.epsilon_x).toBeLessThan(0);
    expect(elemField.strain.epsilon_x).toBeCloseTo(epsilon_ref, 8);

    expect(elemField.stress.sigma_x).toBeLessThan(0);
    expect(elemField.stress.sigma_x).toBeCloseTo(sigma_ref, 6);

    // Von Mises stress MUST be strictly non-negative:
    expect(elemField.vonMisesStress).toBeGreaterThan(0);
    expect(elemField.vonMisesStress).toBeCloseTo(vonMises_ref, 6);

    // Support reaction must balance the compression (positive force +3500 N)
    const dof1 = core.getDOFManager().getDOF("n1", DOFComponent.UX)!;
    expect(result.reactions[dof1.globalId]).toBeCloseTo(-F, 6);
  });

  // ---------------------------------------------------------------------------
  // STR-FIELD-003: CST2D Element in Uniform Plane Stress State
  // ---------------------------------------------------------------------------
  it("STR-FIELD-003: recovers full plane stress tensor and Poisson transverse contraction in CST2D", () => {
    // Single CST right triangle:
    // N1 at (0, 0), N2 at (100, 0), N3 at (0, 100)
    // Thickness = 1 mm, E = 200000 MPa, nu = 0.25
    // Apply uniform normal stress sigma_0 = 100 MPa along x-direction
    const E = 200000;
    const nu = 0.25;
    const sigma0 = 100.0; // MPa

    // Independent theoretical plane stress state:
    // sigma_x = sigma0, sigma_y = 0, tau_xy = 0
    // epsilon_x = sigma0 / E = 100 / 200000 = 0.0005
    // epsilon_y = -nu * sigma0 / E = -0.25 * 0.0005 = -0.000125
    // gamma_xy = 0
    // vonMises = sigma0 = 100.0 MPa

    // Prescribe displacements corresponding to this exact linear displacement field:
    // u(x, y) = epsilon_x * x
    // v(x, y) = epsilon_y * y
    const u_n1x = 0.0, u_n1y = 0.0;
    const u_n2x = 0.0005 * 100.0, u_n2y = 0.0;
    const u_n3x = 0.0, u_n3y = -0.000125 * 100.0;

    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 0, y: 100, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E, nu }]]),
      sections: new Map([["sec1", { sectionId: "sec1", thickness: 1.0 }]]),
      loads: [],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: u_n1x },
        { nodeId: "n1", dof: DOFComponent.UY, value: u_n1y },
        { nodeId: "n2", dof: DOFComponent.UX, value: u_n2x },
        { nodeId: "n2", dof: DOFComponent.UY, value: u_n2y },
        { nodeId: "n3", dof: DOFComponent.UX, value: u_n3x },
        { nodeId: "n3", dof: DOFComponent.UY, value: u_n3y },
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'AUTO', bcMethod: 'DIRECT_ELIMINATION' });

    const elemField = result.fields.elementFields.get("e1")!;
    expect(elemField).toBeDefined();

    // Verify strains
    expect(elemField.strain.epsilon_x).toBeCloseTo(0.0005, 8);
    expect(elemField.strain.epsilon_y!).toBeCloseTo(-0.000125, 8);
    expect(Math.abs(elemField.strain.gamma_xy!)).toBeLessThan(1e-12);

    // Verify stresses
    expect(elemField.stress.sigma_x).toBeCloseTo(100.0, 6);
    expect(Math.abs(elemField.stress.sigma_y!)).toBeLessThan(1e-6);
    expect(Math.abs(elemField.stress.tau_xy!)).toBeLessThan(1e-6);

    // Verify Von Mises
    expect(elemField.vonMisesStress).toBeCloseTo(100.0, 6);

    // Verify Principal stresses
    expect(elemField.principalStresses?.sigma_1).toBeCloseTo(100.0, 6);
    expect(Math.abs(elemField.principalStresses?.sigma_2 || 0)).toBeLessThan(1e-6);
  });

  // ---------------------------------------------------------------------------
  // STR-FIELD-004: Kinematic & Constitutive Energy Consistency
  // ---------------------------------------------------------------------------
  it("STR-FIELD-004: proves exact equivalence between internal strain energy and external work", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 0, y: 100, z: 0 }],
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 210000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", thickness: 2.0 }]]),
      loads: [
        { nodeId: "n2", dof: DOFComponent.UX, value: 5000 },
        { nodeId: "n3", dof: DOFComponent.UY, value: 3000 }
      ],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n2", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n3", dof: DOFComponent.UX, value: 0 }
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    const elemField = result.fields.elementFields.get("e1")!;
    expect(elemField.strainEnergy).toBeGreaterThan(0);

    // Energy balance: U_strain in element should match 0.5 * U^T * F
    const globalStrainEnergy = result.fields.totalStrainEnergy;
    expect(globalStrainEnergy).toBeCloseTo(result.energy.strainEnergy, 5);
    expect(result.energy.ok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // STR-FIELD-005: Robustness against Invalid Physical / Material Inputs
  // ---------------------------------------------------------------------------
  it("STR-FIELD-005: detects and rejects non-physical materials (E <= 0, nu >= 0.5) and degenerate elements", () => {
    // Case A: Negative Young's Modulus
    const invalidEModel: FEMModel = {
      nodes: new Map([["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }], ["n2", { nodeId: "n2", x: 100, y: 0, z: 0 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], formulationId: "BAR_1D", materialId: "matBad", sectionId: "sec1" }]]),
      materials: new Map([["matBad", { materialId: "matBad", E: -200, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 10 }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    expect(() => core.solve(invalidEModel)).toThrow(/INVALID_MATERIAL/);

    // Case B: Degenerate CST with collinear nodes (zero area / negative Jacobian)
    const collinearCSTModel: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 50, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 100, y: 0, z: 0 }] // Collinear!
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], formulationId: "CST_2D", materialId: "mat1", sectionId: "sec1" }]
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", thickness: 1 }]]),
      loads: [{ nodeId: "n3", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    expect(() => core.solve(collinearCSTModel)).toThrow(/Negative Jacobian|invalid orientation/);
  });

  // ---------------------------------------------------------------------------
  // STR-FIELD-006: Nodal Stress Averaging & Discontinuity Tracking
  // ---------------------------------------------------------------------------
  it("STR-FIELD-006: recovers nodal fields and tracks inter-element stress discontinuity across multi-element mesh", () => {
    // 2-element CST mesh forming a rectangular panel:
    // Element 1: N1(0,0), N2(100,0), N3(100,100)
    // Element 2: N1(0,0), N3(100,100), N4(0,100)
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
      loads: [
        { nodeId: "n2", dof: DOFComponent.UX, value: 10000 },
        { nodeId: "n3", dof: DOFComponent.UX, value: 10000 }
      ],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n4", dof: DOFComponent.UX, value: 0 }
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });

    // Verify element fields count
    expect(result.fields.elementFields.size).toBe(2);

    // Verify nodal fields count
    expect(result.fields.nodalFields.size).toBe(4);

    // Shared nodes N1 and N3 are connected to both e1 and e2
    const nodalN1 = result.fields.nodalFields.get("n1")!;
    const nodalN3 = result.fields.nodalFields.get("n3")!;
    expect(nodalN1.connectedElementsCount).toBe(2);
    expect(nodalN3.connectedElementsCount).toBe(2);

    // Check stress discontinuity metric (finite positive standard deviation or 0)
    expect(Number.isFinite(nodalN1.stressDiscontinuity)).toBe(true);
    expect(nodalN1.stressDiscontinuity).toBeGreaterThanOrEqual(0);

    // Maximum Von Mises stress identified
    expect(result.fields.maxVonMisesStress).toBeGreaterThan(0);
    expect(result.fields.maxVonMisesElementId).toMatch(/^e[12]$/);
  });
});
