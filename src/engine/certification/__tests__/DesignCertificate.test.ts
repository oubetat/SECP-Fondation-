/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-166: Design Certificate Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType, IdentityClassification } from '../../identity/CanonicalEngineeringIdentity';
import { DesignCertificateEngine, DesignCertificateVerifier } from '../DesignCertificateEngine';
import { DesignCertificatePolicy, VerificationClaimItem, DesignCertificate } from '../designTypes';

describe('PATCH-166: Design Certificate Standard & Adversarial Test Suite', () => {
  let designIdentity: any;
  let defaultDesign: any;
  let standardPolicy: DesignCertificatePolicy;
  let validClaims: VerificationClaimItem[];

  beforeEach(() => {
    DesignCertificateEngine.getInstance().resetRegistry();

    designIdentity = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.DESIGN,
      projectId: 'PRJ-166-TEST',
      revisionId: 'REV-A',
      createdBy: 'ENG-OUBETAT',
      seed: 'SEED-TEST-CAD',
      classification: IdentityClassification.INTERNAL,
    }, {
      name: 'Nose Cone Assembly',
      version: '1.0.0',
    });

    defaultDesign = {
      designId: designIdentity.identityId,
      designRevision: 'REV-A',
      geometryHash: 'HASH-GEOM-TEST-A',
      materialReferences: ['EVID-MAT-ALUM'],
      assemblyReferences: ['EVID-ASY-NOSE'],
      constraintReferences: ['EVID-GCS-NOSE'],
      simulationReferences: ['EVID-SIM-NOSE'],
      manufacturingReferences: ['EVID-MFG-NOSE'],
      provenanceRoot: 'HASH-PROV-ROOT-TEST-A',
    };

    standardPolicy = {
      policyId: 'POL-DSN-TEST',
      policyVersion: '1.0.0',
      requiredClaims: [
        'Geometry Integrity',
        'Material Compliance',
        'Constraint Verification',
        'Simulation Verification',
        'Manufacturing Compatibility',
      ],
      requireCanonicalHash: true,
      requireProvenanceRoot: true,
      requireNoConflictingEvidence: true,
      requireAttestations: true,
    };

    validClaims = [
      {
        claim: 'Geometry Integrity',
        evidence: 'EVID-GEOM-001',
        verificationMethod: 'Independent Hash Recalculation',
        result: 'MATCH',
        status: 'VERIFIED',
      },
      {
        claim: 'Material Compliance',
        evidence: 'EVID-MAT-ALUM',
        verificationMethod: 'Spectrometry Match',
        result: 'MATCH',
        status: 'VERIFIED',
      },
      {
        claim: 'Constraint Verification',
        evidence: 'EVID-GCS-NOSE',
        verificationMethod: 'Solver Verification',
        result: 'SOLVED',
        status: 'PROVEN',
      },
      {
        claim: 'Simulation Verification',
        evidence: 'EVID-SIM-NOSE',
        verificationMethod: 'Certification Check',
        result: 'VERIFIED',
        status: 'VERIFIED',
      },
      {
        claim: 'Manufacturing Compatibility',
        evidence: 'EVID-MFG-NOSE',
        verificationMethod: 'CNC collision verify',
        result: 'NO_COLLISIONS',
        status: 'VERIFIED',
      },
    ];
  });

  // --- 1. Certificate Generation ---
  it('should successfully generate a design certificate when all conditions are satisfied', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    expect(result.status).toBe('CERTIFIED');
    expect(result.certificate).toBeDefined();
    expect(result.errors).toHaveLength(0);

    const cert = result.certificate!;
    expect(cert.designId).toBe(defaultDesign.designId);
    expect(cert.designRevision).toBe(defaultDesign.designRevision);
    expect(cert.geometryHash).toBe(defaultDesign.geometryHash);
    expect(cert.provenanceRoot).toBe(defaultDesign.provenanceRoot);
    expect(cert.validationVerdict).toBe('PROVEN');
    expect(cert.fingerprint).toBeDefined();
  });

  // --- 2. Certificate Verification ---
  it('should verify a valid design certificate successfully with independent verifier', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const cert = result.certificate!;
    const report = DesignCertificateVerifier.verify(cert, defaultDesign);

    expect(report.fingerprintMatch).toBe(true);
    expect(report.tamperDetected).toBe(false);
    expect(report.hashValidationMatched).toBe(true);
    expect(report.chainOfCustodyVerified).toBe(true);
    expect(report.evaluatedStatus).toBe('CERTIFIED');
  });

  // --- 3. Tamper Resistance (Adversarial) ---
  it('should detect geometry hash tampering and invalidate verification report', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const cert = result.certificate!;
    
    // Modify geometry hash in the design model
    const tamperedDesign = {
      ...defaultDesign,
      geometryHash: 'TAMPERED-HASH-VALUE',
    };

    const report = DesignCertificateVerifier.verify(cert, tamperedDesign);
    expect(report.tamperDetected).toBe(true);
    expect(report.fingerprintMatch).toBe(false);
    expect(report.evaluatedStatus).toBe('INVALID');
    expect(report.details.join(' ')).toContain('Geometry Mismatch');
  });

  it('should detect certificate metadata alteration and trigger fingerprint mismatch', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const cert = result.certificate!;
    
    // Alter a claim status inside certificate metadata
    const tamperedClaims = cert.verificationResults.map(claim => {
      if (claim.claim === 'Material Compliance') {
        return { ...claim, status: 'FAILED' as any };
      }
      return claim;
    });

    const tamperedCert: DesignCertificate = {
      ...cert,
      verificationResults: tamperedClaims,
    };

    const report = DesignCertificateVerifier.verify(tamperedCert, defaultDesign);
    expect(report.tamperDetected).toBe(true);
    expect(report.fingerprintMatch).toBe(false);
    expect(report.evaluatedStatus).toBe('INVALID');
    expect(report.details.join(' ')).toContain('Fingerprint Mismatch');
  });

  // --- 4. Revision Isolation ---
  it('should preserve revision isolation and fail validation if revision is mixed up', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const cert = result.certificate!;

    // Attempt to verify certificate issued for Revision A against Revision B
    const actualDesignB = {
      ...defaultDesign,
      designRevision: 'REV-B',
    };

    const report = DesignCertificateVerifier.verify(cert, actualDesignB);
    expect(report.chainOfCustodyVerified).toBe(false);
    expect(report.evaluatedStatus).toBe('INVALID');
    expect(report.details.join(' ')).toContain('Design Revision Mismatch');
  });

  // --- 5. Evidence Completeness & Incomplete Certificates ---
  it('should refuse CERTIFIED status and downgrade to UNDER_REVIEW / FAILED if evidence is incomplete', () => {
    const engine = DesignCertificateEngine.getInstance();
    
    // Omit Simulation claim from verification results
    const incompleteClaims = validClaims.filter(c => c.claim !== 'Simulation Verification');

    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: incompleteClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-MFG-NOSE'],
    });

    expect(result.status).not.toBe('CERTIFIED');
    expect(result.certificate).toBeDefined();
    expect(result.certificate!.status).not.toBe('CERTIFIED');
  });

  // --- 6. Reproducibility ---
  it('should compute identical, deterministic certificate fingerprints for identical design records', () => {
    const engine = DesignCertificateEngine.getInstance();
    
    const result1 = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const result2 = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    expect(result1.certificate!.fingerprint).toBe(result2.certificate!.fingerprint);
  });

  // --- 7. Revocation ---
  it('should immediately revoke certificate and prevent returning to CERTIFIED automatically', () => {
    const engine = DesignCertificateEngine.getInstance();
    const result = engine.createCertificate({
      design: defaultDesign,
      engineeringIdentity: designIdentity,
      verificationResults: validClaims,
      policy: standardPolicy,
      issuer: 'ENG-OUBETAT-CHIEF',
      evidenceReferences: ['EVID-GEOM-001', 'EVID-MAT-ALUM', 'EVID-GCS-NOSE', 'EVID-SIM-NOSE', 'EVID-MFG-NOSE'],
    });

    const certId = result.certificate!.certificateId;
    engine.revokeCertificate(certId, 'Engineering flaw detected in material certification', 'ENG-OUBETAT-CHIEF');

    const revokedCert = engine.getCertificate(certId)!;
    expect(revokedCert.status).toBe('REVOKED');
    expect(revokedCert.validationVerdict).toBe('INVALID');

    // Verification must flag it as revoked/invalid
    const report = DesignCertificateVerifier.verify(revokedCert, defaultDesign);
    expect(report.evaluatedStatus).toBe('REVOKED');
    expect(report.evidenceCompletenessVerdict).toBe('INVALID');
  });
});
