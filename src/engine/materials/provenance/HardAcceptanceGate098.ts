import { 
  MaterialProvenanceRecord, 
  TrustClassification, 
  PhysicalMaterialInstance,
  MaterialCertificateReference,
  EngineeringPropertyUsage,
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceNodeType,
  ProvenanceEdgeType
} from "./types";
import { MaterialProvenanceEngine } from "./MaterialProvenanceEngine";
import { IndependentMaterialProvenanceAuditor } from "./IndependentMaterialProvenanceAuditor";

export interface Gate098Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate098 {
  public static evaluateGate(): Gate098Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. Setup sample high-quality valid Material Provenance record (e.g. Ti-6Al-4V Alloy)
    const materialId = "TI-6AL-4V-098";
    const materialRevision = 1;

    const physicalIdentity: PhysicalMaterialInstance = {
      physicalMaterialId: "TI64-PLATE-HEAT-88421",
      materialSpecificationId: "ASTM-B265-GR5",
      grade: "Grade 5",
      designation: "Ti-6Al-4V Alpha-Beta Alloy",
      form: "Hot Rolled Plate",
      dimensions: { width: 1000, thickness: 25, length: 2000 },
      heatNumber: "HEAT-88421",
      lotNumber: "LOT-098-992",
      batchNumber: "BATCH-A",
      sourceId: "SOURCE-TIMET-OHIO",
      receivingRecordId: "REC-2026-042",
      conditionId: "COND-MIL-ANNEALED",
      provenance: {
        sourceId: "TIMET-CERT-2026",
        sourceType: "EXPERIMENT" as any,
        reference: "Timet Mill Test Report",
        timestamp: "2026-08-20T00:00:00Z",
        author: "T. Henderson",
        hash: "c3d4e5f6g7h8"
      }
    };

    const cert: MaterialCertificateReference = {
      certificateId: "MTR-TIMET-2026-88421",
      certificateType: "MILL_TEST",
      issuer: "Titanium Metals Corporation (TIMET)",
      issueDate: "2026-08-15",
      revision: 1,
      materialReference: "Ti-6Al-4V Gr5",
      heatLotReference: "HEAT-88421",
      documentFingerprint: "sha256-timet-88421-verified-hash",
      verificationStatus: "VERIFIED"
    };

    const timestamp = "2026-08-20T10:00:00Z";
    const nodes: ProvenanceNode[] = [
      { id: "TI-6AL-4V-098", type: ProvenanceNodeType.MATERIAL, label: "Ti-6Al-4V Grade 5", metadata: {}, timestamp },
      { id: "SOURCE-TIMET-OHIO", type: ProvenanceNodeType.SOURCE, label: "TIMET Ohio Mill", metadata: {}, timestamp },
      { id: "HEAT-88421", type: ProvenanceNodeType.HEAT, label: "Heat 88421", metadata: {}, timestamp },
      { id: "LOT-098-992", type: ProvenanceNodeType.LOT, label: "Lot 098-992", metadata: {}, timestamp },
      { id: "MTR-TIMET-2026-88421", type: ProvenanceNodeType.CERTIFICATE, label: "Mill Test Cert", metadata: {}, timestamp },
      { id: "SPECIMEN-TI64-01", type: ProvenanceNodeType.SPECIMEN, label: "Specimen 01", metadata: {}, timestamp }
    ];

    const edges: ProvenanceEdge[] = [
      { sourceId: "SOURCE-TIMET-OHIO", targetId: "HEAT-88421", type: ProvenanceEdgeType.PRODUCED_BY },
      { sourceId: "HEAT-88421", targetId: "LOT-098-992", type: ProvenanceEdgeType.DERIVED_FROM },
      { sourceId: "LOT-098-992", targetId: "TI-6AL-4V-098", type: ProvenanceEdgeType.USED_BY },
      { sourceId: "MTR-TIMET-2026-88421", targetId: "LOT-098-992", type: ProvenanceEdgeType.CERTIFIED_BY },
      { sourceId: "LOT-098-992", targetId: "SPECIMEN-TI64-01", type: ProvenanceEdgeType.SAMPLED_FROM }
    ];

    const record: MaterialProvenanceRecord = {
      provenanceId: "PROV-TI64-88421",
      materialId,
      materialRevision,
      physicalIdentity,
      heatNumber: "HEAT-88421",
      lotNumber: "LOT-098-992",
      batchNumber: "BATCH-A",
      certificates: [cert],
      nodes,
      edges,
      verificationStatus: TrustClassification.VERIFIED,
      provenanceFingerprint: "",
      revision: 1,
      timestamp
    };

