import { describe, it, expect } from "vitest";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";

describe("FEMCore - 1D Axial Bar Benchmark", () => {
  it("should assemble and solve a single 1D bar correctly", () => {
    // 1D Bar, L = 10, A = 2, E = 100
    // Node 1 at x=0 (fixed), Node 2 at x=10 (load P = 50)
    // k = E*A/L = 100 * 2 / 10 = 20
    // F = 50
    // U2 = F/k = 50 / 20 = 2.5
    // R1 = -50

    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
      ]),
      materials: new Map([
        ["mat1", { materialId: "mat1", E: 100, nu: 0.3 }]
      ]),
      sections: new Map([
        ["sec1", { sectionId: "sec1", area: 2 }]
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2"], materialId: "mat1", sectionId: "sec1", formulationId: "BAR_1D" }]
      ]),
      loads: [
        { nodeId: "n2", dof: DOFComponent.UX, value: 50 }
      ],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 }
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model);

    expect(result.equilibrium.ok).toBe(true);
    
    // Check global matrix is symmetric
    expect(result.K_global.isSymmetric()).toBe(true);

    // Check displacement U2
    const u2 = result.displacements.get("n2")![DOFComponent.UX]!;
    expect(u2).toBeCloseTo(2.5, 5);

    // Check reaction R1
    const dof1 = core.getDOFManager().getDOF("n1", DOFComponent.UX)!;
    const r1 = result.reactions[dof1.globalId];
    expect(r1).toBeCloseTo(-50, 5);
  });
});

describe("FEMCore - 2D CST Benchmark", () => {
  it("should assemble and solve a single 2D CST element correctly", () => {
    // Square domain approximated by 1 triangle? Let's just use a single triangle.
    // N1 (0, 0), N2 (10, 0), N3 (0, 10)
    // E = 210e3, nu = 0.3, t = 1
    // Fixed at N1 (UX, UY), Fixed at N2 (UY), Fixed at N3 (UX) -> Just to constrain rigid body modes
    // Load at N2 (UX = 100)
    
    const model: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
        ["n3", { nodeId: "n3", x: 0, y: 10, z: 0 }],
      ]),
      materials: new Map([
        ["mat1", { materialId: "mat1", E: 210000, nu: 0.3 }]
      ]),
      sections: new Map([
        ["sec1", { sectionId: "sec1", thickness: 1 }]
      ]),
      elements: new Map([
        ["e1", { elementId: "e1", nodeIds: ["n1", "n2", "n3"], materialId: "mat1", sectionId: "sec1", formulationId: "CST_2D" }]
      ]),
      loads: [
        { nodeId: "n2", dof: DOFComponent.UX, value: 1000 },
        { nodeId: "n3", dof: DOFComponent.UY, value: 500 }
      ],
      boundaryConditions: [
        { nodeId: "n1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "n1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "n2", dof: DOFComponent.UY, value: 0 }, // roller
        { nodeId: "n3", dof: DOFComponent.UX, value: 0 }, // roller
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model);

    expect(result.equilibrium.ok).toBe(true);
    expect(result.K_global.isSymmetric()).toBe(true);

    const u2x = result.displacements.get("n2")![DOFComponent.UX]!;
    const u3y = result.displacements.get("n3")![DOFComponent.UY]!;
    
    // We expect some non-zero displacement, finite and traceable
    expect(u2x).toBeGreaterThan(0);
    expect(u3y).toBeGreaterThan(0);

    // Ensure energy is positive
    expect(result.energy.strainEnergy).toBeGreaterThan(0);
  });
});
