import { describe, it, expect, beforeEach } from 'vitest';
import { ProductionTrustRegistry } from '../ProductionTrustRegistry';
import { TrustTestFixtures } from '../TrustTestFixtures';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { createSign } from 'crypto';

describe('POST-TRUTH-CHAIN-002I — Trust Authority Seal Mutation Testing (M01 - M10)', () => {
  let authorityKeyPair: { publicKeyPem: string; privateKeyPem: string };
  let validDriverRecord: any;
  let validDriverKeyPair: { publicKeyPem: string; privateKeyPem: string };

  const liveConn = {
    driverId: 'DRIVER_MUT_001',
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
      driverId: 'DRIVER_MUT_001',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      deviceSerial: 'ZEISS-SN-445566',
      instrumentId: 'INST_ZEISS_001'
    });
  });

  it('M01: Single byte corruption in manifest signature must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    const corruptedSignature = manifest.authoritySignature.slice(0, -2) + (manifest.authoritySignature.endsWith('0') ? '1' : '0');
    const tamperedManifest = { ...manifest, authoritySignature: corruptedSignature };

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(tamperedManifest))
      .toThrow(/PROVENANCE_BREACH: INVALID_AUTHORITY_SIGNATURE/);
  });

  it('M02: Single byte corruption in manifest hash must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    const corruptedHash = manifest.manifestHash.slice(0, -2) + (manifest.manifestHash.endsWith('0') ? '1' : '0');
    const tamperedManifest = { ...manifest, manifestHash: corruptedHash };

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(tamperedManifest))
      .toThrow(/PROVENANCE_BREACH: MANIFEST_HASH_MISMATCH/);
  });

  it('M03: Single byte corruption in driver public key must cause immediate REJECT', () => {
    const corruptedPublicKeyPem = validDriverRecord.publicKeyPem.replace('M', 'N');
    const driver = {
      ...validDriverRecord,
      publicKeyPem: corruptedPublicKeyPem
    };

    const manifest = TrustTestFixtures.createSignedTestManifest([driver], authorityKeyPair);

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: DRIVER_RECORD_HASH_MISMATCH/);
  });

  it('M04: Future issuedAt date must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord],
      authorityKeyPair,
      {
        issuedAt: new Date(Date.now() + 3600000).toISOString(),
        expiresAt: new Date(Date.now() + 7200000).toISOString()
      }
    );

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: MANIFEST_NOT_YET_VALID/);
  });

  it('M05: Expired manifest must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord],
      authorityKeyPair,
      {
        issuedAt: new Date(Date.now() - 7200000).toISOString(),
        expiresAt: new Date(Date.now() - 3600000).toISOString()
      }
    );

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: MANIFEST_EXPIRED/);
  });

  it('M06: Unsupported authority algorithm must cause immediate REJECT', () => {
    const driver = TrustTestFixtures.createDriverRecord({
      driverId: 'D_ALG',
      publicKeyPem: validDriverKeyPair.publicKeyPem
    });
    const manifest = TrustTestFixtures.createSignedTestManifest([driver], authorityKeyPair, {
      algorithm: 'RSA-4096' as any
    });

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: UNSUPPORTED_SIGNATURE_ALGORITHM/);
  });

  it('M07: Unsupported driver curve/algorithm must cause immediate REJECT', () => {
    const driver = TrustTestFixtures.createDriverRecord({
      driverId: 'D_CURVE',
      publicKeyPem: validDriverKeyPair.publicKeyPem,
      algorithm: 'RSA-2048' as any
    });
    const manifest = TrustTestFixtures.createSignedTestManifest([driver], authorityKeyPair);

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: UNSUPPORTED_DRIVER_ALGORITHM/);
  });

  it('M08: Missing driver required fields must cause immediate REJECT', () => {
    const incompleteDriver = { ...validDriverRecord };
    delete (incompleteDriver as any).deviceSerial;

    const manifest = TrustTestFixtures.createSignedTestManifest([incompleteDriver], authorityKeyPair);

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: MISSING_REQUIRED_DRIVER_FIELDS/);
  });

  it('M09: Manifest schema version mismatch must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest(
      [validDriverRecord],
      authorityKeyPair,
      { manifestVersion: '2.0.0' }
    );

    expect(() => ProductionTrustRegistry.loadProvisionedTrust(manifest))
      .toThrow(/PROVENANCE_BREACH: UNSUPPORTED_MANIFEST_VERSION/);
  });

  it('M10: Hardware device binding instrument mismatch during envelope processing must cause immediate REJECT', () => {
    const manifest = TrustTestFixtures.createSignedTestManifest([validDriverRecord], authorityKeyPair);
    ProductionTrustRegistry.loadProvisionedTrust(manifest);

    const instrument = MetrologyEngine.createInstrument('INST_MISMATCH_99', 'Mismatch Inst', 'ZEISS_CMM_PROBE');
    const plan = {
      planId: 'PLAN_01',
      partRevision: 'A',
      specifications: [{ featureId: 'FEAT_01', characteristicType: 'DIAMETER', nominalMm: 50, upperToleranceMm: 0.05, lowerToleranceMm: -0.05 }],
      pointsPerFeature: { FEAT_01: 3 }
    };

    const envelope = {
      acquisitionId: 'ACQ_BIND_MISMATCH',
      sessionId: 'SESS_MISMATCH',
      driverId: 'DRIVER_MUT_001',
      instrumentId: 'INST_MISMATCH_99', // Mismatches validDriverRecord.deviceBinding.instrumentId (INST_ZEISS_001)
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

    const mutConn = { ...liveConn, driverId: 'DRIVER_MUT_001' };
    const session = MetrologyEngine.runSession('SESS_MISMATCH', plan as any, 'SN_01', instrument, 'OP1', 'LIVE', 0.002, mutConn);

    expect(() => {
      MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH_A', 'JOB_01', 'DRIVER_MUT_001');
    }).toThrow(/PROVENANCE_BREACH: Hardware device binding instrument mismatch/);
  });
});
