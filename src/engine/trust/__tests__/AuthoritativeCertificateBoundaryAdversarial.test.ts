import { describe, it, expect, beforeEach } from 'vitest';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { QualityGate } from '../../verification/QualityGate';
import { ProductionTrustRegistry } from '../ProductionTrustRegistry';
import { QualityVerificationCertificate, AuthenticatedAcquisitionEnvelope } from '../../quality-metrology/MetrologyTypes';
import { TrustTestFixtures } from '../TrustTestFixtures';
import { createSign } from 'crypto';

describe('P0 Trust Remediation: Authoritative Certificate Choke-Point Adversarial Suite (A01-A10)', () => {
  const CAD_REVISION = 'A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2';
  const PART_ID = 'PART-AERO-001';
  
  beforeEach(() => {
    MetrologyEngine.clearAuthoritativeState();
  });

  it('A01 — fabricated production certificate rejected', () => {
    const fabricatedCert: QualityVerificationCertificate = {
      certificateId: 'cert-fabricated-001',
      measurementSessionId: 'session-fake-001',
      partInstanceSerialNumber: 'SN-9999',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-001',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'A1B2C3D4E5F6',
      evaluationHash: 'F6E5D4C3B2A1',
      provenanceHash: 'SECP-PROD-FABRICATED000000000000000000000000000000000000000000000000',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
    };

    expect(() => {
      MetrologyEngine.registerMockCertificate(fabricatedCert);
    }).toThrow(/PROVENANCE_BREACH/);

    expect(MetrologyEngine.getProductionCertificate(fabricatedCert.provenanceHash)).toBeUndefined();
    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, fabricatedCert);
    }).toThrow(/RELEASE_DENIED/);
  });

  it('A02 — mock certificate cannot enter authoritative production store', () => {
    const mockCert: QualityVerificationCertificate = {
      certificateId: 'cert-mock-002',
      measurementSessionId: 'session-mock-002',
      partInstanceSerialNumber: 'SN-MOCK-002',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-MOCK-002',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'MOCK_RAW_HASH',
      evaluationHash: 'MOCK_EVAL_HASH',
      provenanceHash: 'SECP-TEST-MOCK00000000000000000000000000000000000000000000000000000000',
      evidenceGrade: 'LEVEL_1_SYNTHETIC_SIMULATION'
    };

    MetrologyEngine.registerMockCertificate(mockCert);
    expect(MetrologyEngine.getCertificate(mockCert.provenanceHash)).toBeDefined();
    expect(MetrologyEngine.getProductionCertificate(mockCert.provenanceHash)).toBeUndefined();
  });

  it('A03 — fake SECP-PROD-* provenance rejected', () => {
    const fakeProdCert: QualityVerificationCertificate = {
      certificateId: 'cert-fake-prod-003',
      measurementSessionId: 'session-fake-prod-003',
      partInstanceSerialNumber: 'SN-FAKE-003',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-003',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_HASH_003',
      evaluationHash: 'EVAL_HASH_003',
      provenanceHash: 'SECP-PROD-ATTACKER_INJECTED_HASH_0000000000000000000000000000000000',
      evidenceGrade: 'LEVEL_1_SYNTHETIC_SIMULATION'
    };

    expect(() => {
      MetrologyEngine.registerMockCertificate(fakeProdCert);
    }).toThrow(/PROVENANCE_BREACH/);
  });

  it('A04 — fake LEVEL_3_PHYSICAL_TELEMETRY rejected', () => {
    const fakeGradeCert: QualityVerificationCertificate = {
      certificateId: 'cert-fake-grade-004',
      measurementSessionId: 'session-004',
      partInstanceSerialNumber: 'SN-004',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-004',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_004',
      evaluationHash: 'EVAL_004',
      provenanceHash: 'SECP-TEST-004',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
    };

    expect(() => {
      MetrologyEngine.registerMockCertificate(fakeGradeCert);
    }).toThrow(/PROVENANCE_BREACH/);
  });

  it('A05 — fake ACCEPTED disposition rejected', () => {
    const rejectedCert: QualityVerificationCertificate = {
      certificateId: 'cert-rejected-005',
      measurementSessionId: 'session-005',
      partInstanceSerialNumber: 'SN-005',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-005',
      overallStatus: 'FAIL',
      disposition: 'REJECTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_005',
      evaluationHash: 'EVAL_005',
      provenanceHash: 'SECP-TEST-005',
      evidenceGrade: 'LEVEL_1_SYNTHETIC_SIMULATION'
    };

    MetrologyEngine.registerMockCertificate(rejectedCert);
    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, rejectedCert);
    }).toThrow(/RELEASE_DENIED: Quality disposition is REJECTED/);
  });

  it('A06 — caller-supplied certificate authority rejected', () => {
    const forgedAuthorityCert: QualityVerificationCertificate = {
      certificateId: 'cert-forged-auth-006',
      measurementSessionId: 'session-006',
      partInstanceSerialNumber: 'SN-006',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-006',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_006',
      evaluationHash: 'EVAL_006',
      provenanceHash: 'SECP-PROD-CALLER_SUPPLIED_AUTHORITY_000000000000000000000000000000',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
    };

    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, forgedAuthorityCert);
    }).toThrow(/RELEASE_DENIED: CERTIFICATE_NOT_FOUND/);
  });

  it('A07 — mock certificate cannot reach QualityGate release', () => {
    const validMock: QualityVerificationCertificate = {
      certificateId: 'cert-mock-007',
      measurementSessionId: 'session-007',
      partInstanceSerialNumber: 'SN-007',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-007',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_007',
      evaluationHash: 'EVAL_007',
      provenanceHash: 'SECP-TEST-007_GENUINE_TEST_PROVENANCE_00000000000000000000000000',
      evidenceGrade: 'LEVEL_1_SYNTHETIC_SIMULATION'
    };

    MetrologyEngine.registerMockCertificate(validMock);
    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, validMock);
    }).toThrow(/RELEASE_DENIED: Physical release requires LEVEL_3_PHYSICAL_TELEMETRY/);
  });

  it('A08 — TEST certificate cannot escalate to production', () => {
    const testCert: QualityVerificationCertificate = {
      certificateId: 'cert-test-008',
      measurementSessionId: 'session-008',
      partInstanceSerialNumber: 'SN-008',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-008',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_008',
      evaluationHash: 'EVAL_008',
      provenanceHash: 'SECP-TEST-ESCALATION_ATTEMPT_0000000000000000000000000000000000',
      evidenceGrade: 'LEVEL_1_SYNTHETIC_SIMULATION'
    };

    MetrologyEngine.registerMockCertificate(testCert);
    
    // Attempt escalation by changing evidenceGrade on caller object
    const escalatedCert = { ...testCert, evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY' as const };
    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, escalatedCert);
    }).toThrow(/RELEASE_DENIED: Physical release requires an authentic production certificate/);
  });

  it('A09 — simulation certificate cannot escalate to production', () => {
    const simCert: QualityVerificationCertificate = {
      certificateId: 'cert-sim-009',
      measurementSessionId: 'session-009',
      partInstanceSerialNumber: 'SN-009',
      partRevision: 'REV_A',
      cadRevisionHash: CAD_REVISION,
      jobId: 'JOB-009',
      overallStatus: 'PASS',
      disposition: 'ACCEPTED',
      evaluationTimestamp: new Date().toISOString(),
      rawMeasurementHash: 'RAW_009',
      evaluationHash: 'EVAL_009',
      provenanceHash: 'SECP-TEST-SIMULATION_0000000000000000000000000000000000000000000000',
      evidenceGrade: 'LEVEL_2_SIMULATED_PHYSICAL'
    };

    MetrologyEngine.registerMockCertificate(simCert);
    expect(() => {
      QualityGate.authorizeRelease(PART_ID, CAD_REVISION, simCert);
    }).toThrow(/RELEASE_DENIED: Physical release requires LEVEL_3_PHYSICAL_TELEMETRY/);
  });

  it('A10 — legitimate production certificate still reaches release', () => {
    const authorityKeyPair = TrustTestFixtures.generateEcKeyPair();
    ProductionTrustRegistry.setAuthorityPublicKey(authorityKeyPair.publicKeyPem);

    const deviceKeyPair = TrustTestFixtures.generateEcKeyPair();
    const driverId = 'DRV-LEGAL-010';
    const instId = 'INST-LEGAL-010';

    const provisionedDriver = TrustTestFixtures.createDriverRecord({
      driverId,
      publicKeyPem: deviceKeyPair.publicKeyPem,
      deviceSerial: 'SN-LEGAL-010',
      instrumentId: instId
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([provisionedDriver], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    MetrologyEngine.registerTrustedDriver(driverId, deviceKeyPair.publicKeyPem, 'PRODUCTION');

    const sessionId = 'SESSION-LEGAL-010';
    const calId = 'CAL-REF-010';
    const acquiredAt = new Date().toISOString();
    const nonce = 123456;
    const points = [
      { pointId: 'pt-live-PLAN-010-FEAT-010-1', measuredCoordinates: { x: 10, y: 15, z: 25 }, acquisitionTimestamp: acquiredAt, status: 'PASS' as const, confidenceLimitMm: 0.002 }
    ];

    const payload = [
      'ACQ-LEGAL-010',
      sessionId,
      driverId,
      instId,
      calId,
      acquiredAt,
      nonce,
      points.map(p => p.pointId + ':' + p.measuredCoordinates.x + ',' + p.measuredCoordinates.y + ',' + p.measuredCoordinates.z).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    const signature = signer.sign(deviceKeyPair.privateKeyPem, 'hex');

    const envelope: AuthenticatedAcquisitionEnvelope = {
      acquisitionId: 'ACQ-LEGAL-010',
      sessionId,
      driverId,
      instrumentId: instId,
      calibrationId: calId,
      acquiredAt,
      nonce,
      points,
      signature
    };

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const inst = MetrologyEngine.createInstrument(instId, 'PROBE_CONTACT_CMM', 'ZEISS_CMM_PROBE', 0.001);
    (inst.calibration as any).calibrationId = calId;

    const plan = {
      planId: 'PLAN-010',
      partRevision: 'REV_A',
      specifications: [
        { featureId: 'FEAT-010', characteristicType: 'FLATNESS', nominalMm: 0, toleranceUpperMm: 0.01, toleranceLowerMm: -0.01 }
      ],
      pointsPerFeature: { 'FEAT-010': 1 }
    };

    const connection = {
      connectionId: 'CONN-LEGAL-010',
      driverId,
      connectedAt: new Date().toISOString(),
      latencyMs: 5,
      channelIntegrityStatus: 'SECURE',
      connectionStatus: 'CONNECTED',
      protocol: 'SECURE_TCP_IP'
    };

    const session = MetrologyEngine.runSession(
      sessionId,
      plan as any,
      'SN-LEGAL-010',
      inst,
      'OPERATOR-1',
      'LIVE',
      0.001,
      connection as any
    );

    const cert = MetrologyEngine.issueQualityCertificate(
      session,
      plan as any,
      CAD_REVISION,
      'JOB-LEGAL-010',
      driverId
    );

    expect(cert.provenanceHash).toMatch(/^SECP-PROD-/);
    expect(cert.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');
    expect(cert.disposition).toBe('ACCEPTED');

    const releaseAuthorized = QualityGate.authorizeRelease(PART_ID, CAD_REVISION, cert);
    expect(releaseAuthorized).toBe(true);
  });
});
