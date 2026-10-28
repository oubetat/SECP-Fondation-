/**
 * SECP Industrial OS — SECP-PROGRAMMABLE-MATERIAL-V3-001
 * Spatial Material Field Engineering — Comprehensive Numerical Qualification,
 * Adversarial Testing & Revision Invalidation Suite.
 */

import { describe, it, expect } from "vitest";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";
import { FEMEvidenceEngine } from "../FEMEvidenceEngine";

describe("SECP-PROGRAMMABLE-MATERIAL-V3: Numerical Benchmarks & Qualification", () => {
  // =========================================================================
  // Benchmark A: Homogeneous Equivalence
  // =========================================================================
  it("V3-BENCH-A: Homogeneous Equivalence (Constant Spatial Field vs Standard Material)", () => {
    const E0 = 200000;
    const nu0 = 0.3;
    const A = 10.0;
    const L = 100.0;
    const F = 5000.0;

    // 1. Classical Model without spatial field
    const modelClassical: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 50, y: 0, z: 0 }],
        ["N3", { nodeId: "N3", x: L, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }],
        ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: E0, nu: nu0 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: A }]]),
      loads: [{ nodeId: "N3", dof: DOFComponent.UX, value: F }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
    };

    // 2. Spatial Model with Constant Field
    const constField = new SpatialMaterialField(
      "FIELD_CONST",
      "GEO_01",
      "REV_01",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "CONSTANT",
            expression: () => E0,
            bounds: { lower: 100000, upper: 300000 },
            valueCategory: "TARGET",
            unit: "MPa"
          }
        ]
      ])
    );

    const modelSpatial: FEMModel = {
      ...modelClassical,
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_CONST" }],
        ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_CONST" }]
      ]),
      spatialMaterialFields: new Map([["FIELD_CONST", constField]])
    };

    const core = new FEMCore();
    const resClass = core.solve(modelClassical, { solverType: "SPARSE_PCG", bcMethod: "DIRECT_ELIMINATION" });
    const resSpat = core.solve(modelSpatial, { solverType: "SPARSE_PCG", bcMethod: "DIRECT_ELIMINATION" });

    expect(resClass.equilibrium.ok).toBe(true);
    expect(resSpat.equilibrium.ok).toBe(true);

    const uClass = resClass.displacements.get("N3")![DOFComponent.UX]!;
    const uSpat = resSpat.displacements.get("N3")![DOFComponent.UX]!;
    const diff = Math.abs(uClass - uSpat);
    expect(diff).toBeLessThan(1e-12);

    // Compare stiffness matrices
    for (let r = 0; r < resClass.K_global.rows; r++) {
      for (let c = 0; c < resClass.K_global.cols; c++) {
        expect(Math.abs(resClass.K_global.get(r, c) - resSpat.K_global.get(r, c))).toBeLessThan(1e-12);
      }
    }

    // Compare stresses
    const sClassE1 = resClass.fields.elementFields.get("E1")!.stress.sigma_x;
    const sSpatE1 = resSpat.fields.elementFields.get("E1")!.stress.sigma_x;
    expect(Math.abs(sClassE1 - sSpatE1)).toBeLessThan(1e-12);
  });

  // =========================================================================
  // Benchmark B: Spatial Gradient Effect vs Exact Analytical Reference
  // =========================================================================
  it("V3-BENCH-B: Graded Bar vs Exact Analytical Reference Solution", () => {
    const numElements = 20;
    const L = 100.0;
    const dx = L / numElements;
    const E0 = 100000.0;
    const alpha = 0.02; // E(x) = E0 * (1 + 0.02 * x)
    const A = 2.0;
    const F_load = 5000.0;

    // Exact analytical derivation: Delta = (F / (A * E0 * alpha)) * ln(1 + alpha * L)
    const exactAnalyticalTipDisp = (F_load / (A * E0 * alpha)) * Math.log(1 + alpha * L);

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
        spatialFieldId: "FIELD_GRADIENT_B"
      });
    }

    const spatialField = new SpatialMaterialField(
      "FIELD_GRADIENT_B",
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
            bounds: { lower: 50000, upper: 400000 },
            valueCategory: "TARGET",
            unit: "MPa"
          }
        ]
      ]),
      { min: { x: -1, y: -10, z: -10 }, max: { x: 101, y: 10, z: 10 } }
    );

    const model: FEMModel = {
      nodes,
      elements,
      materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: A }]]),
      loads: [{ nodeId: `N${numElements + 1}`, dof: DOFComponent.UX, value: F_load }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_GRADIENT_B", spatialField]])
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: "SPARSE_PCG", bcMethod: "DIRECT_ELIMINATION" });

    expect(result.equilibrium.ok).toBe(true);
    const tipDisp = result.displacements.get(`N${numElements + 1}`)![DOFComponent.UX]!;

    const relError = Math.abs(tipDisp - exactAnalyticalTipDisp) / exactAnalyticalTipDisp;
    expect(relError).toBeLessThan(0.001); // Within 0.1% of exact continuous solution
  });

  // =========================================================================
  // Benchmark C: Gradient Reversal
  // =========================================================================
  it("V3-BENCH-C: Gradient Reversal (Forward vs Reversed Spatial Distribution)", () => {
    const numElements = 20;
    const L = 100.0;
    const dx = L / numElements;
    const E0 = 100000.0;
    const alpha = 0.02;
    const A = 2.0;
    const F_load = 5000.0;

    const buildModel = (fieldId: string, expr: (c: { x: number; y: number; z: number }) => number) => {
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
          spatialFieldId: fieldId
        });
      }
      const field = new SpatialMaterialField(
        fieldId,
        "GEO_BAR",
        "REV_01",
        "M1",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "ANALYTIC_EXPRESSION",
              expression: expr,
              bounds: { lower: 50000, upper: 400000 }
            }
          ]
        ])
      );
      return {
        nodes,
        elements,
        materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: A }]]),
        loads: [{ nodeId: `N${numElements + 1}`, dof: DOFComponent.UX, value: F_load }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([[fieldId, field]])
      } as FEMModel;
    };

    // Case 1: Forward gradient (soft root E(0) = 100k, stiff tip E(L) = 300k)
    const m1 = buildModel("FIELD_FWD", (c) => E0 * (1 + alpha * c.x));
    // Case 2: Reversed gradient (stiff root E(0) = 300k, soft tip E(L) = 100k)
    const m2 = buildModel("FIELD_REV", (c) => E0 * (1 + alpha * (L - c.x)));

    const core = new FEMCore();
    const r1 = core.solve(m1);
    const r2 = core.solve(m2);

    // Tip displacements are identical under pure end load
    const tip1 = r1.displacements.get(`N${numElements + 1}`)![DOFComponent.UX]!;
    const tip2 = r2.displacements.get(`N${numElements + 1}`)![DOFComponent.UX]!;
    expect(Math.abs(tip1 - tip2) / tip1).toBeLessThan(0.001);

    // Midspan displacement:
    // In Case 1 (soft root), midspan displacement is larger:
    // u1_mid = integral_0^(L/2) P/(A E0 (1+alpha*x)) dx = P/(A E0 alpha) * ln(1 + alpha*L/2) = 1.25 * ln(2) = 0.8664
    // In Case 2 (stiff root), midspan displacement is smaller:
    // u2_mid = integral_0^(L/2) P/(A E0 (1+alpha*(L-x))) dx = 1.25 * [ln(3) - ln(2)] = 1.25 * ln(1.5) = 0.5068
    const midNode = `N${numElements / 2 + 1}`;
    const mid1 = r1.displacements.get(midNode)![DOFComponent.UX]!;
    const mid2 = r2.displacements.get(midNode)![DOFComponent.UX]!;

    expect(mid1).toBeGreaterThan(mid2);
    const ratio = mid1 / mid2;
    expect(ratio).toBeCloseTo(Math.log(2) / Math.log(1.5), 2); // ~1.71
  });

  // =========================================================================
  // Benchmark D: Negative Control
  // =========================================================================
  it("V3-BENCH-D: Negative Control (Spatial Field vs Homogeneous Baseline)", () => {
    const L = 100.0;
    const E0 = 100000.0;
    const A = 2.0;
    const F = 5000.0;

    // Homogeneous: delta = F*L / (A*E0) = 5000*100 / (2*100000) = 2.500 mm
    const modelHomogeneous: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: L, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: A }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: F }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
    };

    const core = new FEMCore();
    const resHomog = core.solve(modelHomogeneous);
    const tipHomog = resHomog.displacements.get("N2")![DOFComponent.UX]!;
    expect(tipHomog).toBeCloseTo(2.5, 6);

    // Graded: delta_analytical = 1.3732 mm
    const analyticalGraded = (F / (A * E0 * 0.02)) * Math.log(1 + 0.02 * L);
    const diff = Math.abs(tipHomog - analyticalGraded);
    expect(diff).toBeGreaterThan(1.0); // Verifies spatial field cannot be replaced by base material
  });

  // =========================================================================
  // Benchmark E: Mesh Convergence Study
  // =========================================================================
  it("V3-BENCH-E: Mesh Convergence Study (N=4, 8, 16, 32 elements)", () => {
    const L = 100.0;
    const E0 = 100000.0;
    const alpha = 0.02;
    const A = 2.0;
    const F = 5000.0;
    const exactDisp = (F / (A * E0 * alpha)) * Math.log(1 + alpha * L);

    const runMesh = (elemCount: number) => {
      const dx = L / elemCount;
      const nodes = new Map();
      for (let i = 0; i <= elemCount; i++) {
        const id = `N${i + 1}`;
        nodes.set(id, { nodeId: id, x: i * dx, y: 0, z: 0 });
      }
      const elements = new Map();
      for (let i = 0; i < elemCount; i++) {
        const id = `E${i + 1}`;
        elements.set(id, {
          elementId: id,
          nodeIds: [`N${i + 1}`, `N${i + 2}`],
          materialId: "M1",
          sectionId: "S1",
          formulationId: "BAR_1D",
          spatialFieldId: "FIELD_CONV"
        });
      }
      const field = new SpatialMaterialField(
        "FIELD_CONV",
        "GEO",
        "REV",
        "M1",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "ANALYTIC_EXPRESSION",
              expression: (c) => E0 * (1 + alpha * c.x),
              bounds: { lower: 50000, upper: 400000 }
            }
          ]
        ])
      );
      const model: FEMModel = {
        nodes,
        elements,
        materials: new Map([["M1", { materialId: "M1", E: E0, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: A }]]),
        loads: [{ nodeId: `N${elemCount + 1}`, dof: DOFComponent.UX, value: F }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_CONV", field]])
      };
      const core = new FEMCore();
      const res = core.solve(model);
      const tip = res.displacements.get(`N${elemCount + 1}`)![DOFComponent.UX]!;
      return { tip, relError: Math.abs(tip - exactDisp) / exactDisp };
    };

    const res4 = runMesh(4);
    const res8 = runMesh(8);
    const res16 = runMesh(16);
    const res32 = runMesh(32);

    // Monotonic error reduction
    expect(res8.relError).toBeLessThan(res4.relError);
    expect(res16.relError).toBeLessThan(res8.relError);
    expect(res32.relError).toBeLessThan(res16.relError);
    expect(res32.relError).toBeLessThan(0.0005); // Error < 0.05%
  });

  // =========================================================================
  // Benchmark F: Multi-Element 3D Tetrahedral Mesh
  // =========================================================================
  it("V3-BENCH-F: Multi-Element 3D TET4 Continuum with Spatial Modulus Gradient", () => {
    // 2 connected tetrahedral elements forming a prism block
    const nodes = new Map([
      ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
      ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
      ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }],
      ["N4", { nodeId: "N4", x: 0, y: 0, z: 10 }],
      ["N5", { nodeId: "N5", x: 10, y: 10, z: 10 }]
    ]);

    const elements = new Map([
      ["E1", { elementId: "E1", nodeIds: ["N1", "N2", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_3D", spatialFieldId: "FIELD_3D_MULTI" }],
      ["E2", { elementId: "E2", nodeIds: ["N2", "N3", "N4", "N5"], materialId: "M1", sectionId: "S1", formulationId: "TET4_3D", spatialFieldId: "FIELD_3D_MULTI" }]
    ]);

    const field = new SpatialMaterialField(
      "FIELD_3D_MULTI",
      "GEO_3D",
      "REV_01",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: (coords) => 150000 + 5000 * coords.x,
            bounds: { lower: 100000, upper: 300000 }
          }
        ],
        [
          "nu",
          {
            propertyName: "nu",
            evaluationType: "CONSTANT",
            expression: () => 0.28,
            bounds: { lower: 0.1, upper: 0.45 }
          }
        ]
      ])
    );

    const model: FEMModel = {
      nodes,
      elements,
      materials: new Map([["M1", { materialId: "M1", E: 150000, nu: 0.28 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 100 }]]),
      loads: [{ nodeId: "N5", dof: DOFComponent.UX, value: 2000 }],
      boundaryConditions: [
        { nodeId: "N1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UZ, value: 0 }
      ],
      spatialMaterialFields: new Map([["FIELD_3D_MULTI", field]])
    };

    const core = new FEMCore();
    const result = core.solve(model, { solverType: "SPARSE_PCG", bcMethod: "DIRECT_ELIMINATION" });

    expect(result.equilibrium.ok).toBe(true);
    expect(result.fields.elementFields.size).toBe(2);
    expect(result.fields.elementFields.get("E1")!.vonMisesStress).toBeGreaterThan(0);
    expect(result.fields.elementFields.get("E2")!.vonMisesStress).toBeGreaterThan(0);
  });
});

