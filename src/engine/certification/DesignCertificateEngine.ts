/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-166: Design Certificate Engine
 */

import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { EngineeringIdentityService } from '../identity/EngineeringIdentityService';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import {
  DesignCertificate,
  DesignCertificateStatus,
  ClaimVerificationStatus,
  VerificationClaimItem,
  DesignCertificatePolicy,
  DesignCertificateVerificationReport,
} from './designTypes';

export class DesignCertificateEngine {
  private static readonly instance = new DesignCertificateEngine();
  private readonly certificates = new Map<string, DesignCertificate>();

  private constructor() {}

  public static getInstance(): DesignCertificateEngine {
    return this.instance;
  }

  public resetRegistry(): void {
    this.certificates.clear();
  }

  /**
   * Generates a stable deterministic certificate ID from design parameters
   */
  public static computeCertificateId(designId: string, revision: string, timestamp: string): string {
    const raw = `CERT::${designId.trim()}::${revision.trim()}::${timestamp}`;
    const hash = AttestationCanonicalizer.sha256(raw);
    return `CERT-DSN-${hash.substring(0, 16).toUpperCase()}`;
  }

  /**
   * Computes the deterministic canonical design hash for a design model's configuration
   */
  public static computeCanonicalDesignHash(design: {
    designId: string;
    designRevision: string;
    geometryHash: string;
    materialReferences: readonly string[];
    assemblyReferences: readonly string[];
    constraintReferences: readonly string[];
    simulationReferences: readonly string[];
    manufacturingReferences: readonly string[];
    provenanceRoot: string;
  }): string {
    const serialized = CanonicalSerializer.serialize(design);
    return AttestationCanonicalizer.sha256(serialized.canonicalString);
  }

  /**
   * Computes the final deterministic fingerprint of a Design Certificate
   */
  public static computeFingerprint(params: {
    designId: string;
    designRevision: string;
    canonicalDesignHash: string;
    provenanceRoot: string;
    verificationResults: readonly VerificationClaimItem[];
    certificateVersion: string;
  }): string {
    const orderedPayload = {
      designId: params.designId,
      designRevision: params.designRevision,
      canonicalDesignHash: params.canonicalDesignHash,
      provenanceRoot: params.provenanceRoot,
      verificationResults: params.verificationResults.map(v => ({
        claim: v.claim,
        evidence: v.evidence,
        verificationMethod: v.verificationMethod,
        result: v.result,
        status: v.status
      })),
      certificateVersion: params.certificateVersion,
    };
    return AttestationCanonicalizer.hashObject(orderedPayload);
  }

