import { describe, expect, it } from "vitest";
import { 
  MaterialProvenanceEngine, 
  IndependentMaterialProvenanceAuditor, 
  HardAcceptanceGate098, 
  generateReports098,
  ProvenanceNodeType,
  ProvenanceEdgeType,
  TrustClassification,
  PhysicalMaterialInstance,
  MaterialCertificateReference,
  EngineeringPropertyUsage,
  MaterialProvenanceRecord
} from "../provenance/index";

describe("PATCH-098: Material Provenance & Pedigree", () => {
  it("1. MaterialProvenanceEngine detects cyclic genealogy graphs", () => {
    const nodes = [
      { id: "A", type: ProvenanceNodeType.MATERIAL, label: "Node A", metadata: {}, timestamp: "2026-08-20T00:00:00Z" },
      { id: "B", type: ProvenanceNodeType.LOT, label: "Node B", metadata: {}, timestamp: "2026-08-20T00:00:00Z" }
    ];
    const edges = [
      { sourceId: "A", targetId: "B", type: ProvenanceEdgeType.DERIVED_FROM },
      { sourceId: "B", targetId: "A", type: ProvenanceEdgeType.USED_BY } // Back edge creating a cycle
    ];

    expect(MaterialProvenanceEngine.hasCycles(nodes, edges)).toBe(true);
  });

  it("2. MaterialProvenanceEngine validates non-cyclic genealogy graphs", () => {
    const nodes = [
      { id: "A", type: ProvenanceNodeType.SOURCE, label: "Node A", metadata: {}, timestamp: "2026-08-20T00:00:00Z" },
      { id: "B", type: ProvenanceNodeType.HEAT, label: "Node B", metadata: {}, timestamp: "2026-08-20T00:00:00Z" }
    ];
    const edges = [
      { sourceId: "A", targetId: "B", type: ProvenanceEdgeType.PRODUCED_BY }
    ];

    expect(MaterialProvenanceEngine.hasCycles(nodes, edges)).toBe(false);
  });

  it("3. MaterialProvenanceEngine detects Identity Conflict with mismatched heats", () => {
    const physicalIdentity: PhysicalMaterialInstance = {
      physicalMaterialId: "PLATE-01",
      materialSpecificationId: "SPEC-01",
      grade: "Grade 5",
      designation: "Alloy",
      form: "Plate",
      dimensions: {},
      heatNumber: "HEAT-884",
      lotNumber: "LOT-1",
      batchNumber: "B1",
      sourceId: "S-1",
      receivingRecordId: "R-1",
      conditionId: "C-1",
      provenance: { sourceId: "x", sourceType: "EXPERIMENT" as any, reference: "x", timestamp: "x", author: "x", hash: "x" }
    };

    const record: MaterialProvenanceRecord = {
      provenanceId: "PROV-1",
      materialId: "MAT-1",
      materialRevision: 1,
      physicalIdentity,
      heatNumber: "HEAT-999", // mismatched
      lotNumber: "LOT-1",
      certificates: [],
      nodes: [],
      edges: [],
      verificationStatus: TrustClassification.VERIFIED,
      provenanceFingerprint: "x",
      revision: 1,
      timestamp: "2026-08-20T00:00:00Z"
    };

    const conflict = MaterialProvenanceEngine.detectConflicts(record);
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.verdict).toBe("IDENTITY_CONFLICT");
  });

  it("4. Hard Acceptance Gate evaluates to PASS", () => {
    const gate = HardAcceptanceGate098.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("5. generateReports098 executes successfully without errors", () => {
    expect(() => generateReports098()).not.toThrow();
  });
});
