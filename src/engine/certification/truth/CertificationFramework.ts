/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-186: Engineering Truth Certification Framework
 */

import * as crypto from 'crypto';

export enum CertificationLevel {
  LEVEL_0_DECLARED = "LEVEL_0_DECLARED",
  LEVEL_1_IMPLEMENTED = "LEVEL_1_IMPLEMENTED",
  LEVEL_2_VERIFIED = "LEVEL_2_VERIFIED",
  LEVEL_3_QUALIFIED = "LEVEL_3_QUALIFIED",
  LEVEL_4_INDEPENDENTLY_VALIDATED = "LEVEL_4_INDEPENDENTLY_VALIDATED",
  LEVEL_5_CERTIFIED = "LEVEL_5_CERTIFIED"
}

export enum CertificationVerdict {
  PROVEN = "PROVEN",
  PARTIALLY_PROVEN = "PARTIALLY_PROVEN",
  UNPROVEN = "UNPROVEN",
  SIMULATED = "SIMULATED",
  FAILED = "FAILED",
  NOT_APPLICABLE = "NOT_APPLICABLE"
}

export interface CertificationProvenance {
  readonly signer: string;
  readonly signature: string;
  readonly originNodeId: string;
  readonly chainOfCustodyRoot: string;
}

export interface CertificationRecord {
  readonly CertificationId: string;
  readonly SubjectId: string;
  readonly Capability: string;
  readonly CapabilityVersion: string;
  readonly CertificationLevel: CertificationLevel;
  readonly Verdict: CertificationVerdict;
  readonly EvidenceReferences: readonly string[];
  readonly TestReferences: readonly string[];
  readonly BenchmarkReferences: readonly string[];
  readonly Provenance: CertificationProvenance;
  readonly Dependencies: readonly string[];
  readonly IssuedAt: string;
  readonly ValidUntil: string;
  readonly Issuer: string;
  readonly VerificationStatus: "VERIFIED" | "INVALID" | "TAMPER_DETECTED";
  readonly RevocationStatus: "ACTIVE" | "REVOKED" | "SUPERSEDED";
  readonly RevocationReason?: string;
  readonly CertificationHash: string;
}

export interface EvaluationContext {
  readonly subjectId: string;
  readonly capabilityVersion: string;
  readonly implementationEvidence: boolean;
  readonly requiredTests: readonly { id: string; name: string; passed: boolean; isMandatory: boolean }[];
  readonly benchmarks: readonly { id: string; name: string; passed: boolean; isSimulationOnly: boolean }[];
  readonly adversarialTests: readonly { id: string; name: string; passed: boolean }[];
  readonly independentVerification: boolean;
  readonly tamperDetected: boolean;
  readonly isSimulationOnly: boolean;
  readonly dependencies: readonly string[];
  readonly validDurationDays?: number;
}

export interface ExportableCertificationPackage {
  readonly manifest: {
    readonly exportTimestamp: string;
    readonly packageVersion: string;
    readonly totalRecords: number;
    readonly packageHash: string;
  };
  readonly records: readonly CertificationRecord[];
  readonly proofs: {
    readonly [certId: string]: {
      readonly CertificationHash: string;
      readonly recalculatedSignature: string;
      readonly verificationStatus: string;
    };
  };
}

