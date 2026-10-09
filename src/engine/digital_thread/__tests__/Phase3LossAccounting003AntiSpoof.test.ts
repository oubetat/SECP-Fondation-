/**
 * SECP-POST-007 PHASE 3 — PHASE3-LOSS-ACCOUNTING-003
 * Evidence Provenance & Causality Anti-Spoof Forensic Test Suite
 * 
 * 24 ADVERSARIAL MUTATION ATTACKS (SPOOF-01 to SPOOF-24):
 * - Guarantees Evidence Level is derived forensically from actual physical evidence, NEVER caller declaration.
 * - Prevents all spoofing, mock fixtures, flatlined fake signals, expired calibration, and signature forgery.
 * - Enforces Independent Oracle verification with fail-closed arbitration.
 */

import { describe, it, expect } from 'vitest';
import {
  EvidenceProvenanceAntiSpoofEngine,
  VerifiablePhysicalTelemetryBundle
} from '../EvidenceProvenanceAntiSpoofEngine';
import {
  IndependentEvidenceAntiSpoofOracle,
  OracleRawBundleInput
} from '../IndependentEvidenceAntiSpoofOracle';
import {
  QuantitativeLossProfiler,
  StageLossMeasurement
} from '../QuantitativeLossProfiler';
import { LifecycleStage } from '../CyberPhysicalLossAccountingEngine';

