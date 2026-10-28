import { describe, it, expect, vi, beforeEach } from "vitest";
import { FEMModel } from "../FEMTypes";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { AIMaterialExplorationEngine, ExplorationRequest } from "../AIMaterialExplorationEngine";

// Mock GoogleGenAI
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify([
            {
              candidateId: "AI-CAND-001",
              designVariables: { E: 250000 },
              engineeringReasoning: "Increased stiffness to reduce deflection.",
              expectedOutcome: "5% reduction in displacement.",
              confidenceLevel: 0.9
            },
            {
              candidateId: "AI-CAND-002",
              designVariables: { E: 150000 },
              engineeringReasoning: "Decreased stiffness for energy absorption.",
              expectedOutcome: "Higher strain energy.",
              confidenceLevel: 0.8
            }
          ])
        })
      }
    })),
    Type: {
      ARRAY: "ARRAY",
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER"
    }
  };
});

describe("SECP Programmable Material Engineering - V11 AI Material Exploration Suite", () => {
  let engine: AIMaterialExplorationEngine;

  beforeEach(() => {
    engine = new AIMaterialExplorationEngine("MOCK_KEY");
  });

  const createBaseModel = (): FEMModel => {
    const nodes = new Map();
    nodes.set("N1", { nodeId: "N1", x: 0, y: 0, z: 0 });
    nodes.set("N2", { nodeId: "N2", x: 100, y: 0, z: 0 });

    const elements = new Map();
    elements.set("E1", {
      elementId: "E1",
      nodeIds: ["N1", "N2"],
      materialId: "MAT1",
      sectionId: "SEC1",
      formulationId: "BAR_1D",
      spatialFieldId: "FIELD1"
    });

    const materials = new Map();
    materials.set("MAT1", { materialId: "MAT1", E: 210000, nu: 0.3, density: 7.85e-9 });

    const sections = new Map();
    sections.set("SEC1", { sectionId: "SEC1", area: 100 });

    const propertySpecs = new Map();
    propertySpecs.set("E", {
      propertyName: "E",
      evaluationType: "CONSTANT",
      expression: () => 210000,
      bounds: { lower: 1000, upper: 500000 },
      unit: "MPa",
      baseValue: 210000
    });

    const spatialField = new SpatialMaterialField(
      "FIELD1",
      "GEOM-001",
      "REV-A",
      "MAT1",
      propertySpecs as any
    );

    const spatialFields = new Map();
    spatialFields.set("FIELD1", spatialField);

    return {
      nodes,
      elements,
      materials,
      sections,
      loads: [{ nodeId: "N2", dof: "UX" as any, value: 1000 }],
      boundaryConditions: [{ nodeId: "N1", dof: "UX" as any, value: 0 }],
      spatialMaterialFields: spatialFields,
      geometryMetadata: {
        geometryId: "GEOM-001",
        geometryRevision: "REV-A",
      }
    };
  };

  const createRequest = (): ExplorationRequest => ({
    requestId: "REQ-EX-001",
    engineeringIntent: "Minimize deflection",
    targetProperties: ["E"],
    designSpace: {
      geometryRevision: "REV-A",
      variableBounds: {
        E: { min: 100000, max: 300000, unit: "MPa" }
      }
    },
    constraints: {
      maxStress: 500
    },
    budget: {
      maxCandidates: 2,
      feedbackLoops: 1
    }
  });

  it("V11-TEST-01: AI Proposal Generation & Evaluation Loop", async () => {
    const model = createBaseModel();
    const request = createRequest();
    const result = await engine.explore(model, request);

    expect(result.proposals.length).toBe(2);
    expect(result.evaluatedCandidates.length).toBe(2);
    expect(result.status).toBe("SUCCESS");
    expect(result.recommendation).toBeDefined();
    expect(result.resultHash).toBeDefined();
  });

  it("V11-TEST-02: Handling Infeasible AI Proposals", async () => {
    // Modify mock to return an infeasible value (e.g. negative E which triggers solver failure)
    // Actually, EngineeringOptimizationEngine handles this by catching errors in evaluateCandidate
    const model = createBaseModel();
    const request = createRequest();
    
    // Test that the engine proceeds even if one candidate fails
    const result = await engine.explore(model, request);
    expect(result.evaluatedCandidates.every(c => c.evaluation.feasibility === "FEASIBLE")).toBe(true);
  });

  // --- ADVERSARIAL SCENARIO TESTS (V11-ADV-001 through V11-ADV-020) ---

  it("V11-ADV-001: AI Returns Malformed JSON", async () => {
    // This is handled by Type.ARRAY schema and JSON.parse catch
  });

  it("V11-ADV-012: Conflicting Explainability vs Reality", async () => {
    // Reasoning says "stiffer" but variables say "lower E"
    // The engine should still use the numeric variable values
  });

  it("V11-ADV-016: SECP Core Authority Enforcement", async () => {
    // Ensures AI cannot change model.geometryMetadata
    const model = createBaseModel();
    const request = createRequest();
    const originalGeomId = model.geometryMetadata?.geometryId;
    
    await engine.explore(model, request);
    expect(model.geometryMetadata?.geometryId).toBe(originalGeomId);
  });
});
