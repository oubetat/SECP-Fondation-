/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-166: Hard Acceptance Gate 166 (Design Certificate Gate)
 */

import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { EngineeringObjectType, IdentityClassification } from '../identity/CanonicalEngineeringIdentity';
import { EngineeringEvidenceLedger } from '../evidence/ledger/EngineeringEvidenceLedger';
import { DesignCertificateEngine, DesignCertificateVerifier } from './DesignCertificateEngine';
import {
  DesignCertificate,
  DesignCertificatePolicy,
  VerificationClaimItem,
} from './designTypes';

export interface GateCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly passed: boolean;
  readonly verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INVALID' | 'REVOKED';
}

export interface Gate166Report {
  readonly gateId: string;
  readonly patch: 'PATCH-166';
  readonly verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INVALID' | 'REVOKED';
  readonly passedChecks: number;
  readonly totalChecks: number;
  readonly checks: readonly GateCheck[];
  readonly summary: string;
  readonly evaluatedAt: string;
}

export class HardAcceptanceGate166 {
  /**
   * Evaluates the full suite of PATCH-166 design certificate constraints.
   */
  public static evaluate(): Gate166Report {
    const checks: GateCheck[] = [];
    const engine = DesignCertificateEngine.getInstance();
    engine.resetRegistry();

    // 1. Setup default design identity (PATCH-008 & PATCH-158)
    const designIdentity = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.DESIGN,
      projectId: 'PRJ-166-LANDING-GEAR',
      revisionId: 'REV-A',
      createdBy: 'ENG-OUBETAT',
      seed: 'SEED-LANDING-GEAR-166',
      classification: IdentityClassification.CONFIDENTIAL,
    }, {
      name: 'Nose Landing Gear Strut',
      designer: 'Oubetat',
      cadFile: 'nlg_strut_v12.step'
    });

    const defaultDesign = {
      designId: designIdentity.identityId,
      designRevision: 'REV-A',
      geometryHash: 'HASH-GEOM-CAD-166-A',
      materialReferences: ['EVID-MAT-TI-6AL-4V-001'],
      assemblyReferences: ['EVID-ASY-NLG-COMPONENTS-001'],
      constraintReferences: ['EVID-GCS-ALIGNMENT-001'],
      simulationReferences: ['EVID-SIM-STRESS-ANALYSIS-001'],
      manufacturingReferences: ['EVID-MFG-CNC-MILLING-001'],
      provenanceRoot: 'HASH-PROV-ROOT-166-A',
    };

    // Setup typical policies
    const standardPolicy: DesignCertificatePolicy = {
      policyId: 'POL-DSN-CRITICAL-166',
      policyVersion: '1.0.0',
      requiredClaims: [
        'Geometry Integrity',
        'Material Compliance',
        'Constraint Verification',
        'Simulation Verification',
        'Manufacturing Compatibility'
      ],
      requireCanonicalHash: true,
      requireProvenanceRoot: true,
      requireNoConflictingEvidence: true,
      requireAttestations: true,
    };

    // Standard valid claims
    const validClaims: VerificationClaimItem[] = [
      {
        claim: 'Geometry Integrity',
        evidence: 'EVID-GEOM-001',
        verificationMethod: 'Independent Hash Recalculation',
        result: 'MATCH',
        status: 'VERIFIED',
      },
      {
        claim: 'Material Compliance',
        evidence: 'EVID-MAT-TI-6AL-4V-001',
        verificationMethod: 'Spectrometry analysis certificate match',
        result: 'MATCH',
        status: 'VERIFIED',
      },
      {
        claim: 'Constraint Verification',
        evidence: 'EVID-GCS-ALIGNMENT-001',
        verificationMethod: 'GCS solver degree of freedom verification',
        result: 'SOLVED',
        status: 'PROVEN',
      },
      {
        claim: 'Simulation Verification',
        evidence: 'EVID-SIM-STRESS-ANALYSIS-001',
        verificationMethod: 'Result certification evaluation',
        result: 'STRESS_BELOW_YIELD',
        status: 'VERIFIED',
      },
      {
        claim: 'Manufacturing Compatibility',
        evidence: 'EVID-MFG-CNC-MILLING-001',
        verificationMethod: 'CNC Toolpath collision simulation validation',
        result: 'NO_COLLISIONS',
        status: 'VERIFIED',
      }
    ];

    // --- CHECK 1: Valid Certificate Generation & Lifecycle ---
    const certResult = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'SECP-CHIEF-METROLOGIST',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-TI-6AL-4V-001', 'EVID-GCS-ALIGNMENT-001', 'EVID-SIM-STRESS-ANALYSIS-001', 'EVID-MFG-CNC-MILLING-001'],
    });

    const certPassed = certResult.status === 'CERTIFIED' && certResult.certificate !== undefined;
    checks.push({
      id: 'CHECK-166-GENERATION',
      name: 'Certificate Generation and Lifecycle State',
      description: 'Generates design certificate transitioning properly from DRAFT to CERTIFIED.',
      passed: certPassed,
      verdict: certPassed ? 'PASS' : 'FAIL',
    });

    const activeCert = certResult.certificate!;

    // --- CHECK 2: Tamper Resistance (Geometry) ---
    const tamperedDesign = {
      ...defaultDesign,
      geometryHash: 'TAMPERED-GEOM-HASH-166', // Modifying geometry hash
    };

    const verifyReportTamperedGeom = DesignCertificateVerifier.verify(activeCert, tamperedDesign);
    const geomTamperPassed = verifyReportTamperedGeom.tamperDetected === true && verifyReportTamperedGeom.evaluatedStatus === 'INVALID';

    checks.push({
      id: 'CHECK-166-TAMPER-GEOM',
      name: 'Tamper Resistance - Geometry Modification',
      description: 'Detects illegal modification of design geometry after certificate issuance.',
      passed: geomTamperPassed,
      verdict: geomTamperPassed ? 'PASS' : 'FAIL',
    });

    // --- CHECK 3: Tamper Resistance (Metadata / Claims) ---
    // Modify a claim in the certificate's results and check if Fingerprint mismatch occurs
    const tamperedClaims = activeCert.verificationResults.map(claim => {
      if (claim.claim === 'Geometry Integrity') {
        return { ...claim, status: 'FAILED' as any }; // Change status
      }
      return claim;
    });

    const tamperedCertMetadata: DesignCertificate = {
      ...activeCert,
      verificationResults: tamperedClaims,
    };

    const verifyReportTamperedClaims = DesignCertificateVerifier.verify(tamperedCertMetadata, defaultDesign);
    const claimTamperPassed = verifyReportTamperedClaims.tamperDetected === true && verifyReportTamperedClaims.evaluatedStatus === 'INVALID';

    checks.push({
      id: 'CHECK-166-TAMPER-METADATA',
      name: 'Tamper Resistance - Metadata Modification',
      description: 'Detects modifications to embedded verification claims via fingerprint mismatch.',
      passed: claimTamperPassed,
      verdict: claimTamperPassed ? 'PASS' : 'FAIL',
    });

    // --- CHECK 4: Revision Isolation ---
    const designIdentityB = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.DESIGN,
      projectId: 'PRJ-166-LANDING-GEAR',
      revisionId: 'REV-B',
      createdBy: 'ENG-OUBETAT',
      seed: 'SEED-LANDING-GEAR-166-B',
    }, {
      name: 'Nose Landing Gear Strut',
      designer: 'Oubetat',
      cadFile: 'nlg_strut_v13.step'
    });

    const designRevisionB = {
      ...defaultDesign,
      designId: designIdentityB.identityId,
      designRevision: 'REV-B', // Revision B
    };

    const verifyReportRevisionMismatch = DesignCertificateVerifier.verify(activeCert, designRevisionB);
    const revIsolationPassed = verifyReportRevisionMismatch.chainOfCustodyVerified === false && verifyReportRevisionMismatch.evaluatedStatus === 'INVALID';

    checks.push({
      id: 'CHECK-166-REVISION-ISOLATION',
      name: 'Revision Isolation Validation',
      description: 'Asserts that a certificate issued for Revision A cannot validate Revision B.',
      passed: revIsolationPassed,
      verdict: revIsolationPassed ? 'PASS' : 'FAIL',
    });

    // --- CHECK 5: Evidence Completeness & Conflicting Evidence ---
    const incompleteClaims: VerificationClaimItem[] = [
      {
        claim: 'Geometry Integrity',
        evidence: 'EVID-GEOM-001',
        verificationMethod: 'Independent Hash Recalculation',
        result: 'MATCH',
        status: 'VERIFIED',
      },
      {
        claim: 'Material Compliance',
        evidence: 'EVID-MAT-TI-6AL-4V-001',
        verificationMethod: 'Spectrometry analysis certificate match',
        result: 'UNPROVEN',
        status: 'UNPROVEN', // Unproven claim
      }
    ];

    const incompleteResult = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: incompleteClaims,
      policy: standardPolicy,
      issuer: 'SECP-CHIEF-METROLOGIST',
      evidenceReferences: ['EVID-GEOM-001'],
    });

    const incompletePassed = incompleteResult.status === 'UNDER_REVIEW' || incompleteResult.status === 'FAILED';

    checks.push({
      id: 'CHECK-166-EVIDENCE-COMPLETENESS',
      name: 'Evidence Completeness Verification',
      description: 'Rejects CERTIFIED status if critical evidence claims are unproven or missing.',
      passed: incompletePassed,
      verdict: incompletePassed ? 'PASS' : 'FAIL',
    });

    // --- CHECK 6: Reproducibility ---
    const certResultDuplicate = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'SECP-CHIEF-METROLOGIST',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-TI-6AL-4V-001', 'EVID-GCS-ALIGNMENT-001', 'EVID-SIM-STRESS-ANALYSIS-001', 'EVID-MFG-CNC-MILLING-001'],
    });

    const reproducibilityPassed = certResultDuplicate.certificate?.fingerprint === activeCert.fingerprint;

    checks.push({
      id: 'CHECK-166-REPRODUCIBILITY',
      name: 'Deterministic Certificate Reproducibility',
      description: 'Guarantees that re-generating a certificate with identical parameters yields identical fingerprints.',
      passed: reproducibilityPassed,
      verdict: reproducibilityPassed ? 'PASS' : 'FAIL',
    });

    // --- CHECK 7: Revocation ---
    const revocationEngine = DesignCertificateEngine.getInstance();
    const tempCertResult = revocationEngine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'SECP-CHIEF-METROLOGIST',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-TI-6AL-4V-001', 'EVID-GCS-ALIGNMENT-001', 'EVID-SIM-STRESS-ANALYSIS-001', 'EVID-MFG-CNC-MILLING-001'],
    });

    const tempCertId = tempCertResult.certificate!.certificateId;
    revocationEngine.revokeCertificate(tempCertId, 'Discovered minor cracking model issue', 'CHIEF-METROLOGIST');

    const revokedCert = revocationEngine.getCertificate(tempCertId);
    const revocationPassed = revokedCert !== undefined && revokedCert.status === 'REVOKED' && revokedCert.validationVerdict === 'INVALID';

    checks.push({
      id: 'CHECK-166-REVOCATION',
      name: 'Certificate Revocation Capability',
      description: 'Ensures that certificates can be revoked and immediately transition to REVOKED / INVALID state.',
      passed: revocationPassed,
      verdict: revocationPassed ? 'PASS' : 'FAIL',
    });

    // Evaluate overall verdict
    const passedChecks = checks.filter(c => c.passed).length;
    const totalChecks = checks.length;
    const verdict = passedChecks === totalChecks ? 'PASS' : 'FAIL';

    return {
      gateId: 'PATCH-166-DESIGN-CERTIFICATE-GATE',
      patch: 'PATCH-166',
      verdict,
      passedChecks,
      totalChecks,
      checks,
      summary: `Design Certificate hard acceptance assessment completed with verdict: ${verdict} (${passedChecks}/${totalChecks} check groups verified).`,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
