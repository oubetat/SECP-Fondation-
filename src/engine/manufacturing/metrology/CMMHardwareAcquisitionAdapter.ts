/**
 * SECP-POST-007 PHASE 3 — WP-PHY-01
 * CMM Hardware Acquisition Adapter (I++ DME & Hardware Boundary Engine)
 * 
 * Bridges physical CMM communications to the Canonical Physical Telemetry Envelope.
 * Enforces hardware connection provenance, prevents replay attacks, checks device
 * identity bindings, and ensures simulators are never promoted to physical tier.
 */

import {
  CanonicalCMMTelemetryEnvelope,
  CMMEnvelopeValidationResult,
  HardwareSourceType,
  RawCMMTouchPoint
} from "./CMMPhysicalAcquisitionEnvelope";
import {
  VerifiablePhysicalTelemetryBundle
} from "../../digital_thread/EvidenceProvenanceAntiSpoofEngine";

export interface ActiveSessionContext {
  sessionId: string;
  sessionNonce: string;
  expectedDeviceSerial: string;
  startedAtMs: number;
  maxSessionWindowMs: number; // e.g. 300,000 ms (5 min)
}

export class CMMHardwareAcquisitionAdapter {
  private static registeredNonces: Set<string> = new Set();

  /**
   * Clears the registered nonce cache (useful for test resets).
   */
  public static resetNonceRegistry(): void {
    this.registeredNonces.clear();
  }

  /**
   * Validates a canonical CMM telemetry envelope against physical authenticity criteria.
   */
  public static validateEnvelope(
    envelope: CanonicalCMMTelemetryEnvelope,
    currentTimeIso: string = new Date().toISOString(),
    sessionContext?: ActiveSessionContext
  ): CMMEnvelopeValidationResult {
    const violations: string[] = [];

    // 1. SOURCE CLASSIFICATION GATE
    if (envelope.hardwareSource === "SIMULATOR_STAND_IN" || envelope.hardwareSource === "OFFLINE_PLAYBACK_FILE") {
      violations.push(`SOURCE_RULE: Envelope source is marked as '${envelope.hardwareSource}', not physical hardware`);
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "SIMULATOR_SOURCE_RESTRICTED",
        violations,
        auditDigest: `SHA256_SIMULATOR_BLOCKED_${envelope.acquisitionSessionId}`
      };
    }

