import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationEngine } from '../../simulation/SimulationEngine';
import { SimulationScenario } from '../../simulation/SimulationScenarioTypes';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { SimulationIdentityService } from '../../simulation/SimulationIdentityService';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { QualityGate } from '../../verification/QualityGate';
import { generateKeyPairSync, createSign } from 'crypto';

describe('Industrial Truth Chain — Root Reconciliation Audit', () => {
  let revisionEngine: RevisionEngine;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    SimulationIdentityService.initialize(revisionEngine);
    MetrologyEngine.clearRegistry();
  });
  
  describe('ROOT-1: Canonical Identity Enforcement', () => {
    it('should PROVE that SimulationEngine now mandates internal canonical identity resolution', () => {
      // 1. Register a canonical revision in the backend
      const modelId = 'GEOM_01';
      revisionEngine.createRevision({
        revisionId: 'REV_1',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { type: 'MESH', vertices: 100 },
        revisionHash: 'HASH_CANONICAL'
      } as any);

      // 2. Caller creates a scenario with STALE geometry
      const scenario: SimulationScenario = {
        id: 'SCEN_01',
        geometry: { modelId, geometryHash: 'HASH_OLD' } as any,
        revision: 'REV_A',
        parameters: [],
        material: { materialId: 'STEEL' } as any
      } as any;

      // 3. Execution: Caller cannot "omit" or "bypass" the check because SimulationEngine
      // internally fetches 'HASH_CANONICAL' from the RevisionEngine.
      const res = SimulationEngine.runScenario(scenario);
      
      expect(res.status).toBe('STALE_IDENTITY');
      expect(res.provenanceHash).toBe('INVALID_CHAIN');
    });
  });

  describe('ROOT-2: Authoritative Physical Provenance', () => {
    it('should PROVE that MetrologyEngine rejects masquerading even if pointIds are spoofed', () => {
      const plan = {
        planId: 'PLAN_01',
        partId: 'PART_01',
        partRevision: 'REV_A',
        specifications: [{ specId: 'S1', featureId: 'F1', characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
        pointsPerFeature: { F1: 1 },
        planHash: 'H1'
      };

      const instrument = MetrologyEngine.createInstrument('I1', 'Inst', 'ZEISS_CMM_PROBE');
      
      // 1. Legitimate Simulated Session (Synthetic)
      const session = MetrologyEngine.runSession('S1', plan as any, 'SN1', instrument, 'OP1', 'SIMULATED');
      
      // 2. Spoofing Attack: Alter pointIds AND Relabel as Physical
      const spoofedSession = {
        ...session,
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY' as any,
        measuredFeatures: session.measuredFeatures.map(f => ({
          ...f,
          points: f.points.map(p => ({ 
            ...p, 
            pointId: p.pointId.replace('-sim-', '-live-'),
            acquisitionSignature: 'SYNTHETIC_STAMP_UNVERIFIED'
          }))
        }))
      };

      // 3. REJECTION: Checks cryptographic signature, not string patterns.
      expect(() => MetrologyEngine.issueQualityCertificate(spoofedSession, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_X'))
        .toThrow(/PROVENANCE_ERROR|PROVENANCE_BREACH/);
    });

    it('should PASS for legitimate physical data with valid driver signature', () => {
      const plan = {
        planId: 'PLAN_01',
        partId: 'PART_01',
        partRevision: 'REV_A',
        specifications: [{ specId: 'S1', featureId: 'F1', characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
        pointsPerFeature: { F1: 1 },
        planHash: 'H1'
      };
      const instrument = MetrologyEngine.createInstrument('I1', 'Inst', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_001', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_001', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-legit-001',
        sessionId: 'S2',
        driverId: 'DRIVER_001',
        instrumentId: 'I1',
        calibrationId: instrument.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 1,
        points: [
          { pointId: 'pt-live-PLAN_01-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S2', plan as any, 'SN1', instrument, 'OP1', 'LIVE', 0, connection as any);
      
      const cert = MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_001');
      expect(cert.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');
      expect(cert.provenanceHash).toBeDefined();
    });
  });

  function issueAuthenticProductionCert(cadRevisionHash: string, suffix: string = '001') {
    const plan = {
      planId: `PLAN_${suffix}`,
      partId: `PART_${suffix}`,
      partRevision: 'REV_A',
      specifications: [{ specId: `S_${suffix}`, featureId: `F_${suffix}`, characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
      pointsPerFeature: { [`F_${suffix}`]: 1 },
      planHash: `H_${suffix}`
    };
    const instrument = MetrologyEngine.createInstrument(`INST_${suffix}`, 'Inst', 'ZEISS_CMM_PROBE');
    const driverId = `DRIVER_${suffix}`;
    const connection = { driverId, connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    MetrologyEngine.registerTrustedDriver(driverId, publicKeyPem, 'PRODUCTION');

    const envelope = {
      acquisitionId: `acq_${suffix}`,
      sessionId: `SESSION_${suffix}`,
      driverId,
      instrumentId: `INST_${suffix}`,
      calibrationId: instrument.calibration.calibrationId,
      acquiredAt: new Date().toISOString(),
      nonce: 1,
      points: [
        { pointId: `pt-live-PLAN_${suffix}-F_${suffix}-1`, measuredCoordinates: { x: 25.001, y: 0.0, z: 0.0 } }
      ],
      signature: ''
    };

    const payloadString = [
      envelope.acquisitionId,
      envelope.sessionId,
      envelope.driverId,
      envelope.instrumentId,
      envelope.calibrationId,
      envelope.acquiredAt,
      envelope.nonce,
      envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
    ].join(':');

    const sign = createSign('SHA256');
    sign.update(payloadString);
    envelope.signature = sign.sign(privateKey, 'hex');

    MetrologyEngine.submitAcquisitionEnvelope(envelope);

    const session = MetrologyEngine.runSession(`SESSION_${suffix}`, plan as any, `SN_${suffix}`, instrument, 'OP1', 'LIVE', 0, connection as any);
    return MetrologyEngine.issueQualityCertificate(session, plan as any, cadRevisionHash, `JOB_${suffix}`, driverId);
  }

  describe('ROOT-3: Certificate Enforcement', () => {
    it('should PROVE that QualityGate enforces certificate validity before release', () => {
      const cert = issueAuthenticProductionCert('REV_1_HASH', 'ROOT3');

      // 1. Wrong Revision -> REJECT
      expect(() => QualityGate.authorizeRelease('P1', 'REV_2_HASH', cert)).toThrow(/RELEASE_DENIED/);

      // 2. Rejected Quality -> REJECT
      const badCert = { ...cert, disposition: 'REJECTED' as any };
      expect(() => QualityGate.authorizeRelease('P1', 'REV_1_HASH', badCert)).toThrow(/RELEASE_DENIED/);

      // 3. Correct Cert -> PASS
      expect(QualityGate.authorizeRelease('P1', 'REV_1_HASH', cert)).toBe(true);
    });
  });

  describe('REQUIRED ADVERSARIAL MATRIX — PHYSICAL PROVENANCE INTEGRITY', () => {
    const plan = {
      planId: 'PLAN_ADV',
      partId: 'PART_ADV',
      partRevision: 'REV_A',
      specifications: [{ specId: 'S1', featureId: 'F1', characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
      pointsPerFeature: { F1: 1 },
      planHash: 'H_ADV'
    };

    it('T1: Empty Level-3 session should be BLOCKED', () => {
      const session = {
        sessionId: 'S_T1',
        planId: 'PLAN_ADV',
        partInstanceSerialNumber: 'SN_ADV',
        instrumentId: 'INST_T1',
        operatorId: 'OP1',
        measuredFeatures: [], // Empty
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
      };
      expect(() => MetrologyEngine.issueQualityCertificate(session as any, plan as any, 'REV_HASH', 'JOB_1'))
        .toThrow(/PROVENANCE_ERROR/);
    });

    it('T2: Empty Level-3 + PASS + ACCEPTED should be BLOCKED', () => {
      const session = {
        sessionId: 'S_T2',
        planId: 'PLAN_ADV',
        partInstanceSerialNumber: 'SN_ADV',
        instrumentId: 'INST_T2',
        operatorId: 'OP1',
        measuredFeatures: [], // Empty
        overallStatus: 'PASS',
        disposition: 'ACCEPTED',
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
      };
      expect(() => MetrologyEngine.issueQualityCertificate(session as any, plan as any, 'REV_HASH', 'JOB_1'))
        .toThrow(/PROVENANCE_ERROR/);
    });

    it('T3: Unsigned point should be BLOCKED', () => {
      const inst = MetrologyEngine.createInstrument('INST_T3', 'Inst T3', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T3', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };
      
      const session = MetrologyEngine.runSession('S_T3', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);
      session.measuredFeatures[0].points[0].acquisitionSignature = ''; // Unsigned point

      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T3'))
        .toThrow(/PROVENANCE_ERROR/);
    });

    it('T4: Application/test key attempting to masquerade as production driver should be BLOCKED', () => {
      const inst = MetrologyEngine.createInstrument('INST_T4', 'Inst T4', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T4', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      
      // Register driver as TEST instead of PRODUCTION
      MetrologyEngine.registerTrustedDriver('DRIVER_T4', publicKeyPem, 'TEST');

      const envelope = {
        acquisitionId: 'acq-t4',
        sessionId: 'S_T4',
        driverId: 'DRIVER_T4',
        instrumentId: 'INST_T4',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_T4', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Rejects certificate release with LEVEL_3 grade because the driver type is TEST, not PRODUCTION
      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T4'))
        .toThrow(/PROVENANCE_BREACH/);
    });

    it('T5: Instrument A acquisition -> Instrument B metadata substitution should be BLOCKED', () => {
      const instA = MetrologyEngine.createInstrument('INST_T5_A', 'Instrument T5 A', 'ZEISS_CMM_PROBE');
      const instB = MetrologyEngine.createInstrument('INST_T5_B', 'Instrument T5 B', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T5', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_T5', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-t5',
        sessionId: 'S_T5',
        driverId: 'DRIVER_T5',
        instrumentId: 'INST_T5_A', // Bound to Instrument A
        calibrationId: instA.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_T5', plan as any, 'SN_ADV', instB, 'OP1', 'LIVE', 0, connection as any); // Swapped to B!

      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T5'))
        .toThrow(/PROVENANCE_BREACH/);
    });

    it('T6: Calibration mutation after acquisition should be BLOCKED', () => {
      const inst = MetrologyEngine.createInstrument('INST_T6', 'Inst T6', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T6', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_T6', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-t6',
        sessionId: 'S_T6',
        driverId: 'DRIVER_T6',
        instrumentId: 'INST_T6',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_T6', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Mutate the calibration dates inside the instrument AFTER acquisition
      inst.calibration.calibratedAt = new Date(Date.now() + 10000).toISOString(); // future calibration

      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T6'))
        .toThrow(/CALIBRATION_EXPIRED/);
    });

    it('T7: Session replay should be BLOCKED', () => {
      const inst = MetrologyEngine.createInstrument('INST_T7', 'Inst T7', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T7', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_T7', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-t7',
        sessionId: 'S_T7_ORIGINAL',
        driverId: 'DRIVER_T7',
        instrumentId: 'INST_T7',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 12,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const originalSession = MetrologyEngine.runSession('S_T7_ORIGINAL', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Submit the replayed envelope with mismatched sessionId inside the signed payload
      MetrologyEngine.submitAcquisitionEnvelope({
        ...envelope,
        sessionId: 'S_T7_REPLAY'
      });

      // Attempt to replay original session points in a new session S_T7_REPLAY
      const replaySession = {
        ...originalSession,
        sessionId: 'S_T7_REPLAY'
      };

      expect(() => MetrologyEngine.issueQualityCertificate(replaySession, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T7'))
        .toThrow(/PROVENANCE_BREACH/);
    });

    it('T8: Coordinate mutation should be BLOCKED', () => {
      const inst = MetrologyEngine.createInstrument('INST_T8', 'Inst T8', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_T8', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_T8', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-t8',
        sessionId: 'S_T8',
        driverId: 'DRIVER_T8',
        instrumentId: 'INST_T8',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_T8', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Tamper with points in the session object
      session.measuredFeatures[0].points[0].measuredCoordinates = { x: 99.9, y: 99.9, z: 99.9 };

      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_T8'))
        .toThrow(/PROVENANCE_BREACH/);
    });

    it('T9: Old acquisition -> new revision should be BLOCKED', () => {
      const cert = issueAuthenticProductionCert('REV_1_HASH', 'T9');

      // QualityGate must block the release because CAD revision is different
      expect(() => QualityGate.authorizeRelease('P1', 'REV_2_HASH', cert))
        .toThrow(/RELEASE_DENIED/);
    });

    it('T10, T11, T12: Forged statistics, PASS status, and ACCEPTED disposition should be IGNORED and OVERWRITTEN', () => {
      const inst = MetrologyEngine.createInstrument('INST_STATS', 'Inst Stats', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_STATS', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_STATS', publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-stats',
        sessionId: 'S_STATS',
        driverId: 'DRIVER_STATS',
        instrumentId: 'INST_STATS',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_STATS', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Attempt S1-S6 statistical forgery: inject extremely small stats, fabricated PASS status and ACCEPTED disposition
      session.measuredFeatures[0].calculatedDeviationMm = 0.00001;
      session.measuredFeatures[0].uncertaintyMm = 0.00002;
      session.measuredFeatures[0].confidenceIntervalMaxMm = 0.00003;
      session.measuredFeatures[0].status = 'PASS';
      session.overallStatus = 'PASS';
      session.disposition = 'ACCEPTED';

      const cert = MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_STATS');

      // Check that forged statistics, status, and disposition are completely ignored and overwritten based on raw measurements!
      expect(cert.overallStatus).toBe('FAIL'); // Correct derived status
      expect(cert.disposition).toBe('REJECTED'); // Correct derived disposition
      expect(session.measuredFeatures[0].calculatedDeviationMm).not.toBe(0.00001); // Recomputed correctly
    });

    it('T13: Empty/nonphysical certificate -> release should be BLOCKED', () => {
      const badCert = {
        certificateId: 'cert-empty',
        cadRevisionHash: 'REV_1_HASH',
        disposition: 'ACCEPTED',
        provenanceHash: 'SECP-PROD-EMPTY',
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
        rawMeasurementHash: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855' // empty hash
      } as any;

      MetrologyEngine.registerTestCertificateForAdversarialTest(badCert);

      expect(() => QualityGate.authorizeRelease('P1', 'REV_1_HASH', badCert))
        .toThrow(/RELEASE_DENIED: Certificate lacks authenticated telemetry/);
    });

    it('T14: Valid test acquisition through explicit TEST trust boundary should PASS but remain classified as test/synthetic', () => {
      const inst = MetrologyEngine.createInstrument('INST_TEST_14', 'Inst Test 14', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_TEST_14', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_TEST_14', publicKeyPem, 'TEST'); // Registered as TEST!

      const envelope = {
        acquisitionId: 'acq-test-14',
        sessionId: 'S_TEST_14',
        driverId: 'DRIVER_TEST_14',
        instrumentId: 'INST_TEST_14',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 10,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_TEST_14', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Rejects certificate release with LEVEL_3 grade because driver is TEST, not PRODUCTION
      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_TEST_14'))
        .toThrow(/PROVENANCE_BREACH/);

      // However, if run under non-physical synthetic grade session:
      session.evidenceGrade = 'LEVEL_1_SYNTHETIC';
      const testCert = MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_TEST_14');
      
      expect(testCert.evidenceGrade).toBe('LEVEL_1_SYNTHETIC');
      expect(testCert.provenanceHash).toContain('SECP-TEST-'); // Correctly test-prefixed and synthetic!
    });

    it('T15: Valid production-style acquisition envelope signed by configured trusted verification authority should PASS', () => {
      const inst = MetrologyEngine.createInstrument('INST_PROD_15', 'Inst Prod 15', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_PROD_15', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_PROD_15', publicKeyPem, 'PRODUCTION'); // Registered as PRODUCTION!

      const envelope = {
        acquisitionId: 'acq-prod-15',
        sessionId: 'S_PROD_15',
        driverId: 'DRIVER_PROD_15',
        instrumentId: 'INST_PROD_15',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 1,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 25.0001, y: 0.0, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_PROD_15', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      const cert = MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_PROD_15');
      
      expect(cert.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');
      expect(cert.provenanceHash).toContain('SECP-PROD-'); // Production-certified!
      expect(QualityGate.authorizeRelease('P1', 'REV_HASH', cert)).toBe(true); // Releases perfectly!
    });

    it('Section 15: Critical Negative Test - Malicious application process attempting fake signature generation must be BLOCKED', () => {
      // Create a registered production driver
      const inst = MetrologyEngine.createInstrument('INST_SEC15', 'Inst Sec 15', 'ZEISS_CMM_PROBE');
      const connection = { driverId: 'DRIVER_SEC15', connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver('DRIVER_SEC15', publicKeyPem, 'PRODUCTION'); // SECP application only knows the public key!

      // Malicious process runs and generates its OWN completely new private key to fake sign coordinates
      const maliciousKeyPair = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const badPrivateKey = maliciousKeyPair.privateKey;

      const fakeEnvelope = {
        acquisitionId: 'acq-forged',
        sessionId: 'S_SEC15',
        driverId: 'DRIVER_SEC15',
        instrumentId: 'INST_SEC15',
        calibrationId: inst.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 101,
        points: [
          { pointId: 'pt-live-PLAN_ADV-F1-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        fakeEnvelope.acquisitionId,
        fakeEnvelope.sessionId,
        fakeEnvelope.driverId,
        fakeEnvelope.instrumentId,
        fakeEnvelope.calibrationId,
        fakeEnvelope.acquiredAt,
        fakeEnvelope.nonce,
        fakeEnvelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      fakeEnvelope.signature = sign.sign(badPrivateKey, 'hex'); // signed with malicious key!

      MetrologyEngine.submitAcquisitionEnvelope(fakeEnvelope);

      const session = MetrologyEngine.runSession('S_SEC15', plan as any, 'SN_ADV', inst, 'OP1', 'LIVE', 0, connection as any);

      // Rejects certificate release because signature doesn't match the configured PRODUCTION public key!
      expect(() => MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_HASH', 'JOB_1', 'DRIVER_SEC15'))
        .toThrow(/PROVENANCE_BREACH: Asymmetric signature verification failed/);
    });
  });
});