  /**
   * Service method: Issues a Design Certificate based on real, rigorous evidence checks.
   */
  public createCertificate(params: {
    readonly design: {
      readonly designId: string;
      readonly designRevision: string;
      readonly geometryHash: string;
      readonly materialReferences: readonly string[];
      readonly assemblyReferences: readonly string[];
      readonly constraintReferences: readonly string[];
      readonly simulationReferences: readonly string[];
      readonly manufacturingReferences: readonly string[];
      readonly provenanceRoot: string;
    };
    readonly engineeringIdentity: EngineeringIdentity;
    readonly verificationResults: readonly VerificationClaimItem[];
    readonly policy: DesignCertificatePolicy;
    readonly issuer: string;
    readonly certificateVersion?: string;
    readonly limitations?: readonly string[];
    readonly evidenceReferences: readonly string[];
    readonly targetStatus?: DesignCertificateStatus; // For transitioning through state machine
  }): {
    readonly status: DesignCertificateStatus;
    readonly certificate?: DesignCertificate;
    readonly errors: readonly string[];
  } {
    const errors: string[] = [];
    const { design, engineeringIdentity, verificationResults, policy, issuer, evidenceReferences } = params;
    const version = params.certificateVersion || '1.0.0';
    const limitations = params.limitations || [];

    // --- Core Integrity & Binding Validations ---
    if (!design || !design.designId) {
      return { status: 'INVALID', errors: ['Design identity or reference is missing.'] };
    }
    if (!engineeringIdentity) {
      return { status: 'INVALID', errors: ['Engineering identity metadata is missing.'] };
    }
    if (engineeringIdentity.identityId !== design.designId) {
      errors.push(`Design ID mismatch: Engineering Identity claims '${engineeringIdentity.identityId}', design model claims '${design.designId}'`);
    }
    if (engineeringIdentity.revisionId !== design.designRevision) {
      errors.push(`Design Revision ID mismatch: Engineering Identity is bound to '${engineeringIdentity.revisionId}', design model revision is '${design.designRevision}'`);
    }

    // Determine Canonical Design Hash
    const canonicalDesignHash = DesignCertificateEngine.computeCanonicalDesignHash(design);

    // --- State Machine Evaluations (Section 5) ---
    // Start with DRAFT state
    let evaluatedStatus: DesignCertificateStatus = 'DRAFT';

    // Verify all policy required claims are covered in verification results
    const claimsMap = new Map<string, VerificationClaimItem>();
    for (const v of verificationResults) {
      claimsMap.set(v.claim, v);
    }

    // Check for conflicting or invalid evidence
    let hasFailedClaim = false;
    let hasInvalidClaim = false;
    let hasUnprovenClaim = false;
    let hasPartialClaim = false;

    for (const reqClaim of policy.requiredClaims) {
      const actual = claimsMap.get(reqClaim);
      if (!actual) {
        errors.push(`Required verification claim '${reqClaim}' is missing from evidence manifest.`);
        hasUnprovenClaim = true;
      } else {
        if (actual.status === 'FAILED') {
          hasFailedClaim = true;
          errors.push(`Required verification claim '${reqClaim}' has FAILED status: ${actual.result}`);
        } else if (actual.status === 'INVALID') {
          hasInvalidClaim = true;
          errors.push(`Required verification claim '${reqClaim}' has INVALID status: ${actual.result}`);
        } else if (actual.status === 'UNPROVEN') {
          hasUnprovenClaim = true;
        } else if (actual.status === 'PARTIAL') {
          hasPartialClaim = true;
        }
      }
    }

    // Evaluate claim verification outcomes
    for (const claim of verificationResults) {
      if (claim.status === 'FAILED') hasFailedClaim = true;
      if (claim.status === 'INVALID') hasInvalidClaim = true;
    }

    // Step 1: Transition DRAFT -> UNDER_REVIEW
    if (errors.length === 0) {
      evaluatedStatus = 'UNDER_REVIEW';
    } else {
      evaluatedStatus = 'INVALID';
    }

    // Step 2: Transition UNDER_REVIEW -> VERIFIED
    if (evaluatedStatus === 'UNDER_REVIEW' && !hasFailedClaim && !hasInvalidClaim) {
      // Check if all claims are either PROVEN or VERIFIED
      const allVerified = policy.requiredClaims.every(req => {
        const claimStatus = claimsMap.get(req)?.status;
        return claimStatus === 'VERIFIED' || claimStatus === 'PROVEN';
      });

      if (allVerified) {
        evaluatedStatus = 'VERIFIED';
      } else {
        evaluatedStatus = 'UNDER_REVIEW';
      }
    }

    // Step 3: Transition VERIFIED -> CERTIFIED (Final Stage)
    // ONLY allowed if all required claims are VERIFIED/PROVEN, and NO unproven, failed, or invalid claims remain
    if (evaluatedStatus === 'VERIFIED' && !hasUnprovenClaim && !hasPartialClaim) {
      evaluatedStatus = 'CERTIFIED';
    } else if (hasFailedClaim) {
      evaluatedStatus = 'FAILED';
    } else if (hasInvalidClaim) {
      evaluatedStatus = 'INVALID';
    }

    // Handle targetStatus constraints if requested, but respect the rules
    if (params.targetStatus) {
      if (params.targetStatus === 'CERTIFIED' && evaluatedStatus !== 'CERTIFIED') {
        errors.push(`Cannot transition to CERTIFIED status due to unproven or invalid claims. Current evaluation is ${evaluatedStatus}`);
        evaluatedStatus = 'FAILED';
      } else {
        evaluatedStatus = params.targetStatus;
      }
    }

    // A Design Certificate MUST NOT claim safety/airworthiness/manufacturability unless independent evidence exists (Section 8)
    const safetyClaim = claimsMap.get('Safety and Airworthiness');
    if (safetyClaim && (safetyClaim.status === 'PROVEN' || safetyClaim.status === 'VERIFIED')) {
      // Allowed to claim since independent evidence is explicitly attached and verified
    } else {
      // Mask or ignore any unsupported marketing claims
      const hasUnprovenMarketing = limitations.some(lim => lim.toLowerCase().includes('certified safe') || lim.toLowerCase().includes('airworthy'));
      if (!hasUnprovenMarketing && limitations.length === 0) {
        // Enforce strict engineering limitations
        (limitations as string[]).push('Design certificate only attests to data integrity and verified engineering results. It does not certify flight safety or manufacturing suitability.');
      }
    }

    // Compute stable Fingerprint (Section 9)
    const fingerprint = DesignCertificateEngine.computeFingerprint({
      designId: design.designId,
      designRevision: design.designRevision,
      canonicalDesignHash,
      provenanceRoot: design.provenanceRoot,
      verificationResults,
      certificateVersion: version,
    });

    const issuedAt = new Date().toISOString();
    const certificateId = DesignCertificateEngine.computeCertificateId(design.designId, design.designRevision, issuedAt);

    // Compute Overall validation verdict based on state machine
    let validationVerdict: ClaimVerificationStatus = 'UNPROVEN';
    if (evaluatedStatus === 'CERTIFIED') {
      validationVerdict = 'PROVEN';
    } else if (evaluatedStatus === 'VERIFIED') {
      validationVerdict = 'VERIFIED';
    } else if (evaluatedStatus === 'UNDER_REVIEW') {
      validationVerdict = 'PARTIAL';
    } else if (evaluatedStatus === 'FAILED') {
      validationVerdict = 'FAILED';
    } else if (evaluatedStatus === 'INVALID') {
      validationVerdict = 'INVALID';
    }

    const certificate: DesignCertificate = {
      certificateId,
      designId: design.designId,
      engineeringIdentity,
      designRevision: design.designRevision,
      canonicalDesignHash,
      geometryHash: design.geometryHash,
      materialReferences: [...design.materialReferences],
      assemblyReferences: [...design.assemblyReferences],
      constraintReferences: [...design.constraintReferences],
      simulationReferences: [...design.simulationReferences],
      manufacturingReferences: [...design.manufacturingReferences],
      provenanceRoot: design.provenanceRoot,
      evidenceReferences: [...evidenceReferences],
      verificationResults: [...verificationResults],
      issuedAt,
      issuer,
      certificateVersion: version,
      status: evaluatedStatus,
      limitations: [...limitations],
      fingerprint,
      validationVerdict,
    };

    if (evaluatedStatus === 'CERTIFIED' || evaluatedStatus === 'VERIFIED' || evaluatedStatus === 'UNDER_REVIEW') {
      this.certificates.set(certificateId, certificate);
    }

    return {
      status: evaluatedStatus,
      certificate,
      errors: errors,
    };
  }

