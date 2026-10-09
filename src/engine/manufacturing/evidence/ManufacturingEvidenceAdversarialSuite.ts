/**
 * SECP Industrial OS v2 — Manufacturing Evidence Adversarial Suite
 * Security, Tamper & Integrity Tests for Evidence Chain
 */

import { ManufacturingEvidenceEngine } from "./ManufacturingEvidenceEngine";
import { ManufacturingEvidenceVerifier } from "./ManufacturingEvidenceVerifier";
import { EvidenceCorroborationEngine } from "./EvidenceCorroborationEngine";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";
import { IndependentManufacturingEvidenceVerifier } from "./IndependentManufacturingEvidenceVerifier";
import { ManufacturingEvidenceBundleEngine } from "./ManufacturingEvidenceBundleEngine";
import {
  EvidenceType,
  EvidenceSourceType,
  EventType,
  ManufacturingEvidenceStatus,
  ConflictResolutionStatus,
} from "./types";

export interface AdversarialTestResult {
  testName: string;
  category: string;
  passed: boolean;
  expectedBehavior: string;
  observedBehavior: string;
}

export class ManufacturingEvidenceAdversarialSuite {
  public runAdversarialSuite(): AdversarialTestResult[] {
    const results: AdversarialTestResult[] = [];

    // Test 1: Duplicate Evidence ID Rejection
    try {
      const engine = new ManufacturingEvidenceEngine();
      engine.captureEvidence({
        evidenceId: "EV_DUP_01",
        evidenceType: EvidenceType.DESIGN_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_01", sourceRevision: "1.0", sourceFingerprint: "FNG_01" },
        eventIdentity: { eventId: "EVT_01", eventType: EventType.JOB_CREATED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "CAD_01",
        sourceRevision: "1.0",
        producerId: "CAD_SYS",
        producerType: EvidenceSourceType.CAD,
        payload: { name: "Test Part" },
      });
      engine.captureEvidence({
        evidenceId: "EV_DUP_01", // Duplicate ID
        evidenceType: EvidenceType.DESIGN_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_01", sourceRevision: "1.0", sourceFingerprint: "FNG_01" },
        eventIdentity: { eventId: "EVT_02", eventType: EventType.JOB_RELEASED, eventSequence: 2, eventTimestamp: 1001, sourceTimestamp: 1001, recordedTimestamp: 1001 },
        sourceArtifactId: "CAD_01",
        sourceRevision: "1.0",
        producerId: "CAD_SYS",
        producerType: EvidenceSourceType.CAD,
        payload: { name: "Duplicate" },
      });
      results.push({
        testName: "Duplicate Evidence ID Rejection",
        category: "Identity Integrity",
        passed: false,
        expectedBehavior: "Should throw error on duplicate evidenceId",
        observedBehavior: "Duplicate evidenceId was accepted without error",
      });
    } catch (err: any) {
      results.push({
        testName: "Duplicate Evidence ID Rejection",
        category: "Identity Integrity",
        passed: true,
        expectedBehavior: "Should throw error on duplicate evidenceId",
        observedBehavior: `Caught expected error: ${err.message}`,
      });
    }

    // Test 2: Payload Tampering & Content Hash Mismatch
    {
      const sigVerifier = new EvidenceSignatureVerifier();
      const corrEngine = new EvidenceCorroborationEngine();
      const verifier = new ManufacturingEvidenceVerifier(sigVerifier, corrEngine);
      const engine = new ManufacturingEvidenceEngine(sigVerifier);

      const record = engine.captureEvidence({
        evidenceId: "EV_TAMP_01",
        evidenceType: EvidenceType.MATERIAL_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.MES, sourceId: "MES_01", sourceRevision: "1.0", sourceFingerprint: "FNG_02" },
        eventIdentity: { eventId: "EVT_MAT_01", eventType: EventType.MATERIAL_LOADED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "MAT_01",
        sourceRevision: "1.0",
        producerId: "MES_OPERATOR",
        producerType: EvidenceSourceType.MES,
        payload: { materialGrade: "Titanium Ti-6Al-4V" },
      });

      // Tamper payload directly after record generation
      record.payload.materialGrade = "Forged Steel (Tampered)";

      const verifyRes = verifier.verifyEvidenceChain([record]);
      const hasHashFailure = verifyRes.criticalFailures.includes("HASH_MISMATCH");
      results.push({
        testName: "Payload Tampering Hash Mismatch",
        category: "Integrity",
        passed: hasHashFailure,
        expectedBehavior: "Detect payload alteration via content hash mismatch",
        observedBehavior: hasHashFailure ? "HASH_MISMATCH detected successfully" : "Failed to detect payload tampering",
      });
    }

    // Test 3: Chain Gap Detection (Sequence 1 -> Sequence 3)
    {
      const verifier = new ManufacturingEvidenceVerifier();
      const engine = new ManufacturingEvidenceEngine();

      const r1 = engine.captureEvidence({
        evidenceId: "EV_GAP_1",
        evidenceType: EvidenceType.DESIGN_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_01", sourceRevision: "1.0", sourceFingerprint: "FNG_01" },
        eventIdentity: { eventId: "EVT_1", eventType: EventType.JOB_CREATED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "CAD_01",
        sourceRevision: "1.0",
        producerId: "CAD_SYS",
        producerType: EvidenceSourceType.CAD,
        payload: { name: "Part A" },
        forcedChainSequence: 1,
      });

      const r2 = engine.captureEvidence({
        evidenceId: "EV_GAP_3",
        evidenceType: EvidenceType.MATERIAL_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.MES, sourceId: "MES_01", sourceRevision: "1.0", sourceFingerprint: "FNG_02" },
        eventIdentity: { eventId: "EVT_3", eventType: EventType.MATERIAL_LOADED, eventSequence: 3, eventTimestamp: 1002, sourceTimestamp: 1002, recordedTimestamp: 1002 },
        sourceArtifactId: "MAT_01",
        sourceRevision: "1.0",
        producerId: "MES_SYS",
        producerType: EvidenceSourceType.MES,
        payload: { materialGrade: "Al 6061-T6" },
        forcedChainSequence: 3, // Skipped sequence 2
      });

      const verifyRes = verifier.verifyEvidenceChain([r1, r2]);
      const hasChainGap = verifyRes.criticalFailures.includes("BROKEN_CRITICAL_CHAIN");
      results.push({
        testName: "Chain Gap Detection",
        category: "Sequence Integrity",
        passed: hasChainGap,
        expectedBehavior: "Detect missing sequence number in critical chain",
        observedBehavior: hasChainGap ? "BROKEN_CRITICAL_CHAIN detected on missing sequence 2" : "Failed to detect chain gap",
      });
    }

    // Test 4: Forged Signature Detection
    {
      const verifier = new ManufacturingEvidenceVerifier();
      const engine = new ManufacturingEvidenceEngine();

      const record = engine.captureEvidence({
        evidenceId: "EV_SIG_FORGE",
        evidenceType: EvidenceType.TOOL_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "CAM_01", sourceRevision: "1.0", sourceFingerprint: "FNG_03" },
        eventIdentity: { eventId: "EVT_TOOL", eventType: EventType.TOOL_LOADED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "TOOL_01",
        sourceRevision: "1.0",
        producerId: "CAM_SYS",
        producerType: EvidenceSourceType.CAM,
        payload: { toolDiameter: 10.0 },
        signingKeyRef: "KEY_CAM_ENG_01",
      });

      // Alter signature
      record.contract.signature = "FORGED_SIGNATURE_INVALID_1234567890abcdef";

      const verifyRes = verifier.verifyEvidenceChain([record]);
      const hasForgedSig = verifyRes.criticalFailures.includes("FORGED_SIGNATURE");
      results.push({
        testName: "Forged Signature Invalidation",
        category: "Authenticity",
        passed: hasForgedSig,
        expectedBehavior: "Flag invalid signature as FORGED_SIGNATURE",
        observedBehavior: hasForgedSig ? "FORGED_SIGNATURE flagged correctly" : "Failed to flag forged signature",
      });
    }

    // Test 5: Source Conflict (CNC Completed vs Telemetry Aborted)
    {
      const corrEngine = new EvidenceCorroborationEngine();
      const engine = new ManufacturingEvidenceEngine();

      const cncRec = engine.captureEvidence({
        evidenceId: "EV_CNC_COMP",
        evidenceType: EvidenceType.EXECUTION_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "CNC_01", sourceRevision: "1.0", sourceFingerprint: "FNG_CNC" },
        eventIdentity: { eventId: "EVT_CNC", eventType: EventType.EXECUTION_COMPLETED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "NC_01",
        sourceRevision: "1.0",
        producerId: "FANUC_31I",
        producerType: EvidenceSourceType.CNC,
        payload: { status: "COMPLETED", programHash: "HASH_NC_01" },
      });

      const telRec = engine.captureEvidence({
        evidenceId: "EV_TEL_ABORT",
        evidenceType: EvidenceType.TELEMETRY_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.SENSOR, sourceId: "SENS_POWER_01", sourceRevision: "1.0", sourceFingerprint: "FNG_SENS" },
        eventIdentity: { eventId: "EVT_TEL", eventType: EventType.PROGRAM_ABORTED, eventSequence: 2, eventTimestamp: 1001, sourceTimestamp: 1001, recordedTimestamp: 1001 },
        sourceArtifactId: "NC_01",
        sourceRevision: "1.0",
        producerId: "IOT_GATEWAY",
        producerType: EvidenceSourceType.SENSOR,
        payload: { status: "ABORTED", reason: "Spindle power loss" },
      });

      const corrRes = corrEngine.corroborateRecords([cncRec, telRec]);
      const isConflicting = corrRes.verdict === "CONFLICTING" && corrRes.conflicts.length > 0;
      results.push({
        testName: "Source Conflict Detection (CNC vs Telemetry)",
        category: "Corroboration",
        passed: isConflicting,
        expectedBehavior: "Detect conflict between CNC completion and telemetry abort",
        observedBehavior: isConflicting ? "EVIDENCE_CONFLICT detected correctly" : "Failed to detect execution status conflict",
      });
    }

    // Test 6: Program Hash Mismatch (Verified NC vs Executed NC)
    {
      const verifier = new ManufacturingEvidenceVerifier();
      const engine = new ManufacturingEvidenceEngine();

      const ncVerified = engine.captureEvidence({
        evidenceId: "EV_NC_VERIF",
        evidenceType: EvidenceType.NC_PROGRAM_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.VERIFIER, sourceId: "VERIF_01", sourceRevision: "1.0", sourceFingerprint: "FNG_VER" },
        eventIdentity: { eventId: "EVT_VER", eventType: EventType.PROGRAM_VERIFIED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "NC_VERIFIED_01",
        sourceRevision: "1.0",
        producerId: "GCODE_VERIFIER",
        producerType: EvidenceSourceType.VERIFIER,
        payload: { programHash: "VERIFIED_HASH_ABC123" },
      });

      const execRec = engine.captureEvidence({
        evidenceId: "EV_NC_EXEC",
        evidenceType: EvidenceType.EXECUTION_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "CNC_01", sourceRevision: "1.0", sourceFingerprint: "FNG_CNC" },
        eventIdentity: { eventId: "EVT_EXEC", eventType: EventType.EXECUTION_STARTED, eventSequence: 2, eventTimestamp: 1001, sourceTimestamp: 1001, recordedTimestamp: 1001 },
        sourceArtifactId: "NC_RUNNING_01",
        sourceRevision: "1.0",
        producerId: "FANUC_31I",
        producerType: EvidenceSourceType.CNC,
        payload: { programHash: "UNVERIFIED_MODIFIED_HASH_XYZ999" }, // Hash mismatch!
      });

      const verifyRes = verifier.verifyEvidenceChain([ncVerified, execRec]);
      const hasProgramMismatch = verifyRes.criticalFailures.includes("PROGRAM_HASH_MISMATCH");
      results.push({
        testName: "Program Hash Mismatch Prevention",
        category: "Physical-Digital Alignment",
        passed: hasProgramMismatch,
        expectedBehavior: "Flag PROGRAM_HASH_MISMATCH when executed G-code differs from verified G-code",
        observedBehavior: hasProgramMismatch ? "PROGRAM_HASH_MISMATCH flagged correctly" : "Failed to catch executed program mismatch",
      });
    }

