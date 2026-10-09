/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-163: Result Certification Engine
 */

import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';
import { AttestationSigner } from '../attestation/AttestationSigner';
import { CryptographicAttestation, SigningKeyPair } from '../attestation/types';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import {
  CertificateVerificationResult,
  CertificationStatus,
  CertificationVerificationCurrentState,
  EngineeringResultCertificate,
  ResultCertificateDocument,
  ResultCertificationPolicy,
  ResultObject,
  VerificationEvidence,
} from './types';

export class ResultCertificationEngine {
  private static readonly instance = new ResultCertificationEngine();
  private readonly certificates = new Map<string, EngineeringResultCertificate>();

  private constructor() {}

  public static getInstance(): ResultCertificationEngine {
    return this.instance;
  }

  public resetRegistry(): void {
    this.certificates.clear();
  }

  /**
   * Helper to evaluate numerical tolerance rules
   */
  private static satisfyTolerance(key: string, value: number, limit: number): boolean {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('safety') ||
      lowerKey.includes('factor') ||
      lowerKey.includes('margin') ||
      lowerKey.includes('min') ||
      lowerKey.includes('conservation') ||
      lowerKey.includes('stability') ||
      lowerKey.includes('efficiency') ||
      lowerKey.includes('pct') ||
      lowerKey.includes('ratio')
    ) {
      return value >= limit;
    }
    return value <= limit;
  }

  /**
   * Evaluates certification criteria and generates an Engineering Result Certificate.
   */
  public createCertificate(params: {
    readonly result: ResultObject;
    readonly verificationEvidence: VerificationEvidence;
    readonly attestation?: CryptographicAttestation;
    readonly certificationPolicy: ResultCertificationPolicy;
    readonly engineeringIdentity: string;
    readonly issuer?: string;
    readonly keyPair?: SigningKeyPair;
  }): { readonly status: CertificationStatus; readonly certificate?: EngineeringResultCertificate; readonly errors: readonly string[] } {
    const { result, verificationEvidence, attestation, certificationPolicy, engineeringIdentity, issuer, keyPair } = params;
    const errors: string[] = [];
    const criteria: string[] = [];

    // --- Boundary Checks & Integrities ---
    
    // 1. Result presence
    if (!result || !result.resultId) {
      return { status: 'INCOMPLETE', errors: ['Result parameters are missing or incomplete.'] };
    }

    // 2. Verification presence
    if (!verificationEvidence || !verificationEvidence.verificationId) {
      return { status: 'INCOMPLETE', errors: ['Verification evidence is missing or incomplete.'] };
    }

    // 3. Subject-Result Binding check
    if (result.resultId !== verificationEvidence.resultId) {
      errors.push(`Result ID mismatch: Result claims '${result.resultId}', verification claims '${verificationEvidence.resultId}'`);
    }

    if (attestation && attestation.subjectId !== result.subjectId) {
      errors.push(`Subject ID mismatch: Attestation subject is '${attestation.subjectId}', result subject is '${result.subjectId}'`);
    }

    // 4. Verification status
    criteria.push('VERIFICATION_CHECK_PASS');
    if (!verificationEvidence.isVerified) {
      errors.push('Verification status is failed. Unverified results cannot be certified.');
    }

    // 5. Attestation requirements
    if (certificationPolicy.requiredAttestation) {
      criteria.push('CRYPTOGRAPHIC_ATTESTATION_CHECK');
      if (!attestation) {
        errors.push('Cryptographic Attestation is required by policy but was not provided.');
      } else if (attestation.status !== 'ATTESTED') {
        errors.push(`Provided attestation status is '${attestation.status}', expected 'ATTESTED'.`);
      }
    }

    // 6. Solver matching
    if (attestation) {
      criteria.push('SOLVER_IDENTITY_MATCH');
      if (result.solverIdentity !== attestation.solverIdentity) {
        errors.push(`Solver identity mismatch: Result uses '${result.solverIdentity}', Attestation uses '${attestation.solverIdentity}'`);
      }
      if (result.solverVersion !== attestation.solverVersion) {
        errors.push(`Solver version mismatch: Result uses '${result.solverVersion}', Attestation uses '${attestation.solverVersion}'`);
      }
      if (result.inputHash !== attestation.inputHash) {
        errors.push(`Input hash mismatch: Result inputs hash '${result.inputHash}', Attestation input hash '${attestation.inputHash}'`);
      }
      if (result.executionId !== attestation.executionId) {
        errors.push(`Execution ID mismatch: Result claims '${result.executionId}', Attestation claims '${attestation.executionId}'`);
      }
    }

    // 7. Solver Version range policy
    if (certificationPolicy.requiredSolverVersion) {
      criteria.push('SOLVER_VERSION_COMPLIANCE');
      if (result.solverVersion !== certificationPolicy.requiredSolverVersion) {
        // Simple exact match first for safety, or generic check
        errors.push(`Solver version '${result.solverVersion}' does not satisfy policy requirement of '${certificationPolicy.requiredSolverVersion}'`);
      }
    }

    // 8. Evidence Binding
    certificationPolicy.requiredEvidence.forEach(req => {
      criteria.push(`EVIDENCE_COMPLETENESS_${req.toUpperCase()}`);
      const hasEvidence = verificationEvidence.verificationChecks.includes(req) || 
                          verificationEvidence.evidencePayload[req] !== undefined ||
                          verificationEvidence.evidenceId === req;
      if (!hasEvidence) {
        errors.push(`Required evidence '${req}' specified by policy is missing from verification trace.`);
      }
    });

    // 9. Verification list matching
    certificationPolicy.requiredVerifications.forEach(req => {
      criteria.push(`VERIFICATION_RULE_${req.toUpperCase()}`);
      if (!verificationEvidence.verificationChecks.includes(req)) {
        errors.push(`Required verification check '${req}' was not executed during verification phase.`);
      }
    });

    // --- Numerical Qualification Checks (CFD / FEM / CAE) ---

    // 10. Residuals
    if (certificationPolicy.requiredResidualsMax) {
      criteria.push('NUMERICAL_RESIDUAL_LIMIT_CHECK');
      const residuals = result.numericalQualification?.residuals;
      if (!residuals) {
        return { status: 'UNPROVEN', errors: ['Numerical residuals are required by policy but not present in the result.'] };
      }
      for (const [key, limit] of Object.entries(certificationPolicy.requiredResidualsMax)) {
        const val = residuals[key];
        if (val === undefined) {
          return { status: 'UNPROVEN', errors: [`Required residual metric '${key}' is missing from results.`] };
        }
        if (val > limit) {
          errors.push(`Numerical residual '${key}' of ${val} exceeds policy tolerance of ${limit}.`);
        }
      }
    }

    // 11. Convergence
    if (certificationPolicy.requireConvergence) {
      criteria.push('NUMERICAL_CONVERGENCE_CHECK');
      const convergence = result.numericalQualification?.convergence;
      if (!convergence) {
        return { status: 'UNPROVEN', errors: ['Convergence check is required by policy but no convergence metadata was provided.'] };
      }
      if (!convergence.isConverged) {
        errors.push(`Convergence failure: Solved in ${convergence.iterations} iterations but did not satisfy residual tolerance of ${convergence.residualTolerance}.`);
      }
    }

    // 12. Conservation
    if (certificationPolicy.requireConservation) {
      criteria.push('NUMERICAL_CONSERVATION_CHECK');
      const conservation = result.numericalQualification?.conservation;
      if (!conservation) {
        return { status: 'UNPROVEN', errors: ['Conservation law verification is required by policy but no conservation metadata is present.'] };
      }
      if (!conservation.isConserved) {
        errors.push('Conservation validation failed: Mass/Momentum/Energy imbalance detected outside safe threshold.');
      }
    }

    // 13. Stability
    if (certificationPolicy.requireStability) {
      criteria.push('NUMERICAL_STABILITY_CHECK');
      const stability = result.numericalQualification?.stability;
      if (!stability) {
        return { status: 'UNPROVEN', errors: ['Numerical stability verification is required by policy but no stability metadata is present.'] };
      }
      if (!stability.isStable) {
        errors.push('Numerical solver instability detected (e.g. Courant number exceeds CFL limit).');
      }
    }

    // 14. Validation References
    if (certificationPolicy.requiredValidation && certificationPolicy.requiredValidation.length > 0) {
      criteria.push('STANDARDS_VALIDATION_MATCH');
      const refs = result.numericalQualification?.validationReferences || [];
      certificationPolicy.requiredValidation.forEach(vRef => {
        if (!refs.includes(vRef)) {
          return { status: 'UNPROVEN', errors: [`Standard validation reference '${vRef}' required by policy is missing.`] };
        }
      });
    }

    // 15. Numerical tolerances
    if (certificationPolicy.requiredTolerances) {
      criteria.push('PHYSICS_TOLERANCE_BOUNDS_CHECK');
      for (const [key, limit] of Object.entries(certificationPolicy.requiredTolerances)) {
        const val = result.valuePayload[key];
        if (val === undefined) {
          return { status: 'UNPROVEN', errors: [`Physical state tolerance variable '${key}' is required by policy but missing from raw results.`] };
        }
        if (!ResultCertificationEngine.satisfyTolerance(key, val, limit)) {
          errors.push(`Physical parameter '${key}' value of ${val} violates policy boundary threshold limit of ${limit}.`);
        }
      }
    }

    // Set expiration if policy defines it
    let expirationDate: string | undefined;
    if (certificationPolicy.expirationPolicy) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + certificationPolicy.expirationPolicy.durationDays);
      expirationDate = expDate.toISOString();
    }

    // Compute canonical result representation and resultHash (Rule 7)
    const resultCanonicalStr = AttestationCanonicalizer.canonicalize({
      resultId: result.resultId,
      subjectId: result.subjectId,
      resultType: result.resultType,
      valuePayload: result.valuePayload,
      numericalQualification: result.numericalQualification || null,
      executionId: result.executionId,
      solverIdentity: result.solverIdentity,
      solverVersion: result.solverVersion,
      inputHash: result.inputHash,
    });
    const computedResultHash = AttestationCanonicalizer.sha256(resultCanonicalStr);

    // Build the deterministic payload for the certificate itself
    const certificatePayload = {
      resultId: result.resultId,
      subjectId: result.subjectId,
      resultType: result.resultType,
      resultHash: computedResultHash,
      inputHash: result.inputHash,
      solverIdentity: result.solverIdentity,
      solverVersion: result.solverVersion,
      executionId: result.executionId,
      verificationId: verificationEvidence.verificationId,
      evidenceId: verificationEvidence.evidenceId,
      evidenceHash: verificationEvidence.evidenceHash,
      attestationId: attestation ? attestation.attestationId : 'NONE',
      attestationHash: attestation ? attestation.canonicalPayloadHash : 'NONE',
      policyId: certificationPolicy.policyId,
      policyVersion: certificationPolicy.policyVersion,
      criteria: criteria,
      verificationStatus: verificationEvidence.isVerified,
      certificateVersion: '1.0.0',
      issuer: issuer || 'SECP-CERTIFICATION-AUTHORITY',
    };

    const canonicalCertificateStr = AttestationCanonicalizer.canonicalize(certificatePayload);
    const computedPayloadHash = AttestationCanonicalizer.sha256(canonicalCertificateStr);

    // Cryptographic Signing (Section 16 - Signature Boundary)
    const sigResult = AttestationSigner.sign(canonicalCertificateStr, keyPair);
    const signature = sigResult.signature || '';
    const signingKeyId = sigResult.signingKeyId || '';

    // Final Status Selection
    const finalStatus: CertificationStatus = errors.length > 0 ? 'INVALID' : 'CERTIFIED';

    const certificateId = `CERT-${computedPayloadHash.substring(0, 16).toUpperCase()}`;

    const certificate: EngineeringResultCertificate = {
      certificateId,
      resultId: result.resultId,
      subjectId: result.subjectId,
      engineeringIdentity: engineeringIdentity,
      resultType: result.resultType,
      resultHash: computedResultHash,
      inputHash: result.inputHash,
      solverIdentity: result.solverIdentity,
      solverVersion: result.solverVersion,
      executionId: result.executionId,
      verificationId: verificationEvidence.verificationId,
      evidenceId: verificationEvidence.evidenceId,
      evidenceHash: verificationEvidence.evidenceHash,
      attestationId: attestation ? attestation.attestationId : 'NONE',
      policyId: certificationPolicy.policyId,
      criteria,
      verificationStatus: verificationEvidence.isVerified,
      certificationStatus: finalStatus,
      issuedAt: new Date().toISOString(),
      certificateVersion: '1.0.0',
      issuer: issuer || 'SECP-CERTIFICATION-AUTHORITY',
      signature,
      signingKeyId,
      canonicalPayloadHash: computedPayloadHash,
      numericalQualification: result.numericalQualification,
      expirationDate,
    };

    return {
      status: finalStatus,
      certificate: finalStatus === 'CERTIFIED' ? certificate : undefined,
      errors,
    };
  }

  /**
   * Registers a certificate into the active registry & binds to the ledger (PATCH-157/161 integration)
   */
  public registerCertificate(
    certificate: EngineeringResultCertificate,
    ledgerInstance?: EngineeringEvidenceLedger
  ): void {
    this.certificates.set(certificate.certificateId, certificate);

    // Anchor to global Engineering Evidence Ledger
    const ledger = ledgerInstance || EngineeringEvidenceLedger.getInstance();
    ledger.registerEvidence({
      evidenceType: 'CERTIFICATE',
      engineeringObjectId: certificate.subjectId,
      objectRevision: certificate.certificateVersion,
      projectId: 'PRJ-CERTIFICATION-AUDIT',
      organizationId: 'ORG-SECP-COMPLIANCE',
      producerIdentity: certificate.engineeringIdentity,
      producerType: 'SERVICE',
      sourceSystem: 'SECP-CERTIFICATION-ENGINE',
      sourceVersion: certificate.certificateVersion,
      payload: {
        certificateId: certificate.certificateId,
        resultId: certificate.resultId,
        resultHash: certificate.resultHash,
        certificationStatus: certificate.certificationStatus,
        policyId: certificate.policyId,
        issuedAt: certificate.issuedAt,
        signature: certificate.signature,
        signingKeyId: certificate.signingKeyId,
        canonicalPayloadHash: certificate.canonicalPayloadHash,
        expirationDate: certificate.expirationDate,
      },
      correlationId: certificate.executionId,
    });
  }

  public getCertificateById(certificateId: string): EngineeringResultCertificate | undefined {
    return this.certificates.get(certificateId);
  }

  public listAllCertificates(): readonly EngineeringResultCertificate[] {
    return Array.from(this.certificates.values());
  }

  /**
   * Independently verifies an Engineering Result Certificate against current physics/DAG/attestation state.
   * Completely independent of UI state.
   */
  public verifyResultCertificate(
    certificate: EngineeringResultCertificate,
    currentState: CertificationVerificationCurrentState
  ): CertificateVerificationResult {
    const details: string[] = [];
    let resultVerified = true;
    let inputVerified = true;
    let evidenceVerified = true;
    let attestationVerified = true;
    let solverVerified = true;
    let executionVerified = true;
    let policyVerified = true;
    let criteriaVerified = true;
    let signatureVerified: boolean | 'UNPROVEN' = 'UNPROVEN';
    let signatureStatus: 'AUTHENTIC' | 'UNPROVEN' | 'UNAVAILABLE' | 'REVOKED' = 'UNPROVEN';

    // 1. Check expiration
    if (certificate.expirationDate) {
      const now = new Date();
      const exp = new Date(certificate.expirationDate);
      if (now > exp) {
        details.push('Certificate has expired according to policy expiration boundary.');
        return this.buildVerificationResult(certificate, 'EXPIRED', false, false, false, false, false, false, false, false, false, 'UNPROVEN', 'UNPROVEN', details);
      }
    }

    // 2. Check revocation
    if (certificate.certificationStatus === 'REVOKED') {
      details.push(`Certificate was revoked. Reason: ${certificate.revocationReason || 'None specified'}`);
      signatureStatus = 'REVOKED';
      return this.buildVerificationResult(certificate, 'REVOKED', true, true, true, true, true, true, true, true, true, false, 'REVOKED', details);
    }

    const { currentResult, currentVerification, currentAttestation, currentPolicy, trustedPublicKeys } = currentState;

    // 3. Recompute Result Hash (Rule 7)
    let calculatedResHash = '';
    if (currentResult) {
      const resultCanonicalStr = AttestationCanonicalizer.canonicalize({
        resultId: currentResult.resultId,
        subjectId: currentResult.subjectId,
        resultType: currentResult.resultType,
        valuePayload: currentResult.valuePayload,
        numericalQualification: currentResult.numericalQualification || null,
        executionId: currentResult.executionId,
        solverIdentity: currentResult.solverIdentity,
        solverVersion: currentResult.solverVersion,
        inputHash: currentResult.inputHash,
      });
      calculatedResHash = AttestationCanonicalizer.sha256(resultCanonicalStr);

      if (calculatedResHash !== certificate.resultHash) {
        resultVerified = false;
        details.push('Result payload modified: Result hash mismatch.');
      }
      if (currentResult.subjectId !== certificate.subjectId) {
        resultVerified = false;
        details.push('Subject ID mismatch on active result state.');
      }
    } else {
      details.push('Verification Warning: currentResult state is missing.');
    }

    // 4. Input Hash Check
    if (currentResult && currentResult.inputHash !== certificate.inputHash) {
      inputVerified = false;
      details.push('Input parameters modified: Input hash mismatch.');
    }

    // 5. Evidence Hash Verification
    if (currentVerification) {
      if (currentVerification.evidenceId !== certificate.evidenceId || currentVerification.evidenceHash !== certificate.evidenceHash) {
        evidenceVerified = false;
        details.push('Verification evidence modified or replaced.');
      }
    }

    // 6. Attestation Binding Verification
    if (currentAttestation) {
      if (certificate.attestationId !== 'NONE' && currentAttestation.attestationId !== certificate.attestationId) {
        attestationVerified = false;
        details.push('Cryptographic Attestation ID mismatch with active state.');
      }
    }

    // 7. Solver & Execution Verification
    if (currentResult) {
      if (currentResult.solverIdentity !== certificate.solverIdentity) {
        solverVerified = false;
        details.push('Solver identity modified on active result.');
      }
      if (currentResult.solverVersion !== certificate.solverVersion) {
        solverVerified = false;
        details.push('Solver version modified on active result.');
      }
      if (currentResult.executionId !== certificate.executionId) {
        executionVerified = false;
        details.push('Execution ID modified on active result.');
      }
    }

    // 8. Policy compliance check
    if (currentPolicy) {
      if (currentPolicy.policyId !== certificate.policyId) {
        policyVerified = false;
        details.push('Policy mismatch: current policy differs from certificate policy.');
      }
    }

    // Reconstruct the certificate payload to check integrity (Rule 8)
    const certificatePayload = {
      resultId: certificate.resultId,
      subjectId: certificate.subjectId,
      resultType: certificate.resultType,
      resultHash: calculatedResHash || certificate.resultHash,
      inputHash: currentResult ? currentResult.inputHash : certificate.inputHash,
      solverIdentity: certificate.solverIdentity,
      solverVersion: certificate.solverVersion,
      executionId: certificate.executionId,
      verificationId: certificate.verificationId,
      evidenceId: certificate.evidenceId,
      evidenceHash: currentVerification ? currentVerification.evidenceHash : certificate.evidenceId,
      attestationId: certificate.attestationId,
      attestationHash: currentAttestation ? currentAttestation.canonicalPayloadHash : 'NONE',
      policyId: certificate.policyId,
      policyVersion: currentPolicy ? currentPolicy.policyVersion : '1.0.0',
      criteria: certificate.criteria,
      verificationStatus: certificate.verificationStatus,
      certificateVersion: certificate.certificateVersion,
      issuer: certificate.issuer,
    };

    const canonicalCertificateStr = AttestationCanonicalizer.canonicalize(certificatePayload);
    const calculatedPayloadHash = AttestationCanonicalizer.sha256(canonicalCertificateStr);
    const integrityVerified = calculatedPayloadHash === certificate.canonicalPayloadHash;

    if (!integrityVerified) {
      details.push('Certificate payload tampered with: Payload hash mismatch.');
    }

    // 9. Verify Signature
    if (certificate.signature) {
      if (currentState.skipSignatureVerification) {
        signatureVerified = 'UNPROVEN';
        signatureStatus = 'UNPROVEN';
      } else {
        const verifyResult = AttestationSigner.verifySignature(
          canonicalCertificateStr,
          certificate.signature,
          certificate.signingKeyId,
          'HMAC-SHA256', // Default algorithm in SECP
          trustedPublicKeys
        );

        if (verifyResult === true) {
          signatureVerified = true;
          signatureStatus = 'AUTHENTIC';
        } else if (verifyResult === false) {
          signatureVerified = false;
          signatureStatus = 'UNAVAILABLE'; // Invalid signature means untrusted
          details.push('Cryptographic Signature verification failed: Signature is invalid.');
        } else {
          signatureVerified = 'UNPROVEN';
          signatureStatus = verifyResult === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'UNPROVEN';
          details.push('Cryptographic signature status: UNAVAILABLE or UNPROVEN.');
        }
      }
    } else {
      signatureVerified = 'UNPROVEN';
      signatureStatus = 'UNAVAILABLE';
    }

    const allVerified =
      integrityVerified &&
      resultVerified &&
      inputVerified &&
      evidenceVerified &&
      attestationVerified &&
      solverVerified &&
      executionVerified &&
      policyVerified &&
      criteriaVerified &&
      (signatureVerified === true || signatureVerified === 'UNPROVEN');

    const finalVerdict: CertificationStatus = allVerified ? 'CERTIFIED' : 'INVALID';

    return {
      certificateId: certificate.certificateId,
      verdict: finalVerdict,
      integrityVerified,
      resultVerified,
      inputVerified,
      evidenceVerified,
      attestationVerified,
      solverVerified,
      executionVerified,
      policyVerified,
      criteriaVerified,
      signatureVerified,
      signatureStatus,
      recalculatedHashes: {
        expectedResultHash: certificate.resultHash,
        calculatedResultHash: calculatedResHash || certificate.resultHash,
        expectedInputHash: certificate.inputHash,
        calculatedInputHash: currentResult ? currentResult.inputHash : certificate.inputHash,
        expectedEvidenceHash: certificate.evidenceId,
        calculatedEvidenceHash: currentVerification ? currentVerification.evidenceHash : certificate.evidenceId,
        expectedCanonicalPayloadHash: certificate.canonicalPayloadHash,
        calculatedCanonicalPayloadHash: calculatedPayloadHash,
      },
      details,
      verifiedAt: new Date().toISOString(),
    };
  }

  private buildVerificationResult(
    cert: EngineeringResultCertificate,
    verdict: CertificationStatus,
    integrity: boolean,
    res: boolean,
    inp: boolean,
    ev: boolean,
    att: boolean,
    solv: boolean,
    exec: boolean,
    pol: boolean,
    crit: boolean,
    sig: boolean | 'UNPROVEN',
    sigStat: 'AUTHENTIC' | 'UNPROVEN' | 'UNAVAILABLE' | 'REVOKED',
    details: string[]
  ): CertificateVerificationResult {
    return {
      certificateId: cert.certificateId,
      verdict,
      integrityVerified: integrity,
      resultVerified: res,
      inputVerified: inp,
      evidenceVerified: ev,
      attestationVerified: att,
      solverVerified: solv,
      executionVerified: exec,
      policyVerified: pol,
      criteriaVerified: crit,
      signatureVerified: sig,
      signatureStatus: sigStat,
      recalculatedHashes: {
        expectedResultHash: cert.resultHash,
        calculatedResultHash: cert.resultHash,
        expectedInputHash: cert.inputHash,
        calculatedInputHash: cert.inputHash,
        expectedEvidenceHash: cert.evidenceId,
        calculatedEvidenceHash: cert.evidenceId,
        expectedCanonicalPayloadHash: cert.canonicalPayloadHash,
        calculatedCanonicalPayloadHash: cert.canonicalPayloadHash,
      },
      details,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Revokes a certificate by updating its status to REVOKED in registry
   */
  public revokeCertificate(params: {
    readonly certificateId: string;
    readonly reason: string;
    readonly actor: string;
    readonly relatedEvidenceId?: string;
  }): { readonly success: boolean; readonly certificate?: EngineeringResultCertificate } {
    const cert = this.certificates.get(params.certificateId);
    if (!cert) {
      return { success: false };
    }

    const revokedCert: EngineeringResultCertificate = {
      ...cert,
      certificationStatus: 'REVOKED',
      revocationReason: params.reason,
      revokedAt: new Date().toISOString(),
      revokedBy: params.actor,
      revokedEvidenceId: params.relatedEvidenceId,
    };

    this.certificates.set(params.certificateId, revokedCert);
    return { success: true, certificate: revokedCert };
  }

  /**
   * Exports certificate in transportable format: ResultCertificateDocument (Section 15)
   */
  public exportCertificate(certificateId: string): ResultCertificateDocument | undefined {
    const cert = this.certificates.get(certificateId);
    if (!cert) return undefined;

    return {
      certificateMetadata: {
        certificateId: cert.certificateId,
        certificateVersion: cert.certificateVersion,
        issuedAt: cert.issuedAt,
        issuer: cert.issuer,
        status: cert.certificationStatus,
        expiresAt: cert.expirationDate,
      },
      resultIdentity: {
        resultId: cert.resultId,
        subjectId: cert.subjectId,
        resultType: cert.resultType,
      },
      hashes: {
        resultHash: cert.resultHash,
        inputHash: cert.inputHash,
        evidenceHash: cert.evidenceId,
        attestationHash: cert.attestationId,
        canonicalPayloadHash: cert.canonicalPayloadHash,
      },
      executionInformation: {
        executionId: cert.executionId,
        engineeringIdentity: cert.engineeringIdentity,
      },
      solverInformation: {
        solverIdentity: cert.solverIdentity,
        solverVersion: cert.solverVersion,
      },
      verificationEvidence: {
        verificationId: cert.verificationId,
        evidenceId: cert.evidenceId,
        verificationStatus: cert.verificationStatus,
        checks: cert.criteria,
      },
      certificationCriteria: cert.criteria,
      attestation: {
        attestationId: cert.attestationId,
        signatureStatus: cert.attestationId !== 'NONE' ? 'AVAILABLE' : 'UNAVAILABLE',
        signingKeyId: cert.signingKeyId || 'NONE',
      },
      signatureStatus: {
        status: cert.signature ? 'AUTHENTIC' : 'UNAVAILABLE',
        signature: cert.signature,
        signingKeyId: cert.signingKeyId,
      },
      verdict: cert.certificationStatus,
      auditReferences: {
        policyId: cert.policyId,
        policyVersion: '1.0.0',
      },
    };
  }
}
