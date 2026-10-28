/**
 * SECP Industrial OS — SECP-PROGRAMMABLE-MATERIAL-006
 * 3D Spatial Material Mapping Implementation & Qualification Test Suite
 */

import { describe, it, expect } from "vitest";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";

describe("SECP-PROGRAMMABLE-MATERIAL-006: 3D Spatial Material Mapping Verification", () => {
  it("PME-006-01: TET4_3D Homogeneous Equivalence with Spatial Field Binding", () => {
    // Single TET4 element or a small block
    const model: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
        ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }],
        ["N4", { nodeId: "N4", x: 0, y: 0, z: 10 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_3D", spatialFieldId: "FIELD_CONST" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 100 }]]),
      loads: [
        { nodeId: "N2", dof: DOFComponent.UX, value: 1000 }
      ],
      boundaryConditions: [
        { nodeId: "N1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UZ, value: 0 }
      ],
      spatialMaterialFields: new Map([
        [
          "FIELD_CONST",
          new SpatialMaterialField(
            "FIELD_CONST",
            "GEO_3D",
            "REV_01",
            "M1",
            new Map([
              [
                "E",
                {
                  propertyName: "E",
                  evaluationType: "CONSTANT",
                  expression: () => 200000,
                  bounds: { lower: 100000, upper: 300000 }
                }
              ]
            ])
          )
        ]
      ])
    };

    const core = new FEMCore();
    const result = core.solve(model, {
      solverType: 'SPARSE_PCG',
      bcMethod: 'DIRECT_ELIMINATION'
    });

    expect(result.equilibrium.ok).toBe(true);
    const ux = result.displacements.get("N2")![DOFComponent.UX]!;
    expect(ux).toBeGreaterThan(0);
  });

  it("PME-006-02: TET4_3D Spatial Gradient Effect", () => {
    // Verify that a graded field modifies the stiffness and displacement compared to base E
    const spatialField = new SpatialMaterialField(
      "FIELD_GRADIENT_3D",
      "GEO_3D",
      "REV_01",
      "M1",
      new Map([
        [
          "E",
          {
            propertyName: "E",
            evaluationType: "ANALYTIC_EXPRESSION",
            expression: (coords) => 100000 * (1 + 0.1 * coords.x),
            bounds: { lower: 50000, upper: 500000 }
          }
        ]
      ])
    );

    const modelGraded: FEMModel = {
      nodes: new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
        ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }],
        ["N4", { nodeId: "N4", x: 0, y: 0, z: 10 }]
      ]),
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_3D", spatialFieldId: "FIELD_GRADIENT_3D" }]
      ]),
      materials: new Map([["M1", { materialId: "M1", E: 100000, nu: 0.3 }]]),
      sections: new Map([["S1", { sectionId: "S1", area: 100 }]]),
      loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
      boundaryConditions: [
        { nodeId: "N1", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N1", dof: DOFComponent.UZ, value: 0 }
      ],
      spatialMaterialFields: new Map([["FIELD_GRADIENT_3D", spatialField]])
    };

    const core = new FEMCore();
    const resultGraded = core.solve(modelGraded, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
    expect(resultGraded.equilibrium.ok).toBe(true);
    const uxGraded = resultGraded.displacements.get("N2")![DOFComponent.UX]!;

    // Baseline without spatial field (E = 100000 constant)
    const modelBase: FEMModel = {
      ...modelGraded,
      elements: new Map([
        ["E1", { elementId: "E1", nodeIds: ["N1", "N2", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_3D" }]
      ]),
      spatialMaterialFields: undefined
    };

    const resultBase = core.solve(modelBase, { solverType: 'SPARSE_PCG', bcMethod: 'DIRECT_ELIMINATION' });
    const uxBase = resultBase.displacements.get("N2")![DOFComponent.UX]!;

    // Since E is higher on average in the graded case (E(x) = 100k(1+0.1x) >= 100k), stiffness is higher, so displacement should be smaller.
    expect(uxGraded).toBeLessThan(uxBase);
  });
});