    // Test 7: Calibration Invalid Instrument Invalidation
    {
      const verifier = new ManufacturingEvidenceVerifier();
      const engine = new ManufacturingEvidenceEngine();

      const inspRec = engine.captureEvidence({
        evidenceId: "EV_INSP_INVALID_CAL",
        evidenceType: EvidenceType.INSPECTION_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.INSPECTION_SYSTEM, sourceId: "CMM_01", sourceRevision: "1.0", sourceFingerprint: "FNG_CMM" },
        eventIdentity: { eventId: "EVT_CMM", eventType: EventType.INSPECTION_COMPLETED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "INSP_PLAN_01",
        sourceRevision: "1.0",
        producerId: "ZEISS_PRISMA",
        producerType: EvidenceSourceType.INSPECTION_SYSTEM,
        payload: {
          measurements: [
            {
              measurementId: "M01",
              featureId: "F_BORE_01",
              nominalValue: 25.0,
              measuredValue: 25.002,
              unit: "mm",
              tolerance: { upper: 0.01, lower: -0.01 },
              instrumentId: "PROBE_01",
              calibrationStatus: "CALIBRATION_INVALID", // Invalid calibration!
            },
          ],
        },
      });

      const verifyRes = verifier.verifyEvidenceChain([inspRec]);
      const hasInspContextInvalid = verifyRes.criticalFailures.includes("INSPECTION_CONTEXT_INVALID");
      results.push({
        testName: "Invalid Instrument Calibration Invalidation",
        category: "Inspection Integrity",
        passed: hasInspContextInvalid,
        expectedBehavior: "Flag INSPECTION_CONTEXT_INVALID when measuring instrument calibration is invalid",
        observedBehavior: hasInspContextInvalid ? "INSPECTION_CONTEXT_INVALID flagged correctly" : "Failed to catch invalid calibration",
      });
    }

