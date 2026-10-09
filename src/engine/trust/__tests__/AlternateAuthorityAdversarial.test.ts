import { describe, it, expect } from 'vitest';
import { QualityGate } from '../../verification/QualityGate';
import { QualityVerificationCertificate } from '../../quality-metrology/MetrologyTypes';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';

describe('SECP Alternate Authority & Certificate Substitution Adversarial Suite', () => {
  const canonicalRevisionHash = 'A1B2C3D4_CANONICAL_REV_HASH';
  const canonicalPartId = 'ART-DOC-TURBINE-001';

  it('1. should reject Simulation Certificate substitution at QualityGate', () => {
    const fakeCert: any = {
      certificateId: 'CERT-SIM-001',
      cadRevisionHash: canonicalRevisionHash,
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_1_SYNTHETIC', // Simulation grade, not Level 3
      provenanceHash: 'SECP-SIM-HASH-1234'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('2. should reject Manufacturing Certificate substitution at QualityGate', () => {
    const fakeCert: any = {
      certificateId: 'CERT-MFG-001',
      cadRevisionHash: canonicalRevisionHash,
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_2_PROCESS_TELEMETRY',
      provenanceHash: 'SECP-MFG-HASH-1234'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('3. should reject Design Certificate substitution at QualityGate', () => {
    const fakeCert: any = {
      certificateId: 'CERT-DESIGN-001',
      cadRevisionHash: canonicalRevisionHash,
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_1_DESIGN_SPEC',
      provenanceHash: 'SECP-DESIGN-HASH-1234'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('4. should reject Result Certificate substitution at QualityGate', () => {
    const fakeCert: any = {
      certificateId: 'CERT-RESULT-001',
      cadRevisionHash: canonicalRevisionHash,
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_1_SYNTHETIC',
      provenanceHash: 'SECP-RESULT-HASH-1234'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('5. should reject Engineering Certificate substitution at QualityGate', () => {
    const fakeCert: any = {
      certificateId: 'CERT-ENG-001',
      cadRevisionHash: canonicalRevisionHash,
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_1_ENGINEERING_DOC',
      provenanceHash: 'SECP-ENG-HASH-1234'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('6. should reject Fake SECP Production Manifest if not registered in MetrologyEngine store', () => {
    const fakeCert: QualityVerificationCertificate = {
      certificateId: 'CERT-FAKE-PROD-001',
      sessionId: 'SESS-FAKE-01',
      planId: 'PLAN-01',
      partSerialNumber: 'SN-999',
      instrumentId: 'INST-01',
      cadRevisionHash: canonicalRevisionHash,
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      authoritySignature: 'SIG-FAKE',
      provenanceHash: 'SECP-PROD-UNREGISTERED-MANIFEST-999',
      rawMeasurementHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/CERTIFICATE_NOT_FOUND/);
  });

  it('7. should reject Fake QualityVerificationCertificate with empty/null raw telemetry', () => {
    const fakeCert: QualityVerificationCertificate = {
      certificateId: 'CERT-EMPTY-001',
      measurementSessionId: 'SESS-EMPTY-01',
      partInstanceSerialNumber: 'SN-999',
      partRevision: 'REV-A',
      instrumentId: 'INST-01',
      cadRevisionHash: canonicalRevisionHash,
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      evaluationTimestamp: new Date().toISOString(),
      authoritySignature: 'SIG-FAKE',
      provenanceHash: 'SECP-PROD-EMPTY-TELEMETRY',
      rawMeasurementHash: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855' // Empty hash
    };

    // Register in MetrologyEngine to test telemetry check
    (MetrologyEngine as any).certificates.set('SECP-PROD-EMPTY-TELEMETRY', fakeCert);

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, fakeCert);
    }).toThrow(/Certificate lacks authenticated telemetry/);

    (MetrologyEngine as any).certificates.delete('SECP-PROD-EMPTY-TELEMETRY');
  });

  it('8. should reject valid certificate presented with wrong canonical revision', () => {
    const validCert: QualityVerificationCertificate = {
      certificateId: 'CERT-VALID-001',
      measurementSessionId: 'SESS-VALID-01',
      partInstanceSerialNumber: 'SN-999',
      partRevision: 'REV-A',
      instrumentId: 'INST-01',
      cadRevisionHash: 'REV-REVISION-A',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      evaluationTimestamp: new Date().toISOString(),
      authoritySignature: 'SIG-VALID',
      provenanceHash: 'SECP-PROD-VALID-001',
      rawMeasurementHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    };

    (MetrologyEngine as any).certificates.set('SECP-PROD-VALID-001', validCert);

    // Presented with WRONG revision
    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, 'REV-REVISION-B-WRONG', validCert);
    }).toThrow(/RELEASE_DENIED: Certificate binds to revision/);

    (MetrologyEngine as any).certificates.delete('SECP-PROD-VALID-001');
  });

  it('9. should reject valid certificate if fields in caller object are tampered vs database', () => {
    const dbCert: QualityVerificationCertificate = {
      certificateId: 'CERT-DB-001',
      measurementSessionId: 'SESS-01',
      partInstanceSerialNumber: 'SN-999',
      partRevision: 'REV-A',
      instrumentId: 'INST-01',
      cadRevisionHash: canonicalRevisionHash,
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      evaluationTimestamp: new Date().toISOString(),
      authoritySignature: 'SIG-DB',
      provenanceHash: 'SECP-PROD-DB-001',
      rawMeasurementHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    };

    (MetrologyEngine as any).certificates.set('SECP-PROD-DB-001', dbCert);

    // Tampered caller copy
    const tamperedCallerCert: QualityVerificationCertificate = {
      ...dbCert,
      rawMeasurementHash: 'TAMPERED_HASH_999999999999999999999999999999999999999999999999'
    };

    expect(() => {
      QualityGate.authorizeRelease(canonicalPartId, canonicalRevisionHash, tamperedCallerCert);
    }).toThrow(/CERTIFICATE_INTEGRITY_TAMPERED/);

    (MetrologyEngine as any).certificates.delete('SECP-PROD-DB-001');
  });
});