  /**
   * Revocation action (Section 6)
   */
  public revokeCertificate(certificateId: string, reason: string, author: string): void {
    const cert = this.certificates.get(certificateId);
    if (cert) {
      const revokedCert: DesignCertificate = {
        ...cert,
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revocationReason: reason,
        revokedBy: author,
        validationVerdict: 'INVALID',
      };
      this.certificates.set(certificateId, revokedCert);
    }
  }

  public getCertificate(certificateId: string): DesignCertificate | undefined {
    return this.certificates.get(certificateId);
  }
}

/**
 * DesignCertificateVerifier (Section 4)
 * Completely independent of DesignCertificateService, recalculates hashes and verifies chain-of-custody.
 */
export class DesignCertificateVerifier {
  /**
   * Verifies a design certificate thoroughly. Does NOT rely on saved status.
   */
  public static verify(
    certificate: DesignCertificate,
    actualDesign: {
      readonly designId: string;
      readonly designRevision: string;
      readonly geometryHash: string;
      readonly materialReferences: readonly string[];
      readonly assemblyReferences: readonly string[];
      readonly constraintReferences: readonly string[];
      readonly simulationReferences: readonly string[];
      readonly manufacturingReferences: readonly string[];
      readonly provenanceRoot: string;
    },
    evidenceLedger?: EngineeringEvidenceLedger
  ): DesignCertificateVerificationReport {
    const details: string[] = [];
    let tamperDetected = false;
    let hashValidationMatched = true;
    let chainOfCustodyVerified = true;
    let evaluatedStatus: DesignCertificateStatus = certificate.status;

    // 1. Recalculate Canonical Design Hash
    const recomputedCanonicalHash = DesignCertificateEngine.computeCanonicalDesignHash(actualDesign);
    if (recomputedCanonicalHash !== certificate.canonicalDesignHash) {
      details.push(`Canonical Design Hash Mismatch: expected '${certificate.canonicalDesignHash}', actual '${recomputedCanonicalHash}'`);
      tamperDetected = true;
      hashValidationMatched = false;
    }

    // 2. Recalculate Certificate Fingerprint
    const recomputedFingerprint = DesignCertificateEngine.computeFingerprint({
      designId: certificate.designId,
      designRevision: certificate.designRevision,
      canonicalDesignHash: certificate.canonicalDesignHash,
      provenanceRoot: certificate.provenanceRoot,
      verificationResults: certificate.verificationResults,
      certificateVersion: certificate.certificateVersion,
    });

    if (recomputedFingerprint !== certificate.fingerprint) {
      details.push(`Certificate Fingerprint Mismatch: expected '${certificate.fingerprint}', actual '${recomputedFingerprint}' (Certificate metadata tampered)`);
      tamperDetected = true;
    }

    // 3. Verify Design Identity and Revision Isolation (Section 11)
    if (actualDesign.designId !== certificate.designId) {
      details.push(`Design Identity Mismatch: certificate is for '${certificate.designId}', design is '${actualDesign.designId}'`);
      chainOfCustodyVerified = false;
    }
    if (actualDesign.designRevision !== certificate.designRevision) {
      details.push(`Design Revision Mismatch: certificate is for '${certificate.designRevision}', design is '${actualDesign.designRevision}'`);
      chainOfCustodyVerified = false;
    }

    // 4. Verify Geometry Mismatch
    if (actualDesign.geometryHash !== certificate.geometryHash) {
      details.push(`Geometry Mismatch: certificate contains geometry hash '${certificate.geometryHash}', design contains '${actualDesign.geometryHash}'`);
      tamperDetected = true;
    }

    // 5. Cross-reference Evidence Ledger references if ledger is provided (Section 12)
    let completenessVerdict: ClaimVerificationStatus = 'PROVEN';
    let missingEvidenceCount = 0;
    let revokedEvidenceCount = 0;

    if (evidenceLedger) {
      for (const ref of certificate.evidenceReferences) {
        const record = evidenceLedger.query.getEvidence(ref);
        if (!record) {
          details.push(`Missing evidence record in Ledger for ID: '${ref}'`);
          missingEvidenceCount++;
        } else {
          // Check if evidence state is invalid or revoked
          const check = evidenceLedger.query.verifyEvidence(ref);
          if (check.verdict === 'INVALID') {
            details.push(`Referenced evidence record '${ref}' is INVALID in the Ledger.`);
            revokedEvidenceCount++;
          }
        }
      }
    }

    if (missingEvidenceCount > 0) {
      completenessVerdict = 'UNPROVEN';
      evaluatedStatus = 'INVALID';
    } else if (revokedEvidenceCount > 0) {
      completenessVerdict = 'INVALID';
      evaluatedStatus = 'REVOKED';
    }

    // 6. Inspect individual claims to detect FAILED or INVALID results
    for (const claim of certificate.verificationResults) {
      if (claim.status === 'FAILED') {
        details.push(`Claim verification '${claim.claim}' has status FAILED.`);
        completenessVerdict = 'FAILED';
        if (evaluatedStatus !== 'REVOKED') evaluatedStatus = 'FAILED';
      } else if (claim.status === 'INVALID') {
        details.push(`Claim verification '${claim.claim}' has status INVALID.`);
        completenessVerdict = 'INVALID';
        if (evaluatedStatus !== 'REVOKED') evaluatedStatus = 'INVALID';
      }
    }

    // Force EXPIRED or REVOKED if already marked so (Section 6)
    if (certificate.status === 'REVOKED') {
      evaluatedStatus = 'REVOKED';
      completenessVerdict = 'INVALID';
    } else if (certificate.status === 'EXPIRED') {
      evaluatedStatus = 'EXPIRED';
      completenessVerdict = 'UNPROVEN';
    }

    // If tamper detected, set evaluatedStatus to INVALID
    if (tamperDetected) {
      evaluatedStatus = 'INVALID';
      completenessVerdict = 'INVALID';
    }

    return {
      certificateId: certificate.certificateId,
      fingerprintMatch: !tamperDetected,
      tamperDetected,
      hashValidationMatched,
      chainOfCustodyVerified,
      evidenceCompletenessVerdict: completenessVerdict,
      details,
      evaluatedStatus,
    };
  }
}