    record.provenanceFingerprint = MaterialProvenanceEngine.calculateFingerprint(record);

    // Check 1: VALID PROVENANCE RECORD INTEGRITY
    const auditValid = IndependentMaterialProvenanceAuditor.audit(record);
    checks.push({
      id: "PROVENANCE_RECORD_VALID_FLOW",
      passed: auditValid.verdict === "PASS",
      details: "High-quality Ti-6Al-4V provenance record successfully certified and passed independent auditor"
    });

    // Check 2: DETECT CYCLIC DEPENDENCY (INVALID_PROVENANCE_GRAPH)
    const cyclicEdges = [
      ...edges,
      { sourceId: "LOT-098-992", targetId: "SOURCE-TIMET-OHIO", type: ProvenanceEdgeType.DERIVED_FROM } // Back-reference creating a loop
    ];
    const cyclicRecord = { ...record, edges: cyclicEdges };
    const cyclicAudit = IndependentMaterialProvenanceAuditor.audit(cyclicRecord);
    checks.push({
      id: "PROVENANCE_GRAPH_CYCLE_REJECTION",
      passed: cyclicAudit.verdict === "FAIL" && cyclicAudit.checks.some(c => c.id === "GRAPH_INTEGRITY_VERIFICATION" && !c.passed),
      details: "Properly rejected and flagged a cyclic loop in the material genealogy chain"
    });

    // Check 3: DETECT IDENTITY CONFLICT
    const conflictedRecord: MaterialProvenanceRecord = {
      ...record,
      heatNumber: "HEAT-99999" // Declares heat 99999 while physicalInstance has HEAT-88421
    };
    const conflictResult = MaterialProvenanceEngine.detectConflicts(conflictedRecord);
    checks.push({
      id: "PROVENANCE_IDENTITY_CONFLICT_DETECTION",
      passed: conflictResult.hasConflict && conflictResult.verdict === "IDENTITY_CONFLICT",
      details: "Correctly caught and flagged identity conflict with mismatched heat numbers"
    });

    // Check 4: DETECT CERTIFICATE CONFLICT
    const mismatchCert: MaterialCertificateReference = {
      ...cert,
      heatLotReference: "HEAT-99999" // Mismatch with record's "HEAT-88421"
    };
    const certConflictResult = MaterialProvenanceEngine.detectConflicts(record, mismatchCert);
    checks.push({
      id: "PROVENANCE_CERTIFICATE_CONFLICT_DETECTION",
      passed: certConflictResult.hasConflict && certConflictResult.verdict === "CERTIFICATE_CONFLICT",
      details: "Correctly flagged conflict between certificate record and physical material batch reference"
    });

    // Check 5: VALIDITY DOMAIN EVALUATION (OUTSIDE_VALIDITY_DOMAIN)
    const usage: EngineeringPropertyUsage = {
      analysisId: "ANALYSIS-WCS-01",
      propertyId: "YIELD-STRENGTH-TI64",
      materialConditionId: "COND-MIL-ANNEALED",
      datasetRevision: 1,
      sourceId: "TIMET-CERT-2026",
      validityDomain: { minTemp: -100, maxTemp: 350 }, // typical safe domain for standard Ti64 properties
      selectionRationale: "Conservative aerospace safety limit for Ti-6Al-4V plate",
      timestamp
    };

    const outDomainStatus = MaterialProvenanceEngine.evaluateValidityDomain(usage, 400); // Exceeds 350 max safe temp
    checks.push({
      id: "PROPERTY_VALIDITY_DOMAIN_OUTSIDE",
      passed: outDomainStatus === "OUTSIDE_VALIDITY_DOMAIN",
      details: "Successfully detected high thermal loading condition (400°C) as OUTSIDE_VALIDITY_DOMAIN"
    });

    // Check 6: SPLIT LOT GENEALOGY LINEAGE
    const splitResult = MaterialProvenanceEngine.splitLot("LOT-098-992", ["STOCK-TI64-01", "STOCK-TI64-02"]);
    const hasSplitEdges = splitResult.edges.length === 2 && splitResult.edges.every(e => e.type === ProvenanceEdgeType.SPLIT_FROM);
    checks.push({
      id: "LOT_SPLIT_LINEAGE_VALID",
      passed: hasSplitEdges,
      details: "Accurately generated split nodes and child genealogy lineages for split stock plates"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