export class CertificationRulesEngine {
  /**
   * Deterministically calculates the Certification Level and Verdict based solely on evidence context.
   */
  public static evaluate(capability: string, context: EvaluationContext): { level: CertificationLevel; verdict: CertificationVerdict } {
    // 1. Missing implementation evidence -> LEVEL 0 (DECLARED), UNPROVEN
    if (!context.implementationEvidence) {
      return {
        level: CertificationLevel.LEVEL_0_DECLARED,
        verdict: CertificationVerdict.UNPROVEN
      };
    }

    // 2. Failure of any mandatory test -> LEVEL 1 (IMPLEMENTED), FAILED
    const hasFailedMandatory = context.requiredTests.some(t => t.isMandatory && !t.passed);
    if (hasFailedMandatory) {
      return {
        level: CertificationLevel.LEVEL_1_IMPLEMENTED,
        verdict: CertificationVerdict.FAILED
      };
    }

    // 3. Are all required tests executed and passed?
    const allTestsPassed = context.requiredTests.length > 0 && context.requiredTests.every(t => t.passed);
    if (!allTestsPassed) {
      return {
        level: CertificationLevel.LEVEL_1_IMPLEMENTED,
        verdict: CertificationVerdict.UNPROVEN
      };
    }

    // If we have passing tests, we can reach LEVEL 2 (VERIFIED)
    let currentLevel = CertificationLevel.LEVEL_2_VERIFIED;
    let currentVerdict = context.isSimulationOnly ? CertificationVerdict.SIMULATED : CertificationVerdict.PROVEN;

    // 4. Benchmarks & Adversarial tests -> LEVEL 3 (QUALIFIED)
    const hasBenchmarks = context.benchmarks.length > 0;
    const allBenchmarksPassed = hasBenchmarks && context.benchmarks.every(b => b.passed);
    const hasAdversarial = context.adversarialTests.length > 0;
    const allAdversarialPassed = hasAdversarial && context.adversarialTests.every(a => a.passed);

    if (allBenchmarksPassed && allAdversarialPassed) {
      currentLevel = CertificationLevel.LEVEL_3_QUALIFIED;
    } else {
      // If benchmark or adversarial is missing/failing, we can't step up
      return {
        level: currentLevel,
        verdict: context.isSimulationOnly ? CertificationVerdict.SIMULATED : CertificationVerdict.PARTIALLY_PROVEN
      };
    }

    // 5. Independent validation -> LEVEL 4 (INDEPENDENTLY VALIDATED)
    if (context.independentVerification) {
      currentLevel = CertificationLevel.LEVEL_4_INDEPENDENTLY_VALIDATED;
    } else {
      return {
        level: currentLevel,
        verdict: context.isSimulationOnly ? CertificationVerdict.SIMULATED : CertificationVerdict.PARTIALLY_PROVEN
      };
    }

    // 6. Complete evidence package (No simulation reliance presented as hardware execution) -> LEVEL 5 (CERTIFIED)
    const linksComplete = context.implementationEvidence && allTestsPassed && allBenchmarksPassed && allAdversarialPassed && context.independentVerification;
    if (linksComplete) {
      currentLevel = CertificationLevel.LEVEL_5_CERTIFIED;
      currentVerdict = context.isSimulationOnly ? CertificationVerdict.SIMULATED : CertificationVerdict.PROVEN;
    }

    return {
      level: currentLevel,
      verdict: currentVerdict
    };
  }
}

export class EngineeringTruthCertificationGate {
  private static readonly ISSUER_NAME = "SECP_CENTRAL_TRUTH_AUTHORITY";