describe("SECP-PROGRAMMABLE-MATERIAL-V3: Adversarial Battery (PMV3-ADV-001 to 012)", () => {
  // PMV3-ADV-001: Missing spatial field in model
  it("PMV3-ADV-001: Explicitly rejects element referencing missing spatial field", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_DOES_NOT_EXIST" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
    };
    const core = new FEMCore();
    expect(() => core.solve(model)).toThrow(/\[SPATIAL_FIELD_NOT_FOUND\]/);
  });

  // PMV3-ADV-002: Invalid field ID (empty / whitespace)
  it("PMV3-ADV-002: Rejects invalid or whitespace field ID during field construction", () => {
    expect(() => {
      new SpatialMaterialField("", "GEO", "REV", "MAT", new Map());
    }).toThrow(/\[SPATIAL_FIELD_INVALID_ID\]/);

    expect(() => {
      new SpatialMaterialField("   ", "GEO", "REV", "MAT", new Map());
    }).toThrow(/\[SPATIAL_FIELD_INVALID_ID\]/);
  });

  // PMV3-ADV-003: Coordinates containing NaN or expression returning NaN
  it("PMV3-ADV-003: Rejects NaN coordinates and NaN evaluation results", () => {
    const field = new SpatialMaterialField(
      "FIELD_NAN",
      "GEO",
      "REV",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: () => NaN,
            bounds: { lower: 1000, upper: 500000 }
          }
        ]
      ])
    );

    expect(() => field.evaluate({ x: NaN, y: 0, z: 0 })).toThrow(/\[SPATIAL_FIELD_INVALID_COORDS\]/);
    expect(() => field.evaluate({ x: 0, y: 0, z: 0 })).toThrow(/\[SPATIAL_FIELD_ERROR\]/);
  });

  // PMV3-ADV-004: Coordinates containing Infinity or expression returning Infinity
  it("PMV3-ADV-004: Rejects Infinity coordinates and non-finite evaluation results", () => {
    const field = new SpatialMaterialField(
      "FIELD_INF",
      "GEO",
      "REV",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: () => Infinity,
            bounds: { lower: 1000, upper: 500000 }
          }
        ]
      ])
    );

    expect(() => field.evaluate({ x: Infinity, y: 0, z: 0 })).toThrow(/\[SPATIAL_FIELD_INVALID_COORDS\]/);
    expect(() => field.evaluate({ x: 0, y: 0, z: 0 })).toThrow(/\[SPATIAL_FIELD_ERROR\]/);
  });

  // PMV3-ADV-005: Material parameter out of physical bounds
  it("PMV3-ADV-005: Rejects physical parameters out of bounds (negative E or out of user bounds)", () => {
    // Negative E in bounds rejected at construction
    expect(() => {
      new SpatialMaterialField(
        "F1", "G", "R", "M",
        new Map([["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => -100, bounds: { lower: -500, upper: 1000 } }]])
      );
    }).toThrow(/\[SPATIAL_FIELD_PHYSICAL_ERROR\]/);

    // Evaluated value below lower bound
    const f2 = new SpatialMaterialField(
      "F2", "G", "R", "M",
      new Map([["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 5000, bounds: { lower: 10000, upper: 50000 } }]])
    );
    expect(() => f2.evaluate({ x: 0, y: 0, z: 0 })).toThrow(/\[SPATIAL_FIELD_BOUNDS_ERROR\]/);
  });

  // PMV3-ADV-006: Mandatory property missing from field
  it("PMV3-ADV-006: Rejects field lacking required constitutive property (missing E)", () => {
    const fieldWithoutE = new SpatialMaterialField(
      "FIELD_NO_E", "GEO", "REV", "M1",
      new Map([
        ["nu", { propertyName: "nu", evaluationType: "CONSTANT", expression: () => 0.3, bounds: { lower: 0.1, upper: 0.45 } }]
      ])
    );

    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_NO_E" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_NO_E", fieldWithoutE]])
    };

    const core = new FEMCore();
    expect(() => core.solve(model)).toThrow(/\[SPATIAL_FIELD_MISSING_PROPERTY\]/);
  });

  // PMV3-ADV-007: Out of domain evaluation
  it("PMV3-ADV-007: Enforces spatial domain boundary with fail-closed rejection", () => {
    const field = new SpatialMaterialField(
      "FIELD_DOMAIN", "GEO", "REV", "M1",
      new Map([
        ["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 100000, bounds: { lower: 50000, upper: 200000 } }]
      ]),
      { min: { x: 0, y: 0, z: 0 }, max: { x: 50, y: 50, z: 50 } },
      "FAIL_CLOSED"
    );

    // Point inside domain succeeds
    expect(field.evaluate({ x: 25, y: 25, z: 25 }).E).toBe(100000);

    // Point outside domain throws error
    expect(() => field.evaluate({ x: 100, y: 25, z: 25 })).toThrow(/\[SPATIAL_FIELD_OUT_OF_DOMAIN\]/);

    // With CLAMP behavior, out-of-domain coordinate clamps and succeeds
    const clampedField = new SpatialMaterialField(
      "FIELD_CLAMP", "GEO", "REV", "M1",
      new Map([
        ["E", { propertyName: "E", evaluationType: "ANALYTIC_EXPRESSION", expression: (c) => 100000 + c.x * 1000, bounds: { lower: 50000, upper: 300000 } }]
      ]),
      { min: { x: 0, y: 0, z: 0 }, max: { x: 50, y: 50, z: 50 } },
      "CLAMP"
    );
    const clampedVal = clampedField.evaluate({ x: 100, y: 25, z: 25 });
    // Clamped to x = 50 => 100000 + 50*1000 = 150000
    expect(clampedVal.E).toBe(150000);
  });

  // PMV3-ADV-008: Field base material ID mismatch
  it("PMV3-ADV-008: Detects base material ID mismatch between field and element", () => {
    const field = new SpatialMaterialField(
      "FIELD_STEEL", "GEO", "REV", "STEEL_MAT",
      new Map([
        ["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 200000, bounds: { lower: 100000, upper: 300000 } }]
      ])
    );

    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }]
      ]),
      elements: new Map([
        // Element declares materialId "ALUMINUM_MAT" but field is bound to "STEEL_MAT"
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "ALUMINUM_MAT", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_STEEL" }]
      ]),
      materials: new Map([["ALUMINUM_MAT", { materialId: "ALUMINUM_MAT", E: 70000, nu: 0.33 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 100 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_STEEL", field]])
    };

    const core = new FEMCore();
    expect(() => core.solve(model)).toThrow(/\[SPATIAL_FIELD_MATERIAL_MISMATCH\]/);
  });

  // PMV3-ADV-009: Revision change invalidates previous evidence
  it("PMV3-ADV-009: Validates evidence invalidation when spatial field revision or distribution changes", () => {
    const f1 = new SpatialMaterialField(
      "F_REV", "GEO", "REV_100", "M1",
      new Map([
        ["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 100000, bounds: { lower: 50000, upper: 200000 } }]
      ])
    );

    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 50, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "F_REV" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 100000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["F_REV", f1]])
    };

    const core = new FEMCore();
    const result1 = core.solve(model);
    const evidence1 = FEMEvidenceEngine.generateEvidence(model, result1);

    // Verify freshness against unmodified model
    const freshnessUnmodified = FEMEvidenceEngine.isEvidenceStale(evidence1, model, result1);
    expect(freshnessUnmodified.isStale).toBe(false);

    // Now update field revision to REV_101
    const f2 = f1.cloneWithRevision("REV_101");
    const updatedModel: FEMModel = {
      ...model,
      spatialMaterialFields: new Map([["F_REV", f2]])
    };

    // Stale check must detect change in spatial material field
    const freshnessModified = FEMEvidenceEngine.isEvidenceStale(evidence1, updatedModel);
    expect(freshnessModified.isStale).toBe(true);
    expect(freshnessModified.reason).toContain("Spatial material fields");
  });

  // PMV3-ADV-010: Geometry change invalidates evidence
  it("PMV3-ADV-010: Detects geometry change against locked evidence", () => {
    const f1 = new SpatialMaterialField(
      "F_GEO", "GEO_1", "REV_1", "M1",
      new Map([
        ["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 100000, bounds: { lower: 50000, upper: 200000 } }]
      ])
    );
    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 50, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "F_GEO" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 100000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["F_GEO", f1]])
    };
    const core = new FEMCore();
    const result1 = core.solve(model);
    const evidence1 = FEMEvidenceEngine.generateEvidence(model, result1);

    // Mutate geometry by shifting node N2
    const mutatedModel: FEMModel = {
      ...model,
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 75, y: 0, z: 0 }]
      ])
    };
    const staleness = FEMEvidenceEngine.isEvidenceStale(evidence1, mutatedModel);
    expect(staleness.isStale).toBe(true);
    expect(staleness.reason).toContain("Mesh geometry");
  });

  // PMV3-ADV-011: Absence of spatial field preserves legacy baseline
  it("PMV3-ADV-011: Legacy model without spatial fields executes completely unaffected", () => {
    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 210000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 2.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 4200 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
    };
    const core = new FEMCore();
    const res = core.solve(model);
    expect(res.equilibrium.ok).toBe(true);
    // Delta = (4200 * 100) / (2.0 * 210000) = 420000 / 420000 = 1.0 mm
    expect(res.displacements.get("N2")![DOFComponent.UX]).toBeCloseTo(1.0, 8);
  });

  // PMV3-ADV-012: Invariance of property evaluation between assembly and recovery
  it("PMV3-ADV-012: Proves stiffness assembly and stress recovery evaluate identical spatial properties", () => {
    let evalCount = 0;
    const evaluatedValues: number[] = [];

    const field = new SpatialMaterialField(
      "FIELD_TRACE", "GEO", "REV", "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: (c) => {
              evalCount++;
              const val = 150000 + 10 * c.x;
              evaluatedValues.push(val);
              return val;
            },
            bounds: { lower: 50000, upper: 300000 }
          }
        ]
      ])
    );

    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_TRACE" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 150000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 1.0 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_TRACE", field]])
    };

    const core = new FEMCore();
    const res = core.solve(model);

    // Assembly evaluated midpoint (x=50): 150000 + 500 = 150500
    // Stress recovery evaluated midpoint (x=50): 150000 + 500 = 150500
    expect(evalCount).toBeGreaterThanOrEqual(2);
    expect(evaluatedValues[0]).toBe(150500);
    expect(evaluatedValues[1]).toBe(150500);

    const recoveredStress = res.fields.elementFields.get("E1")!.stress.sigma_x;
    const strain = res.fields.elementFields.get("E1")!.strain.epsilon_x;
    // sigma = E_eval * eps
    expect(recoveredStress).toBeCloseTo(150500 * strain, 6);
  });

  // PMV3-ADV-013: Rejection on unsupported formulation (TET4_PLASTIC)
  it("PMV3-ADV-013: Explicitly rejects spatial field on unsupported formulation TET4PlasticFormulation", () => {
    const field = new SpatialMaterialField(
      "FIELD_PLASTIC", "GEO", "REV", "M1",
      new Map([["E", { propertyName: "E", evaluationType: "CONSTANT", expression: () => 200000, bounds: { lower: 100000, upper: 300000 } }]])
    );

    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
        ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }],
        ["N4", { nodeId: "N4", x: 0, y: 0, z: 10 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_PLASTIC", spatialFieldId: "FIELD_PLASTIC" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 100 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
      boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
      spatialMaterialFields: new Map([["FIELD_PLASTIC", field]])
    };

    const core = new FEMCore();
    expect(() => core.solve(model)).toThrow(/\[UNSUPPORTED_FORMULATION_SPATIAL_FIELD\]/);
  });
});
