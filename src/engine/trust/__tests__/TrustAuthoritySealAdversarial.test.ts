import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionTrustRegistry } from '../ProductionTrustRegistry';
import { TrustTestFixtures } from '../TrustTestFixtures';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { QualityGate } from '../../verification/QualityGate';
import { createSign } from 'crypto';

describe('POST-TRUTH-CHAIN-002I — Trust Authority Seal Adversarial Matrix (T01 - T26)', () => {
  let authorityKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let validDriverRecord: any;
  let validDriverKeyPair: { publicKeyPem: string; privateKeyPem: string };

  const liveConn = {
    driverId: 'DRIVER_PROD_001',
    type: 'LIVE' as any,
    connectionStatus: 'CONNECTED' as any,
    protocol: 'MTCONNECT' as any,
    ipAddress: '127.0.0.1',
    lastHeartbeat: '',
    vendorDriverVersion: ''
  };

  beforeEach(() => {
    ProductionTrustRegistry.resetForTestHarnessOnly();
    MetrologyEngine.clearRegistry();

    authorityKeyPair = TrustTestFixtures.generateEcKeyPair();
    ProductionTrustRegistry.setAuthorityPublicKey(authorityKeyPair.publicKeyPem);

    validDriverKeyPair = TrustTestFixtures.generateEcKeyPair();
    validDriverRecord = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_PROD_001',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      deviceSerial: 'ZEISS-PRISMO-SN-998811',
      instrumentId: 'INST_ZEISS_001'
    });
  });

  it('T01: Runtime attempt to register production driver dynamically must be BLOCKED', () => {
    expect(() => {
      ProductionTrustRegistry.registerTrustedDriver();
    }).toThrow(/PROVENANCE_BREACH: DYNAMIC_PRODUCTION_REGISTRATION_PROHIBITED/);
  });

  it('T02: Attempt to replace existing production driver key must be BLOCKED', () => {
    const manifest1 = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest1);

    const attackerDriverKeyPair = TrustTestFixtures.generateEcKeyPair();
    const attackerRecord = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_PROD_001',
      publicKeyPem: attackerDriverKeyPair.publicKeyPem,
      deviceSerial: 'ZEISS-PRISMO-SN-998811',
      instrumentId: 'INST_ZEISS_001'
    });
    const manifest2 = TrustTestFixtures.createSignedTestManifest([attackerRecord], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest2);
    }).toThrow(/PROVENANCE_BREACH: TRUST_REGISTRY_FROZEN_MUTATION_PROHIBITED/);
  });

  it('T03: Duplicate driver ID within manifest must be BLOCKED', () => {
    const driver1 = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_DUP_001',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      deviceSerial: 'SER-001'
    });
    const driver2 = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_DUP_001',
      publicKeyPem: TrustTestFixtures.generateEcKeyPair().publicKeyPem,
      deviceSerial: 'SER-002'
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([driver1, driver2], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DUPLICATE_DRIVER_ID/);
  });

  it('T04: Duplicate device serial with different key must be BLOCKED', () => {
    const driver1 = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_A',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      deviceSerial: 'SERIAL_COLLISION_001'
    });
    const driver2 = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_B',
      publicKeyPem: TrustTestFixtures.generateEcKeyPair().publicKeyPem,
      deviceSerial: 'SERIAL_COLLISION_001'
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([driver1, driver2], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DUPLICATE_DEVICE_SERIAL/);
  });

  it('T05: Attempt to clear production registry during runtime must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    expect(() => {
      ProductionTrustRegistry.clearRegistry();
    }).toThrow(/PROVENANCE_BREACH: RUNTIME_REGISTRY_CLEAR_PROHIBITED/);
  });

  it('T06: Test driver promoted to production must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const testDriverKey = TrustTestFixtures.generateEcKeyPair();
    MetrologyEngine.registerTrustedDriver('DRIVER_TEST_PROMO', testDriverKey.publicKeyPem, 'TEST');

    const instrument = MetrologyEngine.createInstrument('INST_TEST', 'Inst', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_PROMO',
      sessionId: 'SESS_PROMO',
      driverId: 'DRIVER_TEST_PROMO',
      instrumentId: 'INST_TEST',
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date(Date.now() - 5000).toISOString(),
      nonce: 42,
      points: [
        { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      signature: ''
    };

    const payload = [
      envelope.acquisitionId, envelope.sessionId, envelope.driverId, envelope.instrumentId,
      envelope.calibrationId, envelope.acquiredAt, envelope.nonce,
      envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    envelope.signature = signer.sign(testDriverKey.privateKeyPem, 'hex');

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const promoConn = { ...liveConn, driverId: 'DRIVER_TEST_PROMO' };
    const session = MetrologyEngine.runSession('SESS_PROMO', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, promoConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'DRIVER_TEST_PROMO');
    }).toThrow(/PROVENANCE_BREACH/);
  });

  it('T07: Simulation certificate presented as physical certificate must be BLOCKED by QualityGate', () => {
    const fakeCert = {
      certificateId: 'cert-sim-001',
      cadRevisionHash: 'REV_HASH_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'SECP-SIMULATION-12345',
      evidenceGrade: 'LEVEL_1_SYNTHETIC'
    } as any;

    expect(() => QualityGate.authorizeRelease('PART_01', 'REV_HASH_A', fakeCert))
      .toThrow(/RELEASE_DENIED/);
  });

  it('T08: Test-generated ECDSA key presented as production identity must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const rogueKey = TrustTestFixtures.generateEcKeyPair();
    const instrument = MetrologyEngine.createInstrument('INST_ROGUE', 'Inst Rogue', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_ROGUE',
      sessionId: 'SESS_ROGUE',
      driverId: 'UNPROVISIONED_DRIVER_ID',
      instrumentId: 'INST_ROGUE',
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date(Date.now() - 5000).toISOString(),
      nonce: 999,
      points: [
        { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      signature: ''
    };

    const payload = [
      envelope.acquisitionId, envelope.sessionId, envelope.driverId, envelope.instrumentId,
      envelope.calibrationId, envelope.acquiredAt, envelope.nonce,
      envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    envelope.signature = signer.sign(rogueKey.privateKeyPem, 'hex');

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const rogueConn = { ...liveConn, driverId: 'UNPROVISIONED_DRIVER_ID' };
    const session = MetrologyEngine.runSession('SESS_ROGUE', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, rogueConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'UNPROVISIONED_DRIVER_ID');
    }).toThrow(/PROVENANCE_BREACH: Untrusted driver/);
  });

  it('T09: Malformed manifest must be BLOCKED', () => {
    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(null as any);
    }).toThrow(/PROVENANCE_BREACH: MANIFEST_NULL_OR_UNDEFINED/);
  });

  it('T10: Manifest with invalid authority signature must be BLOCKED', () => {
    const forgedAuthorityKey = TrustTestFixtures.generateEcKeyPair();
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], forgedAuthorityKey);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: INVALID_AUTHORITY_SIGNATURE/);
  });

  it('T11: Manifest with environment = TEST loaded as PRODUCTION must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord],
      authorityKeyPair,
      { environment: 'TEST' }
    );

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: INVALID_TRUST_ENVIRONMENT/);
  });

  it('T12: Expired manifest must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord],
      authorityKeyPair,
      {
        issuedAt: new Date(Date.now() - 1000000).toISOString(),
        expiresAt: new Date(Date.now() - 500000).toISOString()
      }
    );

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: MANIFEST_EXPIRED/);
  });

  it('T13: Expired driver certificate within manifest must be BLOCKED', () => {
    const expiredDriver = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_EXPIRED',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      validFrom: new Date(Date.now() - 1000000).toISOString(),
      validUntil: new Date(Date.now() - 500000).toISOString()
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([expiredDriver], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DRIVER_CERTIFICATE_EXPIRED/);
  });

  it('T14: Driver identity/recordHash mismatch must be BLOCKED', () => {
    const tamperedDriver = {
      ...validDriverRecord,
      recordHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const manifest = TrustTestFixtures.createSignedTestManifest([tamperedDriver], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DRIVER_RECORD_HASH_MISMATCH/);
  });

  it('T15: Device serial/binding mismatch must be BLOCKED', () => {
    const mismatchDriver = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_MISMATCH',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      deviceSerial: 'SERIAL_A'
    });
    (mismatchDriver.deviceBinding as any).serialNumber = 'SERIAL_B';

    const manifest = TrustTestFixtures.createSignedTestManifest([mismatchDriver], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DEVICE_BINDING_SERIAL_MISMATCH/);
  });

  it('T16: Manifest tampering after signature must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    (manifest as any).authorityId = 'ROGUE_AUTHORITY';

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: UNRECOGNIZED_AUTHORITY_ID/);
  });

  it('T17: Runtime mutation after registry freeze must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    expect(ProductionTrustRegistry.isRegistryFrozen()).toBe(true);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: TRUST_REGISTRY_FROZEN_MUTATION_PROHIBITED/);
  });

  it('T18: Process restart without trusted bootstrap source leaves trust unprovisioned', () => {
    ProductionTrustRegistry.resetForTestHarnessOnly();
    expect(ProductionTrustRegistry.isRegistryFrozen()).toBe(false);
    expect(ProductionTrustRegistry.lookup('DRIVER_PROD_001')).toBeUndefined();

    const instrument = MetrologyEngine.createInstrument('INST_RESTART', 'Inst', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };
    const session = MetrologyEngine.runSession('SESS_UNPROV', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, liveConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01');
    }).toThrow(/PROVENANCE_BREACH|PROVENANCE_ERROR/);
  });

  it('T19: Attempt to invoke production registration through reflection/dynamic lookup fails', () => {
    const dynamicKey = 'registerTrustedDriver';
    expect(() => {
      (ProductionTrustRegistry as any)[dynamicKey]();
    }).toThrow(/PROVENANCE_BREACH: DYNAMIC_PRODUCTION_REGISTRATION_PROHIBITED/);
  });

  it('T20: Attempt to substitute AttestationSigner certificate for physical metrology certificate must be BLOCKED', () => {
    const forgedCert = {
      certificateId: 'ATTEST-001',
      cadRevisionHash: 'REV_HASH_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'SECP-ATTESTATION-SIGNER-999',
      evidenceGrade: 'LEVEL_1_SYNTHETIC'
    } as any;

    expect(() => QualityGate.authorizeRelease('PART_01', 'REV_HASH_A', forgedCert))
      .toThrow(/RELEASE_DENIED/);
  });

  it('T21: Attempt to bypass MetrologyEngine and call QualityGate directly with fabricated certificate must be BLOCKED', () => {
    const unverifiedCert = {
      certificateId: 'FABRICATED-001',
      cadRevisionHash: 'REV_HASH_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'SECP-PROD-FABRICATED',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      rawMeasurementHash: 'FAKE_HASH'
    } as any;

    expect(() => QualityGate.authorizeRelease('PART_01', 'REV_HASH_A', unverifiedCert))
      .toThrow(/RELEASE_DENIED: CERTIFICATE_NOT_FOUND/);

    expect(() => MetrologyEngine.registerMockCertificate(unverifiedCert))
      .toThrow(/PROVENANCE_BREACH: MOCK_CERTIFICATE_CANNOT_BE_PRODUCTION/);
  });

  it('T22: Valid TEST signature over a production-looking payload must be BLOCKED from physical production release', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const testDriverKey = TrustTestFixtures.generateEcKeyPair();
    MetrologyEngine.registerTrustedDriver('DRIVER_FAKE_TEST', testDriverKey.publicKeyPem, 'TEST');

    const instrument = MetrologyEngine.createInstrument('INST_TEST2', 'Inst', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_TEST_FAKE',
      sessionId: 'SESS_TEST_FAKE',
      driverId: 'DRIVER_FAKE_TEST',
      instrumentId: 'INST_TEST2',
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date(Date.now() - 5000).toISOString(),
      nonce: 88,
      points: [
        { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      signature: ''
    };

    const payload = [
      envelope.acquisitionId, envelope.sessionId, envelope.driverId, envelope.instrumentId,
      envelope.calibrationId, envelope.acquiredAt, envelope.nonce,
      envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    envelope.signature = signer.sign(testDriverKey.privateKeyPem, 'hex');

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const testConn = { ...liveConn, driverId: 'DRIVER_FAKE_TEST' };
    const session = MetrologyEngine.runSession('SESS_TEST_FAKE', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, testConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'DRIVER_FAKE_TEST');
    }).toThrow(/PROVENANCE_BREACH/);
  });

  it('T23: Duplicate public key across multiple drivers in production manifest must be BLOCKED', () => {
    const sharedKey = TrustTestFixtures.generateEcKeyPair();
    const driverA = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_KEY_COLLISION_A',
      publicKeyPem: sharedKey.publicKeyPem,
      deviceSerial: 'SER-KEY-A'
    });
    const driverB = TrustTestFixtures.createDriverRecord({
      driverId: 'DRIVER_KEY_COLLISION_B',
      publicKeyPem: sharedKey.publicKeyPem,
      deviceSerial: 'SER-KEY-B'
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([driverA, driverB], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DUPLICATE_PUBLIC_KEY/);
  });

  it('T24: Empty production registry blocks all physical certification', () => {
    const emptyManifest = TrustTestFixtures.createSignedTestManifest([], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(emptyManifest);

    expect(ProductionTrustRegistry.isRegistryFrozen()).toBe(true);

    const instrument = MetrologyEngine.createInstrument('INST_EMPTY', 'Inst', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };
    const session = MetrologyEngine.runSession('SESS_EMPTY', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, liveConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01');
    }).toThrow(/PROVENANCE_BREACH|PROVENANCE_ERROR/);
  });

  it('T25: Manifest with duplicate driver records must be BLOCKED', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord, validDriverRecord],
      authorityKeyPair
    );

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DUPLICATE_DRIVER_ID/);
  });

  it('T26: Manifest with duplicate device serials must be BLOCKED', () => {
    const driver1 = TrustTestFixtures.createDriverRecord({
      driverId: 'D1',
      publicKeyPem: TrustTestFixtures.generateEcKeyPair().publicKeyPem,
      deviceSerial: 'SERIAL_SHARED'
    });
    const driver2 = TrustTestFixtures.createDriverRecord({
      driverId: 'D2',
      publicKeyPem: TrustTestFixtures.generateEcKeyPair().publicKeyPem,
      deviceSerial: 'SERIAL_SHARED'
    });

    const manifest = TrustTestFixtures.createSignedTestManifest([driver1, driver2], authorityKeyPair);

    expect(() => {
      ProductionTrustRegistry.loadProvisionedTrust(manifest);
    }).toThrow(/PROVENANCE_BREACH: DUPLICATE_DEVICE_SERIAL/);
  });

  it('T27: Direct coordinate tampering in the physical acquisition envelope must trigger PROVENANCE_BREACH', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const instrument = MetrologyEngine.createInstrument('INST_ZEISS_001', 'Zeiss', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_TAMPER_COORDS',
      sessionId: 'SESS_TAMPER',
      driverId: 'DRIVER_PROD_001',
      instrumentId: 'INST_ZEISS_001',
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date(Date.now() - 5000).toISOString(),
      nonce: 10,
      points: [
        { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      signature: ''
    };

    const payload = [
      envelope.acquisitionId, envelope.sessionId, envelope.driverId, envelope.instrumentId,
      envelope.calibrationId, envelope.acquiredAt, envelope.nonce,
      envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const signer = createSign('SHA256');
    signer.update(payload);
    envelope.signature = signer.sign(validDriverKeyPair.privateKeyPem, 'hex');

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    // Now, let's alter the session coordinates to simulate local coordinate poisoning/tampering after envelope submission!
    const session = MetrologyEngine.runSession('SESS_TAMPER', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, liveConn);
    
    // Simulate direct coordinate modification in the session compared to what was signed in the envelope
    session.measuredFeatures[0].points[0].measuredCoordinates = { x: 999.999, y: 15, z: 25 }; // Tampered by re-assigning new object to break reference sharing!

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'DRIVER_PROD_001');
    }).toThrow(/PROVENANCE_BREACH: Coordinates tampered for point/);
  });

  it('T28: Metrology acquisition envelope with invalid driver signature must trigger PROVENANCE_BREACH', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const instrument = MetrologyEngine.createInstrument('INST_ZEISS_001', 'Zeiss', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_BAD_SIG',
      sessionId: 'SESS_BAD_SIG',
      driverId: 'DRIVER_PROD_001',
      instrumentId: 'INST_ZEISS_001',
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date(Date.now() - 5000).toISOString(),
      nonce: 10,
      points: [
        { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10, y: 15, z: 25 } },
        { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10, y: 15, z: 25 } }
      ],
      signature: 'BAD_SIGNATURE_HEX' // INVALID SIGNATURE!
    };

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const session = MetrologyEngine.runSession('SESS_BAD_SIG', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, liveConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'DRIVER_PROD_001');
    }).toThrow(/PROVENANCE_BREACH: Asymmetric signature verification failed/);
  });

  it('T29: QualityGate rejects release if CAD revision hash mismatches (M17)', () => {
    const cert = {
      certificateId: 'CERT_M17',
      partInstanceSerialNumber: 'SN_M17',
      cadRevisionHash: 'HASH_A', // Certificate binds to HASH_A
      partRevision: 'REV_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'SECP-PROD-M17',
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      rawMeasurementHash: 'SOME_NON_EMPTY_TELEMETRY_HASH',
      timestamp: new Date().toISOString(),
      signature: 'VALID_SIG'
    };

    // Register this certificate in MetrologyEngine to bypass the database check
    MetrologyEngine.registerTestCertificateForAdversarialTest(cert as any);

    // QualityGate must throw an error when trying to authorize release for HASH_B
    expect(() => {
      QualityGate.authorizeRelease('PART_01', 'HASH_B', cert as any); // Mismatch revision hash HASH_B
    }).toThrow(/RELEASE_DENIED: Certificate binds to revision/);
  });

  it('T30: QualityGate rejects release if provenance hash does not start with SECP (M19)', () => {
    const cert = {
      certificateId: 'CERT_M19',
      partInstanceSerialNumber: 'SN_M19',
      cadRevisionHash: 'HASH_A',
      partRevision: 'REV_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'UNCERTIFIED_M19', // Does not start with SECP!
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      rawMeasurementHash: 'SOME_NON_EMPTY_TELEMETRY_HASH',
      timestamp: new Date().toISOString(),
      signature: 'VALID_SIG'
    };

    MetrologyEngine.registerTestCertificateForAdversarialTest(cert as any);

    expect(() => {
      QualityGate.authorizeRelease('PART_01', 'HASH_A', cert as any);
    }).toThrow(/RELEASE_DENIED: Invalid or unauthenticated certificate provenance/);
  });

  it('T31: QualityGate rejects release if certificate is not registered in the metrology database (M20)', () => {
    const unregisteredCert = {
      certificateId: 'CERT_UNREG',
      partInstanceSerialNumber: 'SN_UNREG',
      cadRevisionHash: 'HASH_A',
      partRevision: 'REV_A',
      disposition: 'ACCEPTED',
      provenanceHash: 'SECP-PROD-UNREG', // Starts with SECP-PROD-, but unregistered!
      evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
      rawMeasurementHash: 'SOME_NON_EMPTY_TELEMETRY_HASH',
      timestamp: new Date().toISOString(),
      signature: 'VALID_SIG'
    };

    // Do NOT register it!

    expect(() => {
      QualityGate.authorizeRelease('PART_01', 'HASH_A', unregisteredCert as any);
    }).toThrow(/RELEASE_DENIED: CERTIFICATE_NOT_FOUND/);
  });
});
