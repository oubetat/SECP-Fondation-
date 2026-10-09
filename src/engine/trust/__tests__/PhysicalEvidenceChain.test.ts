import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionTrustRegistry } from '../ProductionTrustRegistry';
import { TrustTestFixtures } from '../TrustTestFixtures';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { QualityGate } from '../../verification/QualityGate';
import { createSign, generateKeyPairSync } from 'crypto';

/**
 * SECP — POST-TRUTH-CHAIN-003
 * PHYSICAL PROVISIONING & FACTORY EVIDENCE CHAIN
 * 
 * Objective: Prove the end-to-end evidence chain from physical source to release authorization.
 * Validation Rule: SOFTWARE PROVISIONING CONTRACT = PROVEN, PHYSICAL DEVICE PROVISIONING = NOT PROVEN.
 */
describe('POST-TRUTH-CHAIN-003 — Physical Evidence Chain & Adversarial Matrix', () => {
  let authorityKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let deviceKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let provisionedDriver: any;

  const CANONICAL_CAD_REVISION = 'REV_003_ALPHA';
  const CANONICAL_PART_ID = 'PART-WING-001';

  beforeEach(() => {
    ProductionTrustRegistry.resetForTestHarnessOnly();
    MetrologyEngine.clearRegistry();

    // 1. Set up Provisioning Authority
    authorityKeyPair = TrustTestFixtures.generateEcKeyPair();
    ProductionTrustRegistry.setAuthorityPublicKey(authorityKeyPair.publicKeyPem);

    // 2. Provision a Production Device
    deviceKeyPair = TrustTestFixtures.generateEcKeyPair();
    provisionedDriver = TrustTestFixtures.createDriverRecord({
      driverId: 'PROD_CMM_003',
      publicKeyPem: deviceKeyPair.publicKeyPem,
      deviceSerial: 'CMM-ZEISS-PRISMO-999',
      instrumentId: 'INST-003'
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([provisionedDriver], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);
  });

  /**
   * HELPERS FOR ADVERSARIAL CONSTRUCTION
   */
  const createValidEnvelope = (params: any = {}) => {
    const envelope: any = {
      acquisitionId: 'ACQ-001',
      sessionId: 'SESS-001',
      driverId: provisionedDriver.driverId,
      instrumentId: provisionedDriver.deviceBinding.instrumentId,
      calibrationId: 'CAL-REF-001',
      acquiredAt: new Date().toISOString(),
      nonce: Math.floor(Math.random() * 1000000),
      points: [
        { pointId: 'pt-live-PLAN-003-FEAT-01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      ...params
    };

    const payload = [
      envelope.acquisitionId, envelope.sessionId, envelope.driverId, envelope.instrumentId,
      envelope.calibrationId, envelope.acquiredAt, envelope.nonce,
      envelope.points.map((p: any) => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    envelope.signature = signer.sign(params.privateKey || deviceKeyPair.privateKeyPem, 'hex');
    
    return envelope;
  };

  const setupLiveSession = (envelope: any, connectionParams: any = {}) => {
    const instrument = MetrologyEngine.createInstrument(
      envelope.instrumentId, 
      'Authoritative CMM', 
      'ZEISS_CMM_PROBE'
    );
    
    // Ensure calibration matches envelope
    (instrument.calibration as any).calibrationId = envelope.calibrationId;

    const plan = {
      planId: 'PLAN-003',
      partRevision: 'A',
      specifications: [
        { featureId: 'FEAT-01', characteristicType: 'FLATNESS', nominalMm: 0, toleranceUpperMm: 0.01, toleranceLowerMm: -0.01 }
      ],
      pointsPerFeature: { 'FEAT-01': 1 }
    };

    const connection = {
      driverId: envelope.driverId,
      connectionStatus: 'CONNECTED' as any,
      ...connectionParams
    };

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    return MetrologyEngine.runSession(
      envelope.sessionId,
      plan as any,
      'SN-FACTORY-001',
      instrument,
      'OPERATOR_01',
      'LIVE',
      0.001,
      connection as any
    );
  };

  const CANONICAL_PLAN = {
    planId: 'PLAN-003',
    partRevision: 'A',
    specifications: [
      { featureId: 'FEAT-01', characteristicType: 'FLATNESS', nominalMm: 0, toleranceUpperMm: 0.01, toleranceLowerMm: -0.01 }
    ],
    pointsPerFeature: { 'FEAT-01': 1 }
  };

  /**
   * ATTACK MATRIX
   */

  it('A01: Wrong Serial Number in connection must be BLOCKED', () => {
    const envelope = createValidEnvelope();
    const rogueConnection = { driverId: 'ROGUE_ID' }; // Mismatch with envelope.driverId
    const session = setupLiveSession(envelope, rogueConnection);

    expect(() => MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', rogueConnection.driverId))
      .toThrow(/PROVENANCE_BREACH/);
  });

  it('A02: Unsigned Telemetry Envelope must be BLOCKED', () => {
    const envelope = createValidEnvelope();
    envelope.signature = ''; // Strip signature
    const session = setupLiveSession(envelope);

    expect(() => MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', envelope.driverId))
      .toThrow(/PROVENANCE_BREACH/);
  });

  it('A03: Modified Telemetry after signing must be BLOCKED', () => {
    const envelope = createValidEnvelope();
    envelope.points[0].measuredCoordinates.x += 0.5; // Tamper
    const session = setupLiveSession(envelope);

    expect(() => MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', envelope.driverId))
      .toThrow(/PROVENANCE_BREACH/);
  });

  it('A04: Modified Measurement Hash in certificate must be BLOCKED by QualityGate', () => {
    const envelope = createValidEnvelope();
    const session = setupLiveSession(envelope);
    
    const cert = MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001');
    const tamperedCert = { ...cert, rawMeasurementHash: 'TAMPERED_HASH' };

    expect(() => QualityGate.authorizeRelease(CANONICAL_PART_ID, CANONICAL_CAD_REVISION, tamperedCert))
      .toThrow(/RELEASE_DENIED: CERTIFICATE_INTEGRITY_TAMPERED/);
  });

  it('A05: Wrong CAD Revision Hash in certificate must be BLOCKED', () => {
    const envelope = createValidEnvelope();
    const session = setupLiveSession(envelope);
    
    const cert = MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, 'WRONG_HASH', 'JOB-001');
    
    expect(() => QualityGate.authorizeRelease(CANONICAL_PART_ID, CANONICAL_CAD_REVISION, cert))
      .toThrow(/RELEASE_DENIED/);
  });

  it('A06: TEST trust authority masquerading as PRODUCTION must be BLOCKED', () => {
    // Register a TEST driver
    const testKey = TrustTestFixtures.generateEcKeyPair();
    MetrologyEngine.registerTrustedDriver('DRIVER_TEST', testKey.publicKeyPem, 'TEST');

    const envelope = createValidEnvelope({ driverId: 'DRIVER_TEST', privateKey: testKey.privateKeyPem });
    const session = setupLiveSession(envelope);

    expect(() => MetrologyEngine.issueQualityCertificate(session, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', envelope.driverId))
      .toThrow(/PROVENANCE_BREACH/);
  });

  it('A07: Replayed acquisitionId must be BLOCKED', () => {
    const envelope = createValidEnvelope({ acquisitionId: 'REPLAY-001' });
    const session1 = setupLiveSession(envelope);
    MetrologyEngine.issueQualityCertificate(session1, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', envelope.driverId);

    // Attempt second use of same acquisitionId
    const envelope2 = createValidEnvelope({ acquisitionId: 'REPLAY-001', sessionId: 'SESS-002' });
    const session2 = setupLiveSession(envelope2);
    expect(() => MetrologyEngine.issueQualityCertificate(session2, CANONICAL_PLAN as any, CANONICAL_CAD_REVISION, 'JOB-001', envelope2.driverId))
      .toThrow(/REPLAY_ATTACK/);
  });

  /**
   * POSITIVE PROOF (THE HAPPY PATH)
   */

  it('P01: GENUINE PROVISIONED DEVICE + MATCHING CAD + AUTHORITATIVE CERTIFICATE -> PASS', () => {
    // 1. Source: Genuine Provisioned Device
    const envelope = createValidEnvelope();

    // 2. Processing: Authoritative Metrology Store
    const session = setupLiveSession(envelope);
    const plan = {
      planId: 'PLAN-003',
      partRevision: 'A',
      specifications: [
        { featureId: 'FEAT-01', characteristicType: 'FLATNESS', nominalMm: 0, toleranceUpperMm: 0.01, toleranceLowerMm: -0.01 }
      ],
      pointsPerFeature: { 'FEAT-01': 1 }
    };
    const cert = MetrologyEngine.issueQualityCertificate(session, plan as any, CANONICAL_CAD_REVISION, 'JOB-001');

    // 3. Authorization: Matching CAD Revision
    const authorized = QualityGate.authorizeRelease(CANONICAL_PART_ID, CANONICAL_CAD_REVISION, cert);

    expect(authorized).toBe(true);
    expect(cert.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');
    expect(cert.provenanceHash).toContain('SECP-PROD-');
  });
});