describe('PHASE3-LOSS-ACCOUNTING-003: EVIDENCE PROVENANCE & CAUSALITY ANTI-SPOOF', () => {

  const createBaseGenuineBundle = (): VerifiablePhysicalTelemetryBundle => {
    return EvidenceProvenanceAntiSpoofEngine.createGenuinePhysicalTelemetryBundle();
  };

  // -------------------------------------------------------------------------
  // SECTION 1: CORE INVARIANT — EVIDENCE LEVEL DERIVATION (NOT CALLER INPUT)
  // -------------------------------------------------------------------------
  describe('Forensic Evidence Level Derivation & Anti-Spoof', () => {
    
    it('SPOOF-01: Caller claims PHYSICAL_TELEMETRY with zero hardware bundle -> Flagged FRAUD & downgraded', () => {
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        undefined,
        'SUPPORTED_BY_PHYSICAL_TELEMETRY'
      );

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.derivedEvidenceLevel).toBe('COMPUTED_FROM_SYNTHETIC_DATA');
      expect(result.violations.some(v => v.includes('SPOOF_01'))).toBe(true);
      expect(result.cryptographicAttestationVerified).toBe(false);
    });

    it('SPOOF-02: Tampered Hardware Device ID -> Caught by attestation check', () => {
      const bundle = createBaseGenuineBundle();
      bundle.attestation.hardwareDeviceId = '';
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.violations.some(v => v.includes('SPOOF_02'))).toBe(true);
    });

    it('SPOOF-03: Missing Device Serial Number -> Caught by attestation check', () => {
      const bundle = createBaseGenuineBundle();
      bundle.attestation.deviceSerialNumber = '';
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.violations.some(v => v.includes('SPOOF_02'))).toBe(true);
    });

    it('SPOOF-04: Forged Hardware Signature (Invalid Prefix) -> Caught as crypto forgery', () => {
      const bundle = createBaseGenuineBundle();
      bundle.attestation.cryptographicDeviceSignature = 'FAKE_SIGNATURE_FORGERY_SHA256_001';
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.violations.some(v => v.includes('SPOOF_03'))).toBe(true);
      expect(result.cryptographicAttestationVerified).toBe(false);
    });

    it('SPOOF-05: Missing or Spoofed Bus / MAC Address -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.attestation.busOrMacAddress = '00'; // Too short / invalid
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_04'))).toBe(true);
    });

    it('SPOOF-06: Missing Metrology Calibration Certificate -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      (bundle as any).calibration = undefined;
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.violations.some(v => v.includes('SPOOF_05'))).toBe(true);
    });

    it('SPOOF-07: Expired Calibration Certificate -> Rejected with timestamp proof', () => {
      const bundle = createBaseGenuineBundle();
      bundle.calibration.expirationDateIso = '2023-01-01T00:00:00Z'; // Expired in 2023
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        bundle,
        'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        '2026-09-23T08:00:00Z'
      );

      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
      expect(result.calibrationValid).toBe(false);
      expect(result.violations.some(v => v.includes('SPOOF_07'))).toBe(true);
    });

    it('SPOOF-08: Future-dated (Post-dated) Calibration Certificate -> Rejected', () => {
      const bundle = createBaseGenuineBundle();
      bundle.calibration.issueDateIso = '2030-01-01T00:00:00Z'; // Issued in the future
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        bundle,
        'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        '2026-09-23T08:00:00Z'
      );

      expect(result.violations.some(v => v.includes('SPOOF_08'))).toBe(true);
    });

    it('SPOOF-09: Impossible Zero or Negative Calibration Uncertainty -> Rejected', () => {
      const bundle = createBaseGenuineBundle();
      bundle.calibration.expandedUncertaintyK2Mm = -0.002;
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_09'))).toBe(true);
    });

    it('SPOOF-10: Missing Raw Packet Header Sequence or Hardware Clock -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      delete (bundle.rawPacket as any).packetSequenceNumber;
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_10'))).toBe(true);
    });

    it('SPOOF-11: Empty Raw Sample Points Array -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.rawPacket.rawSamplePoints = [];
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_11'))).toBe(true);
    });

    it('SPOOF-12: Non-Monotonic Timestamps (Time Reversal / Jitter Corruption) -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      // Introduce time reversal in sample point 3
      bundle.rawPacket.rawSamplePoints[2].timestampOffsetMs = 0.5; // earlier than sample 2 (2.0ms)
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.monotonicClockVerified).toBe(false);
      expect(result.violations.some(v => v.includes('SPOOF_12'))).toBe(true);
    });

    it('SPOOF-13: Flatlined Sensor Telemetry (Zero Variance Synthetic Mock) -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      // Make all force readings exactly identical (flatline mock)
      bundle.rawPacket.rawSamplePoints = [
        { timestampOffsetMs: 0.0, channelValues: { force: 1500.0 } },
        { timestampOffsetMs: 1.0, channelValues: { force: 1500.0 } },
        { timestampOffsetMs: 2.0, channelValues: { force: 1500.0 } },
        { timestampOffsetMs: 3.0, channelValues: { force: 1500.0 } }
      ];
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.entropyScore).toBe(0.0);
      expect(result.violations.some(v => v.includes('SPOOF_13'))).toBe(true);
      expect(result.antiSpoofStatus).toBe('EVIDENCE_SPOOFING_DETECTED');
    });

    it('SPOOF-14: Impossible Physical Telemetry: Negative Cutting Force -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.rawPacket.rawSamplePoints[1].channelValues.cuttingForceN = -450.0; // Negative tension cutting force!
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_14'))).toBe(true);
    });

    it('SPOOF-15: Impossible Physical Telemetry: Negative Spindle Power -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.rawPacket.rawSamplePoints[1].channelValues.spindleKw = -25.0; // Spindle acting as generator in cut!
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_15'))).toBe(true);
    });

    it('SPOOF-16: Insufficient Sample Point Count (<3 points) -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.rawPacket.rawSamplePoints = [
        { timestampOffsetMs: 0.0, channelValues: { force: 1200 } }
      ];
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_16'))).toBe(true);
    });

    it('SPOOF-17: Corrupted Raw Binary Payload Hash Digest -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.rawPacket.rawBinarySha256Digest = 'INVALID_MD5_HASH';
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_17'))).toBe(true);
    });

    it('SPOOF-18: Telemetry Unbound from Machine / Work Offset / Program -> Caught', () => {
      const bundle = createBaseGenuineBundle();
      bundle.machineId = '';
      bundle.workOffsetId = '';
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      expect(result.violations.some(v => v.includes('SPOOF_18'))).toBe(true);
    });

    it('SPOOF-19: Genuine Certified Telemetry Bundle -> Verified as Genuine Physical Telemetry', () => {
      const bundle = createBaseGenuineBundle();
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        bundle,
        'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        new Date().toISOString()
      );

      expect(result.antiSpoofStatus).toBe('PASSED_VERIFIABLE_PHYSICAL');
      expect(result.derivedEvidenceLevel).toBe('SUPPORTED_BY_PHYSICAL_TELEMETRY');
      expect(result.cryptographicAttestationVerified).toBe(true);
      expect(result.calibrationValid).toBe(true);
      expect(result.monotonicClockVerified).toBe(true);
      expect(result.entropyScore).toBeGreaterThan(0.01);
      expect(result.violations.length).toBe(0);
    });

    it('SPOOF-20: Honest Synthetic Declaration without Bundle -> Clean Synthetic Derivation without Fraud Flag', () => {
      const result = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        undefined,
        'COMPUTED_FROM_SYNTHETIC_DATA'
      );

      expect(result.antiSpoofStatus).toBe('DERIVED_SYNTHETIC');
      expect(result.derivedEvidenceLevel).toBe('COMPUTED_FROM_SYNTHETIC_DATA');
      expect(result.violations.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2: INDEPENDENT ORACLE ANTI-SPOOF ARBITRATION
  // -------------------------------------------------------------------------
  describe('Independent Anti-Spoof Oracle Verification', () => {

    it('SPOOF-21: Independent Oracle confirms genuine physical telemetry with zero discrepancies', () => {
      const bundle = createBaseGenuineBundle();
      const engineResult = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(bundle, 'SUPPORTED_BY_PHYSICAL_TELEMETRY');

      const oracleInput: OracleRawBundleInput = {
        claimedLevel: 'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        hardwareRecord: {
          deviceId: bundle.attestation.hardwareDeviceId,
          serial: bundle.attestation.deviceSerialNumber,
          signature: bundle.attestation.cryptographicDeviceSignature,
          busId: bundle.attestation.busOrMacAddress
        },
        calCert: {
          certId: bundle.calibration.certificateId,
          lab: bundle.calibration.accreditedLaboratory,
          expiresUtc: bundle.calibration.expirationDateIso,
          uncertaintyMm: bundle.calibration.expandedUncertaintyK2Mm
        },
        sampleStream: {
          seq: bundle.rawPacket.packetSequenceNumber,
          clockNs: bundle.rawPacket.hardwareClockTickNs,
          points: bundle.rawPacket.rawSamplePoints.map(p => ({
            t: p.timestampOffsetMs,
            v: p.channelValues.cuttingForceN
          })),
          payloadDigest: bundle.rawPacket.rawBinarySha256Digest
        },
        machineContext: {
          machineId: bundle.machineId,
          offsetId: bundle.workOffsetId,
          progHash: bundle.activeProgramHash
        },
        currentCheckTimeUtc: new Date().toISOString()
      };

      const oracleResult = IndependentEvidenceAntiSpoofOracle.auditEvidenceIndependently(oracleInput);
      expect(oracleResult.oracleVerdict).toBe('GENUINE_PHYSICAL_TELEMETRY');
      expect(oracleResult.independentEntropyDetected).toBe(true);

      const comparison = IndependentEvidenceAntiSpoofOracle.compareVerdicts(engineResult, oracleResult);
      expect(comparison.agreementStatus).toBe('ORACLE_ANTISPOOF_AGREEMENT');
      expect(comparison.verdict).toBe('VERIFIED_PHYSICAL_GROUND_TRUTH');
    });

    it('SPOOF-22: Independent Oracle catches flatline spoofing and fails closed', () => {
      const oracleInput: OracleRawBundleInput = {
        claimedLevel: 'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        hardwareRecord: {
          deviceId: 'DEV_01',
          serial: 'SN_01',
          signature: 'SIG_HW_VALID_PREFIX_01',
          busId: 'PCIe:00:1f'
        },
        calCert: {
          certId: 'CERT_01',
          lab: 'ISO17025',
          expiresUtc: '2028-01-01T00:00:00Z',
          uncertaintyMm: 0.001
        },
        sampleStream: {
          seq: 1,
          clockNs: 1000,
          points: [
            { t: 0, v: 100 },
            { t: 1, v: 100 },
            { t: 2, v: 100 },
            { t: 3, v: 100 } // Variance = 0 (Mock)
          ],
          payloadDigest: 'SHA256_MOCK'
        },
        machineContext: { machineId: 'M1', offsetId: 'G54', progHash: 'H1' },
        currentCheckTimeUtc: '2026-09-23T08:00:00Z'
      };

      const oracleResult = IndependentEvidenceAntiSpoofOracle.auditEvidenceIndependently(oracleInput);
      expect(oracleResult.oracleVerdict).toBe('FRAUDULENT_SPOOF_DETECTED');
      expect(oracleResult.independentVariance).toBe(0);
      expect(oracleResult.tamperingFlags.some(f => f.includes('ORACLE_FLAG_07'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3: END-TO-END PROFILER INTEGRATION & PROGNOSTIC ACTION
  // -------------------------------------------------------------------------
  describe('Quantitative Profiler Anti-Spoof Invariants', () => {

    it('SPOOF-23: Profiler detects caller spoofing, downgrades to synthetic, and forces HALT_REVISE_PROCESS', () => {
      const spoofedStream: StageLossMeasurement[] = [
        {
          fromStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
          toStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
          stageName: 'Fake Machining Claim',
          lossMagnitudeMm: 0.020, // small loss, below tolerance
          lossCategory: 'KINEMATIC_TRACKING',
          evidenceClassification: 'SUPPORTED_BY_PHYSICAL_TELEMETRY', // Caller lies about tier
          claimedPhysicalCause: 'SERVO_LAG_SPECULATION'
          // verifiableTelemetryBundle is omitted!
        }
      ];

      // Tolerance is generous (0.100 mm), loss is only 0.020 mm
      const report = QuantitativeLossProfiler.profileLossThread(spoofedStream, 0.100);

      // Must catch the fraud!
      expect(report.spoofingDetected).toBe(true);
      expect(report.antiSpoofViolations.length).toBeGreaterThan(0);
      expect(report.dominantBottleneck.evidenceClassification).toBe('COMPUTED_FROM_SYNTHETIC_DATA');
      expect(report.dominantBottleneck.causalStatus).toBe('PHYSICAL_CAUSE_NOT_ESTABLISHED');
      expect(report.overallClaimType).toBe('SYNTHETIC_CONTRACT_REPRESENTATION');

      // Even though loss is 20% of tolerance, fraud forces HALT_REVISE_PROCESS!
      expect(report.prognosticAction).toBe('HALT_REVISE_PROCESS');
      expect(report.causalityEnforcementEvidence).toContain('EVIDENCE_SPOOFING_ALERT');
    });

    it('SPOOF-24: Legitimate physical telemetry authorizes prognostic action without alert', () => {
      const cleanPhysicalStream: StageLossMeasurement[] = [
        {
          fromStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
          toStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
          stageName: 'Verified Cutting',
          lossMagnitudeMm: 0.020,
          lossCategory: 'KINEMATIC_TRACKING',
          evidenceClassification: 'SUPPORTED_BY_PHYSICAL_TELEMETRY',
          claimedPhysicalCause: 'SERVO_FOLLOWING_ERROR',
          verifiableTelemetryBundle: createBaseGenuineBundle()
        }
      ];

      const report = QuantitativeLossProfiler.profileLossThread(cleanPhysicalStream, 0.100);

      expect(report.spoofingDetected).toBe(false);
      expect(report.antiSpoofViolations.length).toBe(0);
      expect(report.dominantBottleneck.evidenceClassification).toBe('SUPPORTED_BY_PHYSICAL_TELEMETRY');
      expect(report.dominantBottleneck.causalStatus).toBe('PHYSICAL_CAUSE_ESTABLISHED');
      expect(report.dominantBottleneck.claimType).toBe('PROGNOSTIC_PREDICTION');
      expect(report.prognosticAction).toBe('PROCEED');
    });
  });
});
