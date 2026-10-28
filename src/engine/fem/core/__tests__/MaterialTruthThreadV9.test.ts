import { describe, it, expect } from "vitest";
import { FEMModel } from "../FEMTypes";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { MaterialTruthThreadEngine, MaterialTruthThread } from "../MaterialTruthThreadEngine";
import { FEMEvidenceEngine } from "../FEMEvidenceEngine";

describe("SECP Programmable Material Engineering - V9 Material Truth Thread Engine Suite", () => {
  const createMockModel = (): FEMModel => {
    const nodes = new Map();
    nodes.set("N1", { nodeId: "N1", x: 0, y: 0, z: 0 });
    nodes.set("N2", { nodeId: "N2", x: 100, y: 0, z: 0 });

    const elements = new Map();
    elements.set("E1", {
      elementId: "E1",
      nodeIds: ["N1", "N2"],
      materialId: "MAT1",
      sectionId: "SEC1",
      formulationId: "BAR1D",
    });

    const materials = new Map();
    materials.set("MAT1", { materialId: "MAT1", E: 210000, nu: 0.3, density: 7.85e-9 });

    const sections = new Map();
    sections.set("SEC1", { sectionId: "SEC1", area: 100 });

    const spatialFields = new Map();
    const propertySpecs = new Map();
    propertySpecs.set("E", {
      propertyName: "E",
      evaluationType: "ANALYTIC_EXPRESSION",
      expression: (coords: { x: number; y: number; z: number }) => 210000 * (1 + 0.1 * (coords.x / 100)),
      bounds: { lower: 1000, upper: 500000 },
      unit: "MPa",
    });

    const spatialField = new SpatialMaterialField(
      "FIELD1",
      "GEOM-001",
      "REV-A",
      "MAT1",
      propertySpecs
    );
    spatialFields.set("FIELD1", spatialField);

    return {
      nodes,
      elements,
      materials,
      sections,
      loads: [],
      boundaryConditions: [],
      spatialMaterialFields: spatialFields,
      geometryMetadata: {
        geometryId: "GEOM-001",
        geometryRevision: "REV-A",
      },
      manufacturingProfile: {
        profileId: "MFG-001",
        processType: "ADDITIVE_PBF",
        materialId: "MAT1",
        minFeatureSize: 0.5,
        maxGraduationRate: 5000,
        allowedPorosityRange: [0, 0.05],
        anisotropyLimits: { E_ratio_max: 1.2 },
      },
      asBuiltState: {
        asBuiltStateId: "ASBUILT-001",
        partInstanceId: "PART-1001",
        engineeringRevisionId: "REV-A",
        geometryRevisionId: "REV-A",
        intendedMaterialFieldId: "FIELD1",
        measurementDatasetId: "MEAS-DS-001",
        measurementMethodId: "CT_SCAN",
        coordinateFrameId: "GLOBAL_WORLD",
        dataOrigin: "PHYSICAL_MEASUREMENT",
        reconstructedFields: [
          {
            propertyName: "E",
            unit: "MPa",
            spatialPoints: [{ x: 50, y: 0, z: 0 }],
            reconstructedValues: [220000],
            uncertainty: [2000],
          },
        ],
        qualityMetrics: {
          validPointCount: 1,
          rejectedPointCount: 0,
          coverageRatio: 1.0,
          qualityStatus: "PASS",
        },
        evidenceReference: "EVID-ASBUILT-001",
      },
      deviationResult: {
        deviationId: "DEV-001",
        intendedFieldId: "FIELD1",
        asBuiltStateId: "ASBUILT-001",
        maxPositiveDeviation: 10000,
        maxNegativeDeviation: 0,
        meanAbsoluteDeviation: 5000,
        conformanceDecision: {
          decisionId: "DEC-001",
          verdict: "PASS",
          confidenceLevel: 0.98,
          acceptedBy: "CHIEF_ENGINEER",
        },
      },
    };
  };

  it("V9-TEST-01: Canonical Graph Construction (buildTruthThread)", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    expect(thread.threadId).toBeDefined();
    expect(thread.nodes.size).toBeGreaterThanOrEqual(6);
    expect(thread.nodes.has("GEOM-001")).toBe(true);
    expect(thread.nodes.has("MAT-DEF-CANONICAL")).toBe(true);
    expect(thread.nodes.has("FIELD-FIELD1")).toBe(true);
    expect(thread.nodes.has("MFG-PROFILE-MFG-001")).toBe(true);
    expect(thread.nodes.has("ASBUILT-001")).toBe(true);
    expect(thread.nodes.has("DEV-001")).toBe(true);
    expect(thread.edges.length).toBeGreaterThan(0);
    expect(thread.threadHash).toHaveLength(64);
  });

  it("V9-TEST-02: Strict Provenance Classification (V9-ARCH-02)", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const categories = Array.from(thread.nodes.values()).map((n) => n.provenanceCategory);
    expect(categories).toContain("INTENDED");
    expect(categories).toContain("PREDICTED");
    expect(categories).toContain("MANUFACTURED");
    expect(categories).toContain("AS_BUILT");
    expect(categories).toContain("DEVIATION_ANALYSIS");
    expect(categories).toContain("CONFORMANCE_DECISION");
  });

  it("V9-TEST-03: Directed Edge Relationship Validation", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const edgeTypes = thread.edges.map((e) => e.edgeType);
    expect(edgeTypes).toContain("USES_REVISION");
    expect(edgeTypes).toContain("DERIVED_FROM");
    expect(edgeTypes).toContain("REGISTERED_TO");
    expect(edgeTypes).toContain("COMPARED_AGAINST");
    expect(edgeTypes).toContain("VERIFIED_BY");
  });

  it("V9-TEST-04: Graph Integrity & Dangling Reference Detection", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    let val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.isValid).toBe(true);

    // Inject dangling edge
    thread.edges.push({
      edgeId: "DANGLING-EDGE",
      edgeType: "DERIVED_FROM",
      sourceNodeId: "DEV-001",
      targetNodeId: "NON-EXISTENT-NODE",
      createdTimestamp: new Date().toISOString(),
    });

    val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.isValid).toBe(false);
    expect(val.status).toBe("DANGLING_EDGES");
    expect(val.danglingEdges.length).toBe(1);
  });

  it("V9-TEST-05: Content Hash Corruption Detection", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const node = thread.nodes.get("GEOM-001")!;
    node.payload.nodeCount = 999; // Corrupt payload without updating contentHash

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.isValid).toBe(false);
    expect(val.status).toBe("CORRUPTED_HASH");
    expect(val.corruptedNodes).toContain("GEOM-001");
  });

  it("V9-TEST-06: Cycle Detection in Graph", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    // Inject cycle: GEOM-001 -> DEV-001 -> ... -> GEOM-001
    thread.edges.push({
      edgeId: "CYCLE-EDGE",
      edgeType: "DERIVED_FROM",
      sourceNodeId: "GEOM-001",
      targetNodeId: "DEV-001",
      createdTimestamp: new Date().toISOString(),
    });

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.isValid).toBe(false);
    expect(val.status).toBe("CYCLE_DETECTED");
    expect(val.detectedCycles.length).toBeGreaterThan(0);
  });

  it("V9-TEST-07: Revision Invalidation Cascade (propagateRevisionInvalidation)", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    // Mutate MAT-DEF-CANONICAL
    const mutated = MaterialTruthThreadEngine.propagateRevisionInvalidation(
      thread,
      "MAT-DEF-CANONICAL",
      "Material stiffness modified in CAD"
    );

    expect(mutated.nodes.get("MAT-DEF-CANONICAL")?.isValid).toBe(false);
    // Downstream field and deviation analysis should be invalidated
    expect(mutated.nodes.get("FIELD-FIELD1")?.isValid).toBe(false);
    expect(mutated.nodes.get("DEV-001")?.isValid).toBe(false);
    expect(mutated.nodes.get("DECISION-DEV-001")?.isValid).toBe(false);

    // Geometry node (upstream of material) remains valid
    expect(mutated.nodes.get("GEOM-001")?.isValid).toBe(true);
  });

  it("V9-TEST-08: Stale Evidence Invalidation Integration", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);
    model.truthThread = thread;

    const mockSolve = {
      K_global: { data: [1, 2, 3] },
      trace: ["solve"],
      U: [0.01],
      displacements: new Map([["N2_UX", 0.01]]),
      equilibrium: { norm: 1e-12 },
      energy: 0.5,
      solverTypeUsed: "DIRECT",
      bcMethodUsed: "PENALTY",
      sparseMetrics: {},
      solverDiagnostics: {},
    };

    const evidence = FEMEvidenceEngine.generateEvidence(model, mockSolve);
    expect(evidence.truthThreadHash).toBe(thread.threadHash);

    // Verify initial freshness
    let stale = FEMEvidenceEngine.isEvidenceStale(evidence, model);
    expect(stale.isStale).toBe(false);

    // Invalidate thread
    MaterialTruthThreadEngine.propagateRevisionInvalidation(thread, "GEOM-001");
    model.truthThread = thread;

    stale = FEMEvidenceEngine.isEvidenceStale(evidence, model);
    expect(stale.isStale).toBe(true);
    expect(stale.reason).toContain("truth thread");
  });

  // --- ADVERSARIAL SCENARIO TESTS (V9-ADV-001 through V9-ADV-014) ---

  it("V9-ADV-001: Cyclic Dependency Attack", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    thread.edges.push({
      edgeId: "ADV-CYCLE-1",
      edgeType: "DERIVED_FROM",
      sourceNodeId: "MAT-DEF-CANONICAL",
      targetNodeId: "DEV-001",
      createdTimestamp: new Date().toISOString(),
    });

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.status).toBe("CYCLE_DETECTED");
  });

  it("V9-ADV-002: Dangling Node Edge Injection", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    thread.edges.push({
      edgeId: "ADV-DANGLING-1",
      edgeType: "USES_REVISION",
      sourceNodeId: "PHANTOM-SOURCE",
      targetNodeId: "GEOM-001",
      createdTimestamp: new Date().toISOString(),
    });

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.status).toBe("DANGLING_EDGES");
  });

  it("V9-ADV-003: Stealth Payload Mutation (Bypassing Hash)", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const node = thread.nodes.get("FIELD-FIELD1")!;
    node.payload.baseValue = 9999999; // Alter property directly

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.status).toBe("CORRUPTED_HASH");
  });

  it("V9-ADV-004: Phantom Revision Binding", () => {
    const model = createMockModel();
    model.geometryMetadata!.geometryRevision = ""; // Empty revision string
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    expect(thread.nodes.get("GEOM-001")?.revision).toBe("REV-1.0"); // Defaults safely
  });

  it("V9-ADV-005: Illegal Relationship Classification", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const geomNode = thread.nodes.get("GEOM-001")!;
    expect(geomNode.provenanceCategory).toBe("INTENDED");
    expect(geomNode.nodeType).toBe("GEOMETRY");
  });

  it("V9-ADV-006: Unregistered As-Built Measurement Ingestion", () => {
    const model = createMockModel();
    delete model.asBuiltState;
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    expect(thread.nodes.has("ASBUILT-001")).toBe(false);
    expect(thread.nodes.has("MEAS-DS-001")).toBe(false);
  });

  it("V9-ADV-007: Out-of-Sequence Adjudication Bypass", () => {
    const model = createMockModel();
    delete model.deviationResult;
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    expect(thread.nodes.has("DECISION-DEV-001")).toBe(false);
  });

  it("V9-ADV-008: Disconnected Isolated Subgraph Attack", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    // Insert isolated node
    thread.nodes.set("ISOLATED-001", {
      nodeId: "ISOLATED-001",
      nodeType: "MATERIAL_DEFINITION",
      provenanceCategory: "INTENDED",
      label: "Isolated Material",
      revision: "REV-1",
      contentHash: FEMEvidenceEngine.hashData({ test: 1 }),
      isValid: true,
      payload: { test: 1 },
    });

    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);
    expect(val.isValid).toBe(true); // Valid DAG even if disconnected, but isolated
  });

  it("V9-ADV-009: Truncated Merkle Thread Hash Attack", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const originalHash = thread.threadHash;
    thread.nodes.get("GEOM-001")!.contentHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const recomputedHash = MaterialTruthThreadEngine.computeThreadHash(thread);

    expect(recomputedHash).not.toEqual(originalHash);
  });

  it("V9-ADV-010: Multi-Parent Cascading Invalidation Wave", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    MaterialTruthThreadEngine.propagateRevisionInvalidation(thread, "GEOM-001");

    // All nodes in graph depend on GEOM-001 directly or transitively
    for (const node of thread.nodes.values()) {
      if (node.nodeId !== "GEOM-001" && node.nodeId !== "MEAS-DS-001") {
        expect(node.isValid).toBe(false);
      }
    }
  });

  it("V9-ADV-011: Retroactive Invalidation Recovery Attempt", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    MaterialTruthThreadEngine.propagateRevisionInvalidation(thread, "MAT-DEF-CANONICAL");
    const val = MaterialTruthThreadEngine.validateGraphIntegrity(thread);

    expect(val.isValid).toBe(false);
    expect(val.status).toBe("INVALIDATED");
  });

  it("V9-ADV-012: Orphaned Measurement Dataset Ingestion", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    expect(thread.nodes.has("MEAS-DS-001")).toBe(true);
    const dsNode = thread.nodes.get("MEAS-DS-001")!;
    expect(dsNode.provenanceCategory).toBe("MEASURED");
  });

  it("V9-ADV-013: Contradictory Provenance Category Assignment", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);

    const devNode = thread.nodes.get("DEV-001")!;
    expect(devNode.provenanceCategory).toBe("DEVIATION_ANALYSIS");
    expect(devNode.provenanceCategory).not.toBe("INTENDED");
  });

  it("V9-ADV-014: Evidence Stale Bypass on Mutated Graph", () => {
    const model = createMockModel();
    const thread = MaterialTruthThreadEngine.buildTruthThread(model);
    model.truthThread = thread;

    const mockSolve = {
      K_global: { data: [1] },
      trace: [],
      U: [0],
      displacements: new Map(),
      equilibrium: { norm: 0 },
      energy: 0,
      solverTypeUsed: "DIRECT",
      bcMethodUsed: "PENALTY",
      sparseMetrics: {},
      solverDiagnostics: {},
    };

    const evidence = FEMEvidenceEngine.generateEvidence(model, mockSolve);

    // Mutate thread hash manually
    thread.threadHash = "HASH-MUTATED-BY-ATTACKER";

    const stale = FEMEvidenceEngine.isEvidenceStale(evidence, model);
    expect(stale.isStale).toBe(true);
  });
});