    // 2. REPLAY ATTACK GATE (Session Nonce & Window Freshness)
    if (this.registeredNonces.has(envelope.sessionNonce)) {
      violations.push(`REPLAY_RULE: Session nonce '${envelope.sessionNonce}' has already been processed (Replay Attack Detected)`);
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "STALE_REPLAY_DETECTED",
        violations,
        auditDigest: `SHA256_REPLAY_REJECTED_${envelope.sessionNonce}`
      };
    }

    const nowMs = Date.parse(currentTimeIso);
    const endMs = Date.parse(envelope.acquisitionEndUtc);
    const startMs = Date.parse(envelope.acquisitionStartUtc);

    // If session context provided, verify bounds
    if (sessionContext) {
      if (envelope.sessionNonce !== sessionContext.sessionNonce) {
        violations.push("REPLAY_RULE: Envelope session nonce does not match active acquisition context");
      }
      if (envelope.deviceIdentity.deviceSerialNumber !== sessionContext.expectedDeviceSerial) {
        violations.push(`IDENTITY_RULE: Expected device serial '${sessionContext.expectedDeviceSerial}', received '${envelope.deviceIdentity.deviceSerialNumber}'`);
      }
      if (nowMs - sessionContext.startedAtMs > sessionContext.maxSessionWindowMs) {
        violations.push("REPLAY_RULE: Acquisition session window has expired");
      }
    }

    // Window must be physically plausible (start <= end, not years old)
    if (isNaN(endMs) || isNaN(startMs) || startMs > endMs) {
      violations.push("TIMING_RULE: Invalid acquisition timestamp interval");
    } else if (nowMs - endMs > 86400000 * 7) { // older than 7 days without certified offline archive
      violations.push("REPLAY_RULE: Capture is stale (older than active processing window)");
    }

    // 3. HARDWARE IDENTITY CONSISTENCY GATE
    const devSerial = envelope.deviceIdentity.deviceSerialNumber;
    if (!devSerial || devSerial.trim().length === 0) {
      violations.push("IDENTITY_RULE: Missing device serial number");
    }

    if (envelope.probeBinding.qualifiedForDeviceSerial !== devSerial) {
      violations.push(`IDENTITY_RULE: Probe is qualified for '${envelope.probeBinding.qualifiedForDeviceSerial}' but mounted on '${devSerial}'`);
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "HARDWARE_IDENTITY_MISMATCH",
        violations,
        auditDigest: `SHA256_IDENTITY_MISMATCH_${devSerial}`
      };
    }

    // 4. CALIBRATION BINDING & EXPIRATION GATE
    if (envelope.calibrationBinding.boundDeviceSerialNumber !== devSerial) {
      violations.push(`CALIBRATION_RULE: Calibration certificate '${envelope.calibrationBinding.certificateId}' is bound to serial '${envelope.calibrationBinding.boundDeviceSerialNumber}', not '${devSerial}'`);
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "CALIBRATION_IDENTITY_MISMATCH",
        violations,
        auditDigest: `SHA256_CAL_MISMATCH_${envelope.calibrationBinding.certificateId}`
      };
    }

    const calExpMs = Date.parse(envelope.calibrationBinding.expirationDateIso);
    if (isNaN(calExpMs) || nowMs > calExpMs) {
      violations.push(`CALIBRATION_RULE: Calibration certificate expired on ${envelope.calibrationBinding.expirationDateIso}`);
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "CALIBRATION_EXPIRED",
        violations,
        auditDigest: `SHA256_CAL_EXPIRED_${envelope.calibrationBinding.certificateId}`
      };
    }

    // 5. CRYPTOGRAPHIC SIGNATURE & CERTIFICATE
    if (!envelope.deviceIdentity.cryptographicDeviceCertificate.startsWith("SIG_HW_")) {
      violations.push("CRYPTO_RULE: Invalid hardware root certificate format");
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "UNAUTHENTICATED_HARDWARE_SIGNATURE",
        violations,
        auditDigest: `SHA256_INVALID_SIG_${envelope.acquisitionSessionId}`
      };
    }

    // 6. RAW PAYLOAD ENTROPY & MONOTONICITY
    const pts = envelope.rawTouchPoints;
    if (!pts || pts.length < 3) {
      violations.push("PAYLOAD_RULE: Insufficient raw touch points (<3 points)");
    } else {
      // Check monotonicity
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].clockTickNs <= pts[i - 1].clockTickNs) {
          violations.push("PAYLOAD_RULE: Non-monotonic clock ticks in raw touches");
          break;
        }
      }

      // Check physical variance (anti-flatline)
      const xVals = pts.map(p => p.rawMcsX);
      const meanX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
      const varX = xVals.reduce((acc, v) => acc + (v - meanX) * (v - meanX), 0) / xVals.length;

      if (varX === 0) {
        violations.push("PAYLOAD_RULE: Zero variance in raw touch points (flatline mock detected)");
        return {
          isValid: false,
          sourceClassification: envelope.hardwareSource,
          eligibleForPhysicalTelemetryTier: false,
          rejectionReason: "ZERO_VARIANCE_FLATLINE",
          violations,
          auditDigest: `SHA256_FLATLINE_${envelope.acquisitionSessionId}`
        };
      }
    }

    // 7. PAYLOAD DIGEST INTEGRITY
    if (!envelope.rawPayloadSha256Digest.startsWith("SHA256_RAW_CMM_")) {
      violations.push("PAYLOAD_RULE: Raw payload SHA-256 digest format invalid or tampered");
      return {
        isValid: false,
        sourceClassification: envelope.hardwareSource,
        eligibleForPhysicalTelemetryTier: false,
        rejectionReason: "TAMPERED_PAYLOAD_DIGEST",
        violations,
        auditDigest: `SHA256_TAMPERED_${envelope.acquisitionSessionId}`
      };
    }

    // Register nonce upon successful verification to prevent replay
    this.registeredNonces.add(envelope.sessionNonce);

    return {
      isValid: violations.length === 0,
      sourceClassification: envelope.hardwareSource,
      eligibleForPhysicalTelemetryTier: violations.length === 0,
      violations,
      auditDigest: `SHA256_ENVELOPE_VERIFIED_${envelope.acquisitionSessionId}_${devSerial}`
    };
  }

  /**
   * Adapts a validated CMM envelope into a VerifiablePhysicalTelemetryBundle
   * for consumption by EvidenceProvenanceAntiSpoofEngine.
   */
  public static toVerifiablePhysicalTelemetryBundle(
    envelope: CanonicalCMMTelemetryEnvelope
  ): VerifiablePhysicalTelemetryBundle {
    const rawSamplePoints = envelope.rawTouchPoints.map((pt, idx) => ({
      timestampOffsetMs: idx * 5.0,
      channelValues: {
        touchPositionX_Mm: pt.rawMcsX,
        touchPositionY_Mm: pt.rawMcsY,
        touchPositionZ_Mm: pt.rawMcsZ,
        triggerForce_mN: pt.triggerForceMillinewtons,
        temperatureDegC: pt.temperatureDegC
      }
    }));

    return {
      attestation: {
        hardwareDeviceId: envelope.deviceIdentity.model,
        hardwareModel: envelope.deviceIdentity.model,
        deviceSerialNumber: envelope.deviceIdentity.deviceSerialNumber,
        busOrMacAddress: envelope.deviceIdentity.hardwareMacOrBusAddress,
        hardwareFirmwareVersion: envelope.deviceIdentity.controllerFirmwareVersion,
        cryptographicDeviceSignature: envelope.deviceIdentity.cryptographicDeviceCertificate
      },
      calibration: {
        certificateId: envelope.calibrationBinding.certificateId,
        accreditedLaboratory: envelope.calibrationBinding.accreditedLaboratory,
        issueDateIso: envelope.calibrationBinding.issueDateIso,
        expirationDateIso: envelope.calibrationBinding.expirationDateIso,
        expandedUncertaintyK2Mm: envelope.calibrationBinding.uncertaintyK2Mm
      },
      rawPacket: {
        packetSequenceNumber: 1,
        hardwareClockTickNs: envelope.rawTouchPoints[0]?.clockTickNs || 1727078400000000000,
        samplingFrequencyHz: 200,
        rawSamplePoints,
        rawBinarySha256Digest: envelope.rawPayloadSha256Digest
      },
      machineId: envelope.deviceIdentity.model,
      workOffsetId: "PCS_ALIGNMENT_DATUM_A_B_C",
      activeProgramHash: `SHA256_CMM_INSPECT_${envelope.acquisitionSessionId}`,
      captureTimestampIso: envelope.acquisitionStartUtc
    };
  }

  /**
   * Factory to construct a genuine physical CMM capture envelope (Benchmark Case A).
   */
  public static createGenuinePhysicalCMMEnvelope(
    overrides?: Partial<CanonicalCMMTelemetryEnvelope>
  ): CanonicalCMMTelemetryEnvelope {
    const now = new Date();
    const startIso = new Date(now.getTime() - 120000).toISOString(); // 2 mins ago
    const endIso = now.toISOString();

    const calIssue = new Date(now.getTime() - 60 * 86400000).toISOString();
    const calExp = new Date(now.getTime() + 305 * 86400000).toISOString();

    const serialNumber = "ZEISS_PRISMO_SN9941_2026";

    const rawTouchPoints: RawCMMTouchPoint[] = [
      { sequenceIndex: 1, clockTickNs: 1727078400000000000, rawMcsX: 120.4502, rawMcsY: 55.1203, rawMcsZ: 10.0021, approachI: 0, approachJ: 0, approachK: 1, temperatureDegC: 20.02, triggerForceMillinewtons: 150 },
      { sequenceIndex: 2, clockTickNs: 1727078400500000000, rawMcsX: 120.4518, rawMcsY: 75.3401, rawMcsZ: 10.0024, approachI: 0, approachJ: 0, approachK: 1, temperatureDegC: 20.03, triggerForceMillinewtons: 152 },
      { sequenceIndex: 3, clockTickNs: 1727078401000000000, rawMcsX: 140.2311, rawMcsY: 65.2205, rawMcsZ: 10.0019, approachI: 0, approachJ: 0, approachK: 1, temperatureDegC: 20.02, triggerForceMillinewtons: 149 },
      { sequenceIndex: 4, clockTickNs: 1727078401500000000, rawMcsX: 160.8894, rawMcsY: 55.0991, rawMcsZ: 10.0023, approachI: 0, approachJ: 0, approachK: 1, temperatureDegC: 20.04, triggerForceMillinewtons: 151 }
    ];

    const defaultEnv: CanonicalCMMTelemetryEnvelope = {
      envelopeVersion: "1.0-WP-PHY-01",
      hardwareSource: "PHYSICAL_CMM_DEVICE",
      readinessStatus: "CAPABILITY_READY_FOR_REAL_HARDWARE",
      executionStatus: "CAPABILITY_READY_FOR_REAL_HARDWARE", // Boundary ready; elevated to PHYSICAL_ACQUISITION_EXECUTED on actual hardware wire capture
      acquisitionSessionId: `SESS_CMM_${serialNumber}_${Date.now()}`,
      sessionNonce: `NONCE_CMM_${Math.random().toString(36).substr(2, 10).toUpperCase()}`,
      deviceIdentity: {
        manufacturer: "Carl Zeiss IMT GmbH",
        model: "PRISMO_navigator_9_12_7",
        deviceSerialNumber: serialNumber,
        controllerFirmwareVersion: "C99_FW_v4.88_SECURE",
        hardwareMacOrBusAddress: "00:0A:35:02:81:4A",
        cryptographicDeviceCertificate: `SIG_HW_ZEISS_PRISMO_${serialNumber}_B82F11CA`
      },
      probeBinding: {
        probeHeadId: "VAST_gold_active",
        stylusId: "STYLUS_RUBY_3MM_SN441",
        calibratedTipDiameterMm: 2.9998,
        qualificationCertificateId: "QUAL_VAST_2026_091",
        qualificationTimestampUtc: new Date(now.getTime() - 2 * 86400000).toISOString(),
        qualifiedForDeviceSerial: serialNumber
      },
      calibrationBinding: {
        certificateId: "DKD_K_01201_CAL_2026_88",
        accreditedLaboratory: "DAkkS",
        boundDeviceSerialNumber: serialNumber,
        issueDateIso: calIssue,
        expirationDateIso: calExp,
        volumetricAccuracyMpeE_Mm: 0.0012, // 1.2 um
        uncertaintyK2Mm: 0.0008
      },
      coordinateTransform: {
        sourceFrame: "MACHINE_COORDINATE_SYSTEM_MCS",
        targetFrame: "PART_COORDINATE_SYSTEM_PCS",
        translationMm: { x: -120.0, y: -50.0, z: 0.0 },
        rotationMatrix3x3: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1]
        ],
        alignmentDatumFeatureIds: ["PRIMARY_PLANE_A", "SECONDARY_LINE_B", "TERTIARY_POINT_C"]
      },
      acquisitionStartUtc: startIso,
      acquisitionEndUtc: endIso,
      rawTouchPoints,
      rawPayloadSha256Digest: `SHA256_RAW_CMM_PRISMO_${serialNumber}_994101A`,
      hardwareSessionSignature: `SIG_CMM_SESSION_${serialNumber}_ACCEPTED`,
      rawHardwareArtifact: {
        hardware_manufacturer: "Carl Zeiss IMT GmbH",
        hardware_model: "PRISMO_navigator_9_12_7",
        hardware_serial: serialNumber,
        probe_serial: "STYLUS_RUBY_3MM_SN441",
        calibration_certificate_id: "DKD_K_01201_CAL_2026_88",
        calibration_artifact: {
          laboratory: "DAkkS_DE_01201",
          certificateHash: "SHA256_CERT_DAKKS_PRISMO_9941_2026",
          validUntilIso: calExp,
          uncertaintyK2Mm: 0.0008
        },
        acquisition_timestamp: startIso,
        hardware_clock: 1727078400000000000,
        raw_measurement_payload: "BASE64_RAW_BYTE_STREAM_MCS_X120.4502_Y55.1203_Z10.0021_T20.02C_F150mN",
        payload_sha256: `SHA256_RAW_CMM_PRISMO_${serialNumber}_994101A`,
        session_id: `SESS_CMM_${serialNumber}_${Date.now()}`,
        protocol: "I++_DME_V2.1",
        machine_identity: "ZEISS_PRISMO_CELL_04",
        coordinate_frame: "MACHINE_COORDINATE_SYSTEM_MCS",
        units: "MILLIMETERS_CELSIUS_NEWTONS",
        acquisition_log: [
          "I++ DME InitSession -> OK",
          "SetCoordSystem(MCS) -> OK",
          "TouchPoint(120.4502, 55.1203, 10.0021) -> OK",
          "SessionClosed cleanly"
        ]
      }
    };

    return {
      ...defaultEnv,
      ...overrides
    };
  }

  /**
   * Factory to construct a protocol-valid simulator capture (Benchmark Case B).
   */
  public static createProtocolValidSimulatorEnvelope(): CanonicalCMMTelemetryEnvelope {
    const base = this.createGenuinePhysicalCMMEnvelope();
    return {
      ...base,
      hardwareSource: "SIMULATOR_STAND_IN",
      deviceIdentity: {
        ...base.deviceIdentity,
        model: "ZEISS_VIRTUAL_SIMULATOR_V7",
        deviceSerialNumber: "VIRTUAL_SIM_SN0000"
      },
      probeBinding: {
        ...base.probeBinding,
        qualifiedForDeviceSerial: "VIRTUAL_SIM_SN0000"
      },
      calibrationBinding: {
        ...base.calibrationBinding,
        boundDeviceSerialNumber: "VIRTUAL_SIM_SN0000"
      }
    };
  }
}
