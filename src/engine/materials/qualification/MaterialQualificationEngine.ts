import { 
  MaterialQualificationRecord, 
  MaterialQualificationStatus, 
  MaterialQualificationVerdict, 
  MaterialQualificationPolicy,
  PhysicsMaterialRequirementMatrix
} from "./types";

export class MaterialQualificationEngine {
  /**
   * Generates a deterministic, reproducible cryptographic fingerprint for a Qualification Record.
   */
  public static calculateFingerprint(record: MaterialQualificationRecord): string {
    const parts = [
      record.qualificationId,
      record.materialId,
      record.materialRevision.toString(),
      record.status,
      record.verdict,
      record.validityDomain.minTemp.toString(),
      record.validityDomain.maxTemp.toString(),
      record.propertySet.sort().join(","),
      record.revision.toString()
    ];

    if (record.provenance) {
      parts.push(record.provenance.provenanceFingerprint);
    }

    return "mq-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Evaluates if a material is qualified for a specific physics model and operating conditions.
   */
  public static evaluateQualification(
    record: MaterialQualificationRecord,
    physicsMatrix: PhysicsMaterialRequirementMatrix,
    currentTemperature: number,
    policy: MaterialQualificationPolicy
  ): { verdict: MaterialQualificationVerdict; details: string[] } {
    const details: string[] = [];
    let verdict = MaterialQualificationVerdict.QUALIFIED;

    // 1. Identity Check
    if (!record.materialId || record.materialRevision <= 0) {
      details.push("IDENTITY_FAILURE: Material identifier or revision is invalid");
      return { verdict: MaterialQualificationVerdict.INVALID, details };
    }

    // 2. Validity Domain Check
    if (currentTemperature < record.validityDomain.minTemp || currentTemperature > record.validityDomain.maxTemp) {
      details.push(`OUTSIDE_SCOPE: Current temperature (${currentTemperature}°C) is outside the qualified domain (${record.validityDomain.minTemp}°C to ${record.validityDomain.maxTemp}°C)`);
      verdict = MaterialQualificationVerdict.OUTSIDE_SCOPE;
    }

    // 3. Physics Requirements Check
    const missingProperties = physicsMatrix.requiredProperties.filter(p => !record.propertySet.includes(p));
    if (missingProperties.length > 0) {
      details.push(`INCOMPLETE: Missing required properties for ${physicsMatrix.physicsModel}: ${missingProperties.join(", ")}`);
      verdict = MaterialQualificationVerdict.INCOMPLETE;
    }

    // 4. Provenance Completeness Check
    if (policy.provenanceRequirements === "COMPLETE" && (!record.provenance || record.provenance.verificationStatus !== "VERIFIED")) {
      details.push("PROVENANCE_FAILURE: Policy requires COMPLETE verified provenance chain but it is missing or unverified");
      verdict = MaterialQualificationVerdict.NOT_QUALIFIED;
    }

    // 5. Expiration Check
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      details.push(`EXPIRED: Qualification expired at ${record.expiresAt}`);
      verdict = MaterialQualificationVerdict.EXPIRED;
    }

    // 6. Suspension Check
    if (record.status === MaterialQualificationStatus.SUSPENDED) {
      details.push("SUSPENDED: Qualification is currently suspended due to data conflict or audit failure");
      verdict = MaterialQualificationVerdict.SUSPENDED;
    }

    // 7. Uncertainty Integration
    if (policy.acceptableUncertainty > 0 && record.uncertaintyRecords) {
      for (const unc of record.uncertaintyRecords) {
        if (unc.standardUncertainty > policy.acceptableUncertainty) {
          details.push(`UNCERTAINTY_FAILURE: Property ${unc.quantityId} uncertainty (${unc.standardUncertainty}) exceeds policy limit (${policy.acceptableUncertainty})`);
          verdict = MaterialQualificationVerdict.NOT_QUALIFIED;
        }
      }
    }

    // Handle Conditional logic
    if (verdict === MaterialQualificationVerdict.QUALIFIED && details.length > 0) {
      verdict = MaterialQualificationVerdict.CONDITIONALLY_QUALIFIED;
    }

    return { verdict, details };
  }

  /**
   * Checks if a material is admitted for a specific solver.
   */
  public static isAdmittedForSolver(
    record: MaterialQualificationRecord,
    physicsMatrix: PhysicsMaterialRequirementMatrix,
    temperature: number,
    policy: MaterialQualificationPolicy
  ): boolean {
    const result = this.evaluateQualification(record, physicsMatrix, temperature, policy);
    return result.verdict === MaterialQualificationVerdict.QUALIFIED || 
           result.verdict === MaterialQualificationVerdict.CONDITIONALLY_QUALIFIED;
  }
}
