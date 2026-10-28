import { describe, it, expect } from "vitest";
import { FEMModel, FEMMaterial } from "../FEMTypes";
import { IndustrialQualificationEngine } from "../IndustrialQualificationEngine";
import { MaterialTruthThreadEngine } from "../MaterialTruthThreadEngine";

describe("Industrial Qualification (V12) - Adversarial Suite", () => {
  const mockMaterial: FEMMaterial = { materialId: "Ti6Al4V", E: 110000, nu: 0.3 };
  
  const createBaseModel = (): FEMModel => {
    const nodes = new Map();
    nodes.set("N1", { nodeId: "N1", x: 0, y: 0, z: 0 });
    nodes.set("N2", { nodeId: "N2", x: 10, y: 0, z: 0 });
    
    const elements = new Map();
    elements.set("E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "Ti6Al4V", sectionId: "S1", formulationId: "BAR1D" });
    
    const materials = new Map();
    materials.set("Ti6Al4V", mockMaterial);

    return {
      nodes,
      elements,
      materials,
      sections: new Map(),
      loads: [],
      boundaryConditions: [],
      geometryMetadata: {
        geometryId: "BRACKET-001",
        geometryRevision: "REV-A"
      }
    };
  };

  const mockScope = {
    scopeId: "QUAL-SCOPE-001",
    title: "Test Scope"
  };

  it("V12-ADV-001: Should block qualification if physical evidence is missing", () => {
    const model = createBaseModel();
    // No asBuiltState or measurement dataset
    const result = IndustrialQualificationEngine.runQualification(model, mockScope);
    
    expect(result.verdict).toBe("SOFTWARE_VERIFIED_ONLY");
    expect(result.blockedGates).toContain("V12-GATE-07");
    expect(result.limitations).toContain("Physical evidence missing or identified as SYNTHETIC. Industrial release blocked.");
  });

  it("V12-ADV-005: Should fail qualification if truth thread is missing or invalid", () => {
    const model = createBaseModel();
    // Add synthetic asBuilt to avoid GATE-07 block (it will still be SOFTWARE_VERIFIED_ONLY but we check GATE-12)
    model.asBuiltState = {
      asBuiltStateId: "SYNTHETIC-001",
      partInstanceId: "PART-001",
      measurementDatasetId: "DS-001",
      reconstructedFields: []
    };
    
    const result = IndustrialQualificationEngine.runQualification(model, mockScope);
    expect(result.blockedGates).toContain("V12-GATE-12");
    expect(result.verdict).toBe("SOFTWARE_VERIFIED_ONLY");
  });

  it("V12-ADV-007: Should fail qualification if mandatory revision tracking is violated", () => {
    const model = createBaseModel();
    delete model.geometryMetadata; // Remove revision metadata
    
    const result = IndustrialQualificationEngine.runQualification(model, mockScope);
    expect(result.verdict).toBe("FAILED");
    expect(result.failedGates).toContain("V12-GATE-11");
  });

  it("V12-ADV-013: Should block qualification if deviation analysis is missing", () => {
    const model = createBaseModel();
    // No deviationResult
    const result = IndustrialQualificationEngine.runQualification(model, mockScope);
    expect(result.blockedGates).toContain("V12-GATE-13");
  });

  it("V12-GATE-17: Should grant full qualification if all mandatory evidence is present and valid", () => {
    const model = createBaseModel();
    
    // Add Manufacturing Profile
    model.manufacturingProfile = {
      profileId: "P-001",
      processType: "LPBF",
      constraints: []
    };

    // Add Physical As-Built State (Non-synthetic)
    model.asBuiltState = {
      asBuiltStateId: "PHYSICAL-001", // Not "SYNTHETIC"
      partInstanceId: "INST-001",
      measurementDatasetId: "REAL-DS-001",
      reconstructedFields: [],
      uncertaintyMap: new Map() // GATE-08
    };

    // Add Deviation Result
    model.deviationResult = {
      deviationId: "DEV-001",
      pointDeviations: [],
      maxDeviation: 1.5,
      rmsDeviation: 0.5,
      conformanceDecision: {
        verdict: "PASS",
        rationale: "Within tolerance"
      }
    };

    // Add Truth Thread
    model.truthThread = MaterialTruthThreadEngine.buildTruthThread(model);

    const result = IndustrialQualificationEngine.runQualification(model, mockScope);
    
    expect(result.verdict).toBe("QUALIFIED_WITHIN_SCOPE");
    expect(result.passedGates).toContain("V12-GATE-07");
    expect(result.passedGates).toContain("V12-GATE-12");
    expect(result.passedGates).toContain("V12-GATE-13");
  });
});