    // Test 8: Bundle Tampering & Independent Reproducibility
    {
      const engine = new ManufacturingEvidenceEngine();
      const rec = engine.captureEvidence({
        evidenceId: "EV_BND_01",
        evidenceType: EvidenceType.DESIGN_EVIDENCE,
        sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_01", sourceRevision: "1.0", sourceFingerprint: "FNG_01" },
        eventIdentity: { eventId: "EVT_01", eventType: EventType.JOB_CREATED, eventSequence: 1, eventTimestamp: 1000, sourceTimestamp: 1000, recordedTimestamp: 1000 },
        sourceArtifactId: "CAD_01",
        sourceRevision: "1.0",
        producerId: "CAD_SYS",
        producerType: EvidenceSourceType.CAD,
        payload: { designName: "Part X" },
      });

      const bundle = ManufacturingEvidenceBundleEngine.createBundle("BND_01", "JOB_100", 1, [rec], "KEY_CAD_RELEASE_01");

      // Tamper manifest inside bundle
      bundle.manifest.evidenceItems[0].hash = "TAMPERED_MANIFEST_HASH_9999";

      const independentVerifier = new IndependentManufacturingEvidenceVerifier();
      const res = independentVerifier.verifyBundle(bundle, [rec]);

      const failedTamper = !res.reproducible && res.failedChecks.includes("INDEPENDENT_MANIFEST_HASH_MISMATCH");
      results.push({
        testName: "Bundle Manifest Tampering Detection",
        category: "Forensic Reproducibility",
        passed: failedTamper,
        expectedBehavior: "Detect bundle tampering via independent verifier",
        observedBehavior: failedTamper ? "INDEPENDENT_MANIFEST_HASH_MISMATCH caught successfully" : "Failed to detect bundle tampering",
      });
    }

    return results;
  }
}
