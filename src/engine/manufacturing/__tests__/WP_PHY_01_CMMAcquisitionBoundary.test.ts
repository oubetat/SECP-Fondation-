/**
 * SECP-POST-007 PHASE 3 — WP-PHY-01
 * CMM Hardware Acquisition Boundary Verification Suite
 * 
 * TESTS THE 5 ESSENTIAL PHYSICAL TRUTH CASES:
 * - Case A: Genuine hardware artifact (physical promotion authorized after complete verification)
 * - Case B: Protocol-valid simulation (remains COMPUTED_FROM_SYNTHETIC_DATA, cannot raise tier)
 * - Case C: Replay attack (stale session / repeated nonce rejected)
 * - Case D: Hardware identity substitution (device serial vs probe serial mismatch rejected)
 * - Case E: Calibration substitution (foreign or expired calibration certificate rejected)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CMMHardwareAcquisitionAdapter } from '../metrology/CMMHardwareAcquisitionAdapter';
import {
  IndependentCMMAcquisitionOracle,
  OracleEnvelopeInput
} from '../metrology/IndependentCMMAcquisitionOracle';
import { EvidenceProvenanceAntiSpoofEngine } from '../../digital_thread/EvidenceProvenanceAntiSpoofEngine';
import {
  QuantitativeLossProfiler,
  StageLossMeasurement
} from '../../digital_thread/QuantitativeLossProfiler';
import { LifecycleStage } from '../../digital_thread/CyberPhysicalLossAccountingEngine';

describe('WP-PHY-01: REAL CMM HARDWARE ACQUISITION BOUNDARY', () => {

  beforeEach(() => {
    CMMHardwareAcquisitionAdapter.resetNonceRegistry();
    IndependentCMMAcquisitionOracle.resetOracleState();
  });

  // -------------------------------------------------------------------------
  // CASE A: GENUINE HARDWARE ARTIFACT
  // -------------------------------------------------------------------------
  describe('Case A: Genuine Hardware Artifact', () => {
    it('verifies genuine physical CMM capture and permits elevation to SUPPORTED_BY_PHYSICAL_TELEMETRY', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      const validation = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);

      expect(validation.isValid).toBe(true);
      expect(validation.eligibleForPhysicalTelemetryTier).toBe(true);
      expect(validation.sourceClassification).toBe('PHYSICAL_CMM_DEVICE');
      expect(validation.violations.length).toBe(0);

      // Independent Oracle verification
      const oracleInput: OracleEnvelopeInput = {
        sourceType: envelope.hardwareSource,
        sessionNonce: envelope.sessionNonce,
        deviceSerial: envelope.deviceIdentity.deviceSerialNumber,
        probeDeviceSerial: envelope.probeBinding.qualifiedForDeviceSerial,
        calCertSerial: envelope.calibrationBinding.boundDeviceSerialNumber,
        calExpiresUtc: envelope.calibrationBinding.expirationDateIso,
        calIssueUtc: envelope.calibrationBinding.issueDateIso,
        currentTimeUtc: new Date().toISOString(),
        cryptoSig: envelope.deviceIdentity.cryptographicDeviceCertificate,
        points: envelope.rawTouchPoints.map(p => ({
          tick: p.clockTickNs,
          x: p.rawMcsX,
          y: p.rawMcsY,
          z: p.rawMcsZ
        })),
        payloadDigest: envelope.rawPayloadSha256Digest
      };

      const oracleResult = IndependentCMMAcquisitionOracle.auditAcquisitionIndependently(oracleInput);
      expect(oracleResult.oracleVerdict).toBe('GENUINE_PHYSICAL_CMM_ACQUISITION');
      expect(oracleResult.oracleSampleVarianceX).toBeGreaterThan(0);

      const comparison = IndependentCMMAcquisitionOracle.compare(validation, oracleResult);
      expect(comparison.agreementStatus).toBe('ORACLE_ACQUISITION_AGREEMENT');
      expect(comparison.verdict).toBe('ACCEPTED_AS_PHYSICAL_GROUND_TRUTH');

      // Bridge to AntiSpoofEngine
      const telemetryBundle = CMMHardwareAcquisitionAdapter.toVerifiablePhysicalTelemetryBundle(envelope);
      const antiSpoof = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        telemetryBundle,
        'SUPPORTED_BY_PHYSICAL_TELEMETRY'
      );

      expect(antiSpoof.antiSpoofStatus).toBe('PASSED_VERIFIABLE_PHYSICAL');
      expect(antiSpoof.derivedEvidenceLevel).toBe('SUPPORTED_BY_PHYSICAL_TELEMETRY');

      // Ingest into QuantitativeLossProfiler
      const stream: StageLossMeasurement[] = [
        {
          fromStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
          toStage: LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
          stageName: 'Physical CMM Touch Probing Inspection',
          lossMagnitudeMm: 0.012,
          uncertaintyMm: envelope.calibrationBinding.uncertaintyK2Mm,
          lossCategory: 'SENSOR_REPEATABILITY',
          evidenceClassification: 'SUPPORTED_BY_PHYSICAL_TELEMETRY',
          claimedPhysicalCause: 'TRUE_PHYSICAL_CMM_INSPECTION_ACQUISITION',
          verifiableTelemetryBundle: telemetryBundle
        }
      ];

      const report = QuantitativeLossProfiler.profileLossThread(stream, 0.050);
      expect(report.spoofingDetected).toBe(false);
      expect(report.dominantBottleneck.evidenceClassification).toBe('SUPPORTED_BY_PHYSICAL_TELEMETRY');
      expect(report.dominantBottleneck.causalStatus).toBe('PHYSICAL_CAUSE_ESTABLISHED');
      expect(report.prognosticAction).toBe('PROCEED');
    });
  });

  // -------------------------------------------------------------------------
  // CASE B: PROTOCOL-VALID SIMULATION
  // -------------------------------------------------------------------------
  describe('Case B: Protocol-Valid Simulation', () => {
    it('restricts protocol-valid simulator output to COMPUTED_FROM_SYNTHETIC_DATA regardless of fidelity', () => {
      const simulatorEnv = CMMHardwareAcquisitionAdapter.createProtocolValidSimulatorEnvelope();
      const validation = CMMHardwareAcquisitionAdapter.validateEnvelope(simulatorEnv);

      // Must be rejected from physical elevation
      expect(validation.isValid).toBe(false);
      expect(validation.eligibleForPhysicalTelemetryTier).toBe(false);
      expect(validation.rejectionReason).toBe('SIMULATOR_SOURCE_RESTRICTED');
      expect(validation.violations.some(v => v.includes('SOURCE_RULE'))).toBe(true);

      // Independent Oracle confirmation
      const oracleInput: OracleEnvelopeInput = {
        sourceType: simulatorEnv.hardwareSource,
        sessionNonce: simulatorEnv.sessionNonce,
        deviceSerial: simulatorEnv.deviceIdentity.deviceSerialNumber,
        probeDeviceSerial: simulatorEnv.probeBinding.qualifiedForDeviceSerial,
        calCertSerial: simulatorEnv.calibrationBinding.boundDeviceSerialNumber,
        calExpiresUtc: simulatorEnv.calibrationBinding.expirationDateIso,
        calIssueUtc: simulatorEnv.calibrationBinding.issueDateIso,
        currentTimeUtc: new Date().toISOString(),
        cryptoSig: simulatorEnv.deviceIdentity.cryptographicDeviceCertificate,
        points: simulatorEnv.rawTouchPoints.map(p => ({
          tick: p.clockTickNs,
          x: p.rawMcsX,
          y: p.rawMcsY,
          z: p.rawMcsZ
        })),
        payloadDigest: simulatorEnv.rawPayloadSha256Digest
      };

      const oracleResult = IndependentCMMAcquisitionOracle.auditAcquisitionIndependently(oracleInput);
      expect(oracleResult.oracleVerdict).toBe('SIMULATOR_REJECTED');

      const comparison = IndependentCMMAcquisitionOracle.compare(validation, oracleResult);
      expect(comparison.agreementStatus).toBe('ORACLE_ACQUISITION_AGREEMENT');
      expect(comparison.verdict).toBe('FAIL_CLOSED_ACQUISITION_REJECTED');
    });
  });

  // -------------------------------------------------------------------------
  // CASE C: REPLAY ATTACK
  // -------------------------------------------------------------------------
  describe('Case C: Replay Attack', () => {
    it('rejects replayed session nonce on second submission (STALE_REPLAY_DETECTED)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      
      // 1st submission succeeds
      const firstRun = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(firstRun.isValid).toBe(true);

      // 2nd submission with identical nonce MUST FAIL
      const secondRun = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(secondRun.isValid).toBe(false);
      expect(secondRun.rejectionReason).toBe('STALE_REPLAY_DETECTED');
      expect(secondRun.violations.some(v => v.includes('REPLAY_RULE'))).toBe(true);
    });

    it('rejects stale captures exceeding active session processing window', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      const staleTime = new Date(Date.now() - 86400000 * 30).toISOString(); // 30 days old
      envelope.acquisitionStartUtc = staleTime;
      envelope.acquisitionEndUtc = staleTime;

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('REPLAY_RULE'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // CASE D: HARDWARE IDENTITY SUBSTITUTION
  // -------------------------------------------------------------------------
  describe('Case D: Hardware Identity Substitution', () => {
    it('detects probe qualified for Device A submitted on Device B (HARDWARE_IDENTITY_MISMATCH)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      // Machine claims to be Zeiss Prismo SN9941, but mounted probe was qualified on Equator SN1102
      envelope.probeBinding.qualifiedForDeviceSerial = 'RENISHAW_EQUATOR_SN1102';

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('HARDWARE_IDENTITY_MISMATCH');
      expect(result.violations.some(v => v.includes('IDENTITY_RULE'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // CASE E: CALIBRATION SUBSTITUTION & EXPIRATION
  // -------------------------------------------------------------------------
  describe('Case E: Calibration Substitution & Expiration', () => {
    it('E1: Detects calibration certificate bound to foreign machine serial (CALIBRATION_IDENTITY_MISMATCH)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      // Calibration belongs to Mitutoyo Crysta Apex SN5501
      envelope.calibrationBinding.boundDeviceSerialNumber = 'MITUTOYO_CRYSTA_SN5501';

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('CALIBRATION_IDENTITY_MISMATCH');
      expect(result.violations.some(v => v.includes('CALIBRATION_RULE'))).toBe(true);
    });

    it('E2: Detects expired calibration certificate (CALIBRATION_EXPIRED)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      // Calibration expired 2 months ago
      envelope.calibrationBinding.expirationDateIso = new Date(Date.now() - 60 * 86400000).toISOString();

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('CALIBRATION_EXPIRED');
      expect(result.violations.some(v => v.includes('CALIBRATION_RULE'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // ADDITIONAL ADVERSARIAL MUTATIONS
  // -------------------------------------------------------------------------
  describe('Additional Adversarial Boundary Mutations', () => {
    it('detects flatline mock touch points (ZERO_VARIANCE_FLATLINE)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      // Force all touch points to identical X coordinate
      envelope.rawTouchPoints.forEach(p => { p.rawMcsX = 100.0; });

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('ZERO_VARIANCE_FLATLINE');
    });

    it('detects unauthenticated hardware certificate (UNAUTHENTICATED_HARDWARE_SIGNATURE)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      envelope.deviceIdentity.cryptographicDeviceCertificate = 'INVALID_FAKE_CERT_123';

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('UNAUTHENTICATED_HARDWARE_SIGNATURE');
    });

    it('detects tampered payload SHA-256 digest (TAMPERED_PAYLOAD_DIGEST)', () => {
      const envelope = CMMHardwareAcquisitionAdapter.createGenuinePhysicalCMMEnvelope();
      envelope.rawPayloadSha256Digest = 'MD5_CORRUPTED_HASH';

      const result = CMMHardwareAcquisitionAdapter.validateEnvelope(envelope);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toBe('TAMPERED_PAYLOAD_DIGEST');
    });
  });
});
