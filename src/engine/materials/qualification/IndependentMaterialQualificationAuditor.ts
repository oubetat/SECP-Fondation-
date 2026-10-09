import { 
  MaterialQualificationRecord, 
  MaterialQualificationVerdict,
  MaterialQualificationPolicy,
  PhysicsMaterialRequirementMatrix
} from "./types";
import { MaterialQualificationEngine } from "./MaterialQualificationEngine";

export interface QualificationAuditReport {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentMaterialQualificationAuditor {
  public static audit(
    record: MaterialQualificationRecord,
    policy: MaterialQualificationPolicy,
    physicsMatrix: PhysicsMaterialRequirementMatrix,
    temperature: number
  ): QualificationAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. EVIDENCE_COMPLETENESS
    const hasRequiredEvidence = policy.mandatoryEvidence.every(e => record.availableEvidence.includes(e));
    checks.push({
      id: "EVIDENCE_COMPLETENESS",
      passed: hasRequiredEvidence,
      details: hasRequiredEvidence 
        ? "All mandatory evidence documents (Test Reports, Certificates, Calibration Logs) are present"
        : `Missing mandatory evidence: ${policy.mandatoryEvidence.filter(e => !record.availableEvidence.includes(e)).join(", ")}`
    });

    // 2. FINGERPRINT_INTEGRITY
    const expectedFp = MaterialQualificationEngine.calculateFingerprint(record);
    const fpValid = record.fingerprint === expectedFp;
    checks.push({
      id: "FINGERPRINT_INTEGRITY",
      passed: fpValid,
      details: fpValid 
        ? "Qualification record state fingerprint matches perfect cryptographic verification"
        : `Fingerprint mismatch! Corruption detected or manual edit. Expected: ${expectedFp}`
    });

    // 3. GATE_EVALUATION_CONSISTENCY
    const evaluation = MaterialQualificationEngine.evaluateQualification(record, physicsMatrix, temperature, policy);
    const consistencyValid = evaluation.verdict === record.verdict;
    checks.push({
      id: "GATE_EVALUATION_CONSISTENCY",
      passed: consistencyValid,
      details: consistencyValid 
        ? "Recorded verdict matches independent evaluation of the qualification engine"
        : `Verdict mismatch: Record says ${record.verdict} but auditor calculated ${evaluation.verdict}`
    });

    // 4. VALIDITY_DOMAIN_COMPLIANCE
    const domainValid = temperature >= record.validityDomain.minTemp && temperature <= record.validityDomain.maxTemp;
    checks.push({
      id: "VALIDITY_DOMAIN_COMPLIANCE",
      passed: domainValid,
      details: domainValid 
        ? `Operating temperature ${temperature}°C is within verified bounds`
        : `Domain violation: ${temperature}°C is outside [${record.validityDomain.minTemp}, ${record.validityDomain.maxTemp}]`
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
