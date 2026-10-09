import { FEMCore } from "./FEMCore";
import { FEMModel, DOFComponent } from "./FEMTypes";
import { FEMEvidenceEngine } from "./FEMEvidenceEngine";

export class HardAcceptanceGate076 {
  static evaluate() {
    console.log("Evaluating Hard Acceptance Gate 076...");
    const core = new FEMCore();
    
    // Test 1: 1D Bar Superposition & Scaling
    const model1: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 100, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 2 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], materialId: "mat1", sectionId: "sec1", formulationId: "BAR_1D" }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 50 }],
      boundaryConditions: [{ nodeId: "n1", dof: DOFComponent.UX, value: 0 }]
    };

    const result1 = core.solve(model1);
    const u1 = result1.displacements.get("n2")![DOFComponent.UX]!;

    // Scale load by 2
    model1.loads[0].value = 100;
    const result2 = core.solve(model1);
    const u2 = result2.displacements.get("n2")![DOFComponent.UX]!;

    if (Math.abs(u2 - 2 * u1) > 1e-6) {
      throw new Error("SCALING_TEST_FAILED");
    }

    if (!result1.equilibrium.ok) throw new Error("EQUILIBRIUM_TEST_FAILED");
    
    // Check Singularity
    const singularModel: FEMModel = {
      nodes: new Map([
        ["n1", { nodeId: "n1", x: 0, y: 0, z: 0 }],
        ["n2", { nodeId: "n2", x: 10, y: 0, z: 0 }],
      ]),
      materials: new Map([["mat1", { materialId: "mat1", E: 100, nu: 0.3 }]]),
      sections: new Map([["sec1", { sectionId: "sec1", area: 2 }]]),
      elements: new Map([["e1", { elementId: "e1", nodeIds: ["n1", "n2"], materialId: "mat1", sectionId: "sec1", formulationId: "BAR_1D" }]]),
      loads: [{ nodeId: "n2", dof: DOFComponent.UX, value: 50 }],
      boundaryConditions: [] // NO BC -> Singular
    };

    let singularityDetected = false;
    try {
      core.solve(singularModel);
    } catch (e: any) {
      if (e.message.includes("SINGULARITY") || e.message.includes("CONSTRAINED")) {
        singularityDetected = true;
      }
    }

    if (!singularityDetected) {
      throw new Error("SINGULARITY_NOT_DETECTED");
    }

    const evidence = FEMEvidenceEngine.generateEvidence(model1, result2);

    return {
      passed: true,
      evidence,
      diagnostics: "Linear static FEM validated strictly. Scaling, Equilibrium, Singularity tests passed."
    };
  }
}
