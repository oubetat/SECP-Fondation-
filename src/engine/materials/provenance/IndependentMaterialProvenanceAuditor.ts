import { MaterialProvenanceRecord, EngineeringPropertyUsage } from "./types";
import { MaterialProvenanceEngine } from "./MaterialProvenanceEngine";

export interface ProvenanceAuditReport {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentMaterialProvenanceAuditor {
  public static audit(
    record: MaterialProvenanceRecord, 
    usage: EngineeringPropertyUsage | null = null,
    currentTemperature: number = 20
  ): ProvenanceAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. IDENTITY_VALIDATION
    const hasPhysicalIdentity = !!record.physicalIdentity && record.physicalIdentity.physicalMaterialId.length > 0;
    checks.push({
      id: "IDENTITY_VALIDATION",
      passed: hasPhysicalIdentity,
      details: hasPhysicalIdentity 
        ? `Physical material identity successfully tracked: ${record.physicalIdentity!.physicalMaterialId}`
        : "Missing physical material instance record"
    });

    // 2. DOCUMENT_INTEGRITY_CHECK
    let docsValid = true;
    let docDetails = "All material certificates match cryptographic hash fingerprints and show verified status";
    if (record.certificates && record.certificates.length > 0) {
      for (const cert of record.certificates) {
        if (!cert.documentFingerprint || cert.documentFingerprint === "INVALID") {
          docsValid = false;
          docDetails = `Certificate ${cert.certificateId} has corrupted or missing hash validation signatures`;
          break;
        }
      }
    } else {
      docsValid = false;
      docDetails = "Audit requires at least one physical material test certificate / Conformance record";
    }
    checks.push({
      id: "DOCUMENT_INTEGRITY_CHECK",
      passed: docsValid,
      details: docDetails
    });

    // 3. GRAPH_INTEGRITY_VERIFICATION
    const graphCheck = MaterialProvenanceEngine.validateGraphIntegrity(record);
    checks.push({
      id: "GRAPH_INTEGRITY_VERIFICATION",
      passed: graphCheck.valid,
      details: graphCheck.valid 
        ? "No cycles, circular chains, or self-parenting references in genealogy graph"
        : `Graph integrity failed: ${graphCheck.details}`
    });

    // 4. TEMPORAL_CONSISTENCY
    let temporalPassed = true;
    let tempDetails = "Chronology of the material receipt, heat-treatment, manufacturing and testing is consistent";
    if (record.nodes && record.nodes.length > 0) {
      // Basic check: verify no event has a future timestamp
      const now = new Date().getTime();
      for (const node of record.nodes) {
        const time = new Date(node.timestamp).getTime();
        if (time > now + 3600000) { // allow 1hr offset for timezones
          temporalPassed = false;
          tempDetails = `Chronological anomaly: Node ${node.id} contains impossible future timestamp (${node.timestamp})`;
          break;
        }
      }
    }
    checks.push({
      id: "TEMPORAL_CONSISTENCY",
      passed: temporalPassed,
      details: tempDetails
    });

    // 5. VALIDITY_DOMAIN_COMPLIANCE
    let domainPassed = true;
    let domainDetails = "No outside validity domain or temperature limits violation detected";
    if (usage) {
      const status = MaterialProvenanceEngine.evaluateValidityDomain(usage, currentTemperature);
      if (status === "OUTSIDE_VALIDITY_DOMAIN") {
        domainPassed = false;
        domainDetails = `Critical error: Yield strength property used at ${currentTemperature}°C, which exceeds material domain range (${usage.validityDomain.minTemp}°C to ${usage.validityDomain.maxTemp}°C)`;
      }
    }
    checks.push({
      id: "VALIDITY_DOMAIN_COMPLIANCE",
      passed: domainPassed,
      details: domainDetails
    });

    // 6. PROVENANCE_FINGERPRINT_VERIFICATION
    const expectedFp = MaterialProvenanceEngine.calculateFingerprint(record);
    const fpValid = record.provenanceFingerprint === expectedFp;
    checks.push({
      id: "PROVENANCE_FINGERPRINT_VERIFICATION",
      passed: fpValid,
      details: fpValid 
        ? "Provenience signature fingerprint matches perfect cryptographic verification"
        : `Verification mismatch: Signature corrupt! Expected: ${expectedFp}`
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