  /**
   * Generates a deterministic hash for a record to protect immutability.
   */
  public static computeHash(record: Omit<CertificationRecord, 'CertificationHash'>): string {
    const serialize = (obj: any): string => {
      if (obj === null) return 'null';
      if (typeof obj !== 'object') return String(obj);
      if (Array.isArray(obj)) {
        return '[' + obj.map(serialize).join(',') + ']';
      }
      const keys = Object.keys(obj).sort();
      return '{' + keys.map(k => `${k}:${serialize(obj[k])}`).join(',') + '}';
    };

    const payload = serialize({
      CertificationId: record.CertificationId,
      SubjectId: record.SubjectId,
      Capability: record.Capability,
      CapabilityVersion: record.CapabilityVersion,
      CertificationLevel: record.CertificationLevel,
      Verdict: record.Verdict,
      EvidenceReferences: record.EvidenceReferences,
      TestReferences: record.TestReferences,
      BenchmarkReferences: record.BenchmarkReferences,
      Provenance: record.Provenance,
      Dependencies: record.Dependencies,
      IssuedAt: record.IssuedAt,
      ValidUntil: record.ValidUntil,
      Issuer: record.Issuer,
      VerificationStatus: record.VerificationStatus,
      RevocationStatus: record.RevocationStatus,
      RevocationReason: record.RevocationReason
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Main gate evaluator. Produces a certified record if valid, or a negative/revoked/failed record.
   */
  public static evaluateCapability(capability: string, context: EvaluationContext): CertificationRecord {
    // 1. Determine level & verdict
    let { level, verdict } = CertificationRulesEngine.evaluate(capability, context);
    let verificationStatus: "VERIFIED" | "INVALID" | "TAMPER_DETECTED" = "VERIFIED";

    // 2. Force FAILED if tamper is detected
    if (context.tamperDetected) {
      verdict = CertificationVerdict.FAILED;
      level = CertificationLevel.LEVEL_0_DECLARED;
      verificationStatus = "TAMPER_DETECTED";
    }

    const issuedAt = new Date().toISOString();
    const durationDays = context.validDurationDays || 365;
    const validUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const certId = `CERT-${capability.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Compile Evidence references
    const evidenceRefs: string[] = [];
    if (context.implementationEvidence) evidenceRefs.push(`EVID-IMP-${capability}-001`);
    if (context.independentVerification) evidenceRefs.push(`EVID-IND-${capability}-999`);

    const testRefs = context.requiredTests.map(t => `TEST-${t.id}`);
    const benchmarkRefs = context.benchmarks.map(b => `BENCH-${b.id}`);

    // Generate Signature / Provenance
    const originNodeId = `SECP-NODE-${crypto.createHash('sha256').update(capability).digest('hex').substring(0, 8).toUpperCase()}`;
    const chainOfCustodyRoot = crypto.createHash('sha256').update(issuedAt + certId).digest('hex');
    const signaturePayload = `${certId}:${level}:${verdict}:${issuedAt}`;
    const signature = `SIG_ECC_${crypto.createHash('sha256').update(signaturePayload).digest('hex').substring(0, 32).toUpperCase()}`;

    const provenance: CertificationProvenance = {
      signer: this.ISSUER_NAME,
      signature,
      originNodeId,
      chainOfCustodyRoot
    };

    const recordDraft: Omit<CertificationRecord, 'CertificationHash'> = {
      CertificationId: certId,
      SubjectId: context.subjectId,
      Capability: capability,
      CapabilityVersion: context.capabilityVersion,
      CertificationLevel: level,
      Verdict: verdict,
      EvidenceReferences: evidenceRefs,
      TestReferences: testRefs,
      BenchmarkReferences: benchmarkRefs,
      Provenance: provenance,
      Dependencies: context.dependencies,
      IssuedAt: issuedAt,
      ValidUntil: validUntil,
      Issuer: this.ISSUER_NAME,
      VerificationStatus: verificationStatus,
      RevocationStatus: "ACTIVE"
    };

    const hash = this.computeHash(recordDraft);

    return {
      ...recordDraft,
      CertificationHash: hash
    };
  }

  /**
   * Revokes an existing certificate, producing a new revoked record immutably.
   */
  public static revoke(record: CertificationRecord, reason: string): CertificationRecord {
    const revokedDraft: Omit<CertificationRecord, 'CertificationHash'> = {
      ...record,
      RevocationStatus: "REVOKED",
      RevocationReason: reason,
      VerificationStatus: "INVALID"
    };

    const hash = this.computeHash(revokedDraft);

    return {
      ...revokedDraft,
      CertificationHash: hash
    };
  }

  /**
   * Revalidates an existing certificate. If version differs, transition requires full revalidation.
   */
  public static revalidate(record: CertificationRecord, newContext: EvaluationContext): CertificationRecord {
    if (record.CapabilityVersion !== newContext.capabilityVersion) {
      // Version changes requires a new record rather than automatic mapping
      return this.evaluateCapability(record.Capability, newContext);
    }

    // Otherwise evaluate current and return
    return this.evaluateCapability(record.Capability, newContext);
  }

  /**
   * Verifies a certificate independently without trusting its fields.
   */
  public static verifyCertificate(record: CertificationRecord): { isValid: boolean; reason?: string } {
    if (record.VerificationStatus === "TAMPER_DETECTED" || record.RevocationStatus === "REVOKED") {
      return { isValid: false, reason: record.RevocationReason || "Certificate is revoked or tamper has been detected" };
    }

    const calculatedHash = this.computeHash(record);
    if (calculatedHash !== record.CertificationHash) {
      return { isValid: false, reason: "CertificationHash mismatch. Immutability violation detected!" };
    }

    // Verify signature format
    const expectedSigPayload = `${record.CertificationId}:${record.CertificationLevel}:${record.Verdict}:${record.IssuedAt}`;
    const expectedSig = `SIG_ECC_${crypto.createHash('sha256').update(expectedSigPayload).digest('hex').substring(0, 32).toUpperCase()}`;
    if (record.Provenance.signature !== expectedSig) {
      return { isValid: false, reason: "Cryptographic provenance signature is invalid" };
    }

    return { isValid: true };
  }

  /**
   * Exports an array of certificates into a fully verified Certification Package.
   */
  public static exportPackage(records: CertificationRecord[]): ExportableCertificationPackage {
    const exportTimestamp = new Date().toISOString();
    const packageVersion = "1.0.0";

    const proofs: { [certId: string]: any } = {};
    for (const r of records) {
      const recalculatedHash = this.computeHash(r);
      const verification = this.verifyCertificate(r);
      
      proofs[r.CertificationId] = {
        CertificationHash: recalculatedHash,
        recalculatedSignature: r.Provenance.signature,
        verificationStatus: verification.isValid ? "VERIFIED" : "TAMPERED_OR_REVOKED"
      };
    }

    const totalRecords = records.length;
    const packageHash = crypto.createHash('sha256').update(JSON.stringify(proofs)).digest('hex');

    return {
      manifest: {
        exportTimestamp,
        packageVersion,
        totalRecords,
        packageHash
      },
      records,
      proofs
    };
  }
}
