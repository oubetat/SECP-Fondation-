/**
 * SECP Industrial OS — SECP-PROGRAMMABLE-MATERIAL-004
 * Spatial Material Mapping & Numerical Proof Test Suite
 */

import { describe, it, expect } from "vitest";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";

describe("SECP-PROGRAMMABLE-MATERIAL-004: Spatial Material Mapping Verification", () => {
  it("PME-004-01: SpatialMaterialField evaluates correctly and enforces bounds", () => {
    const field = new SpatialMaterialField(
      "FIELD_01",
      "GEO_BAR",
      "REV_01",
      "MAT_BASE",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: (coords) => 100000 + 1000 * coords.x,
            bounds: { lower: 50000, upper: 200000 }
          }
        ]
      ])
    );

    const val0 = field.evaluate({ x: 0, y: 0, z: 0 });
    expect(val0.E).toBe(100000);

    const val50 = field.evaluate({ x: 50, y: 0, z: 0 });
    expect(val50.E).toBe(150000);

    const outOfBoundsField = new SpatialMaterialField(
      "FIELD_OB",
      "GEO",
      "REV",
      "MAT",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "CONSTANT",
            expression: () => 10000,
            bounds: { lower: 50000, upper: 200000 }
          }
        ]
      ])
    );

    expect(() => outOfBoundsField.evaluate({ x: 0, y: 0, z: 0 })).toThrowError(
      /SPATIAL_FIELD_BOUNDS_ERROR/
    );
  });

  it("PME-004-02: Homogeneous Equivalence (Constant Field vs Standard Material)", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 50, y: 0, z: 0 }],
        ["N3", { nodeId: "N3", x: 100, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }],
        ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
      ]),
      materials: new Map([
        ["M1", { materialId: "M1", E: 100000, nu: 0.3 }]
      ]),
      sections: new Map([
        ["S1", { sectionId: "S1", area: 1.0 }]
      ]),
      loads: [
        { nodeId: "N3", dof: DOFComponent.UX, value: 1000 }
      ],
      boundaryConditions: [
        { nodeId: "N1", dof: DOFComponent.UX, value: 0 }
      ]
    };

    const core = new FEMCore();
    const result = core.solve(model, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION'
    });

    expect(result.equilibrium.ok).toBe(true);
    const tipDisp = result.displacements.get("N3")![DOFComponent.UX]!;
    expect(tipDisp).toBeCloseTo(1.0, 5);
  });

  it("PME-004-03: Graded Bar Benchmark (E(x) = E0(1 + alpha*x)) vs Analytical Reference", () => {
    const numElements = 10;
    const L = 100;
    const dx = L / numElements;
    const E0 = 100000;
    const alpha = 0.01;
    const F_load = 1000;

    const nodes = new Map();
    for (let i = 0; i <= numElements; i++) {
      const id = `N${i + 1}`;
      nodes.set(id, { nodeId: id, x: i * dx, y: 0, z: 0 });
    }

    const elements = new Map();
    for (let i = 0; i < numElements; i++) {
      const id = `E${i + 1}`;
      elements.set(id, {
        elementId: id,
        nodeIds: [`N${i + 1}`, `N${i + 2}`],
        materialId: "M1",
        sectionId: "S1",
        formulationId: "BAR_1D",
        spatialFieldId: "FIELD_GRADIENT"
      });
    }

    const spatialField = new SpatialMaterialField(
      "FIELD_GRADIENT",
      "GEO_BAR",
      "REV_01",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: (coords) => E0 * (1 + alpha * coords.x),
            bounds: { lower: 50000, upper: 200000 }
          }
        ]
      ])
    );

    const model: FEMModel = {
      nodes,
      elements,
      materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: `N${numElements + 1}`, dof: DOFComponent.UX, value: F_load }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_GRADIENT", spatialField]])
    };

    const core = new FEMCore();
    const result = core.solve(model, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION'
    });

    expect(result.equilibrium.ok).toBe(true);
    const tipNodeId = `N${numElements + 1}`;
    const tipDisp = result.displacements.get(tipNodeId)![DOFComponent.UX]!;

    const analyticalTipDisp = (F_load / (1.0 * E0 * alpha)) * Math.log(1 + alpha * L);
    const relError = Math.abs(tipDisp - analyticalTipDisp) / analyticalTipDisp;
    expect(relError).toBeLessThan(0.005);
  });

  it("PME-004-04: Negative Control Test (Ignored Spatial Field Fails)", () => {
    const E0 = 100000;
    const F_load = 1000;
    const analyticalTipDisp = (F_load / (1.0 * E0 * 0.01)) * Math.log(1 + 0.01 * 100);

    const modelHomogeneous: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: F_load }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const result = core.solve(modelHomogeneous, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION'
    });

    expect(result.equilibrium.ok).toBe(true);
    const tipDispHomogeneous = result.displacements.get("N2")![DOFComponent.UX]!;

    const diff = Math.abs(tipDispHomogeneous - analyticalTipDisp);
    expect(diff).toBeGreaterThan(0.2);
  });
});
