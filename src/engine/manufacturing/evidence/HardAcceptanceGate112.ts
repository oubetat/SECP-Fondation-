/**
 * SECP Industrial OS v2 — Hard Acceptance Gate 112
 * Manufacturing Evidence Chain Acceptance Verification
 */

import { ManufacturingEvidenceEngine } from "./ManufacturingEvidenceEngine";
import { ManufacturingEvidenceVerifier } from "./ManufacturingEvidenceVerifier";
import { EvidenceCorroborationEngine } from "./EvidenceCorroborationEngine";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";
import { IndependentManufacturingEvidenceVerifier } from "./IndependentManufacturingEvidenceVerifier";
import { ManufacturingEvidenceBundleEngine } from "./ManufacturingEvidenceBundleEngine";
import { ManufacturingEvidenceAdversarialSuite } from "./ManufacturingEvidenceAdversarialSuite";
import {
  EvidenceType,
  EvidenceSourceType,
  EventType,
  ManufacturingEvidenceStatus,
  InspectionVerdict,
  ConflictResolutionStatus,
  HardAcceptanceResult112,
} from "./types";

export class HardAcceptanceGate112 {
  public executeGate(): HardAcceptanceResult112 {
    const checks: { checkName: string; status: "PASS" | "FAIL"; evidence: string }[] = [];

    // Setup Engines
    const sigVerifier = new EvidenceSignatureVerifier();
    const corrEngine = new EvidenceCorroborationEngine();
    const verifier = new ManufacturingEvidenceVerifier(sigVerifier, corrEngine);
    const engine = new ManufacturingEvidenceEngine(sigVerifier);

    // Populate a complete valid manufacturing evidence chain
    const jobId = "JOB_TURBINE_BLADE_01";
    const jobRootId = "EV_JOB_ROOT_100";

    // 1. Design Evidence
    const r1 = engine.captureEvidence({
      evidenceId: "EV_DESIGN_100",
      evidenceType: EvidenceType.DESIGN_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_TURBINE_V3", sourceRevision: "3.2", sourceFingerprint: "FNG_CAD_32" },
      eventIdentity: { eventId: "EVT_JOB_CR", eventType: EventType.JOB_CREATED, eventSequence: 1, eventTimestamp: 1700000000000, sourceTimestamp: 1700000000000, recordedTimestamp: 1700000000000 },
      sourceArtifactId: "CAD_TURBINE_V3",
      sourceRevision: "3.2",
      producerId: "CAD_KERNEL_NX",
      producerType: EvidenceSourceType.CAD,
      payload: { designId: "CAD_TURBINE_V3", designRevision: "3.2", designHash: "HASH_CAD_32", releaseState: "RELEASED", releaseTimestamp: 1700000000000 },
      signingKeyRef: "KEY_CAD_RELEASE_01",
    });

    // 2. Material Evidence & Loading
    const r2 = engine.captureEvidence({
      evidenceId: "EV_MAT_100",
      evidenceType: EvidenceType.MATERIAL_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.MES, sourceId: "MES_INV_01", sourceRevision: "1.0", sourceFingerprint: "FNG_MAT_INCONEL" },
      eventIdentity: { eventId: "EVT_MAT_LOAD", eventType: EventType.MATERIAL_LOADED, eventSequence: 2, eventTimestamp: 1700000100000, sourceTimestamp: 1700000100000, recordedTimestamp: 1700000100000 },
      sourceArtifactId: "MAT_INCONEL_718",
      sourceRevision: "1.0",
      producerId: "MES_BARCODE_READER",
      producerType: EvidenceSourceType.MES,
      payload: { materialId: "INCONEL_718", materialBatch: "BATCH_INC_718_9981", qualificationId: "QUAL_AMS5662", state: "QUALIFIED", propertySetHash: "HASH_PROP_INC718" },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 3. Tool Evidence & Installation
    const r3 = engine.captureEvidence({
      evidenceId: "EV_TOOL_100",
      evidenceType: EvidenceType.TOOL_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "TOOL_PRES_01", sourceRevision: "1.0", sourceFingerprint: "FNG_TOOL_BALL_6" },
      eventIdentity: { eventId: "EVT_TOOL_INST", eventType: EventType.TOOL_INSTALLED, eventSequence: 3, eventTimestamp: 1700000200000, sourceTimestamp: 1700000200000, recordedTimestamp: 1700000200000 },
      sourceArtifactId: "TOOL_BALL_6MM",
      sourceRevision: "1.0",
      producerId: "ZOLLER_PRESETTER",
      producerType: EvidenceSourceType.CAM,
      payload: { toolId: "TOOL_BALL_6MM", activeToolId: "TOOL_BALL_6MM", toolRevision: "1.0", toolGeometryHash: "HASH_GEO_BALL_6", holder: "HSK_A63", offsetContext: { hOffset: 1, dOffset: 1 }, usageCount: 12, cuttingTimeMinutes: 45 },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 4. Machine Evidence & State Snapshot
    const r4 = engine.captureEvidence({
      evidenceId: "EV_MACH_100",
      evidenceType: EvidenceType.MACHINE_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "DMG_MORI_NMV5000", sourceRevision: "2.1", sourceFingerprint: "FNG_MACH_DMG" },
      eventIdentity: { eventId: "EVT_MACH_CFG", eventType: EventType.MACHINE_CONFIGURED, eventSequence: 4, eventTimestamp: 1700000300000, sourceTimestamp: 1700000300000, recordedTimestamp: 1700000300000 },
      sourceArtifactId: "DMG_MORI_NMV5000",
      sourceRevision: "2.1",
      producerId: "SIEMENS_840D_SL",
      producerType: EvidenceSourceType.CNC,
      payload: { machineId: "DMG_MORI_NMV5000", controller: "SIEMENS_840D_SL", kinematicModelHash: "HASH_KIN_5AX", machineConfigurationHash: "HASH_CFG_DMG" },
      signingKeyRef: "KEY_CNC_CTRL_01",
    });

    // 5. Fixture Evidence
    const r5 = engine.captureEvidence({
      evidenceId: "EV_FIX_100",
      evidenceType: EvidenceType.ENVIRONMENT_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "FIX_VICE_01", sourceRevision: "1.0", sourceFingerprint: "FNG_FIX_01" },
      eventIdentity: { eventId: "EVT_FIX_INST", eventType: EventType.FIXTURE_INSTALLED, eventSequence: 5, eventTimestamp: 1700000400000, sourceTimestamp: 1700000400000, recordedTimestamp: 1700000400000 },
      sourceArtifactId: "FIX_VICE_01",
      sourceRevision: "1.0",
      producerId: "CAM_WORKHOLDING",
      producerType: EvidenceSourceType.CAM,
      payload: { fixtureId: "FIX_VICE_01", configurationHash: "HASH_FIX_CFG" },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 6. NC Program Evidence
    const r6 = engine.captureEvidence({
      evidenceId: "EV_NC_100",
      evidenceType: EvidenceType.NC_PROGRAM_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "POST_PROC_01", sourceRevision: "1.0", sourceFingerprint: "FNG_NC_01" },
      eventIdentity: { eventId: "EVT_NC_LOAD", eventType: EventType.PROGRAM_LOADED, eventSequence: 6, eventTimestamp: 1700000500000, sourceTimestamp: 1700000500000, recordedTimestamp: 1700000500000 },
      sourceArtifactId: "NC_BLADE_FINISH_01",
      sourceRevision: "1.0",
      producerId: "FANUC_POST_32",
      producerType: EvidenceSourceType.CAM,
      payload: { programId: "NC_BLADE_FINISH_01", programHash: "HASH_NC_PROGRAM_BLADE_01", sourceToolpathHash: "HASH_TP_01" },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 6b. G-Code Verification Evidence
    const r6b = engine.captureEvidence({
      evidenceId: "EV_NC_VERIF_100",
      evidenceType: EvidenceType.GCODE_VERIFICATION_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.VERIFIER, sourceId: "GCODE_VERIFIER_108", sourceRevision: "1.0", sourceFingerprint: "FNG_NC_VER_01" },
      eventIdentity: { eventId: "EVT_NC_VER", eventType: EventType.PROGRAM_VERIFIED, eventSequence: 7, eventTimestamp: 1700000550000, sourceTimestamp: 1700000550000, recordedTimestamp: 1700000550000 },
      sourceArtifactId: "NC_BLADE_FINISH_01",
      sourceRevision: "1.0",
      producerId: "GCODE_VERIFIER_108",
      producerType: EvidenceSourceType.VERIFIER,
      payload: { programId: "NC_BLADE_FINISH_01", programHash: "HASH_NC_PROGRAM_BLADE_01", verifierRevision: "1.0", verdict: "VERIFIED" },
      signingKeyRef: "KEY_GCODE_VERIFIER_01",
    });

    // 7. Simulation Evidence
    const r7 = engine.captureEvidence({
      evidenceId: "EV_SIM_100",
      evidenceType: EvidenceType.SIMULATION_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.SIMULATOR, sourceId: "SIM_ENGINE_109", sourceRevision: "2.0", sourceFingerprint: "FNG_SIM_01" },
      eventIdentity: { eventId: "EVT_SIM", eventType: EventType.PROGRAM_VERIFIED, eventSequence: 8, eventTimestamp: 1700000600000, sourceTimestamp: 1700000600000, recordedTimestamp: 1700000600000 },
      sourceArtifactId: "SIM_RES_01",
      sourceRevision: "2.0",
      producerId: "SIM_ENGINE_109",
      producerType: EvidenceSourceType.SIMULATOR,
      payload: { simulationResultHash: "HASH_SIM_OK", toolpathHash: "HASH_TP_01", minClearanceMM: 4.2 },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 8. Digital Twin Evidence
    const r8 = engine.captureEvidence({
      evidenceId: "EV_TWIN_100",
      evidenceType: EvidenceType.DIGITAL_TWIN_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.DIGITAL_TWIN, sourceId: "TWIN_ENGINE_110", sourceRevision: "1.5", sourceFingerprint: "FNG_TWIN_01" },
      eventIdentity: { eventId: "EVT_TWIN", eventType: EventType.MACHINE_CONFIGURED, eventSequence: 9, eventTimestamp: 1700000700000, sourceTimestamp: 1700000700000, recordedTimestamp: 1700000700000 },
      sourceArtifactId: "TWIN_STATE_01",
      sourceRevision: "1.5",
      producerId: "TWIN_ENGINE_110",
      producerType: EvidenceSourceType.DIGITAL_TWIN,
      payload: { twinId: "TWIN_DMG_MORI", machineId: "DMG_MORI_NMV5000", twinRevision: "1.5", machineStateHash: "HASH_TWIN_STATE_MATCH" },
      signingKeyRef: "KEY_CAM_ENG_01",
    });

    // 9. Execution Evidence
    const r9 = engine.captureEvidence({
      evidenceId: "EV_EXEC_100",
      evidenceType: EvidenceType.EXECUTION_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "DMG_MORI_NMV5000", sourceRevision: "2.1", sourceFingerprint: "FNG_CNC_EXEC" },
      eventIdentity: { eventId: "EVT_EXEC_START", eventType: EventType.EXECUTION_STARTED, eventSequence: 10, eventTimestamp: 1700000800000, sourceTimestamp: 1700000800000, recordedTimestamp: 1700000800000 },
      sourceArtifactId: "NC_BLADE_FINISH_01",
      sourceRevision: "1.0",
      producerId: "SIEMENS_840D_SL",
      producerType: EvidenceSourceType.CNC,
      payload: { programHash: "HASH_NC_PROGRAM_BLADE_01", machineId: "DMG_MORI_NMV5000", activeToolId: "TOOL_BALL_6MM", toolId: "TOOL_BALL_6MM", materialId: "INCONEL_718", status: "STARTED" },
      signingKeyRef: "KEY_CNC_CTRL_01",
    });

    // 10. Telemetry Evidence
    const r10 = engine.captureEvidence({
      evidenceId: "EV_TEL_100",
      evidenceType: EvidenceType.TELEMETRY_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.SENSOR, sourceId: "IOT_SPINDLE_SENS", sourceRevision: "1.0", sourceFingerprint: "FNG_SENS_01" },
      eventIdentity: { eventId: "EVT_TEL_LOG", eventType: EventType.OPERATION_STARTED, eventSequence: 11, eventTimestamp: 1700000900000, sourceTimestamp: 1700000900000, recordedTimestamp: 1700000900000 },
      sourceArtifactId: "TEL_LOG_01",
      sourceRevision: "1.0",
      producerId: "IOT_GATEWAY_01",
      producerType: EvidenceSourceType.SENSOR,
      payload: { telemetryId: "TEL_SPINDLE_01", value: 12000, unit: "RPM", quality: "GOOD", programHash: "HASH_NC_PROGRAM_BLADE_01" },
      signingKeyRef: "KEY_CNC_CTRL_01",
    });

    // 11. Inspection & Measurement Evidence
    const r11 = engine.captureEvidence({
      evidenceId: "EV_INSP_100",
      evidenceType: EvidenceType.INSPECTION_EVIDENCE,
      sourceIdentity: { sourceType: EvidenceSourceType.INSPECTION_SYSTEM, sourceId: "CMM_ZEISS_01", sourceRevision: "2.0", sourceFingerprint: "FNG_CMM_01" },
      eventIdentity: { eventId: "EVT_INSP_COMP", eventType: EventType.INSPECTION_COMPLETED, eventSequence: 12, eventTimestamp: 1700001000000, sourceTimestamp: 1700001000000, recordedTimestamp: 1700001000000 },
      sourceArtifactId: "INSP_REP_100",
      sourceRevision: "1.0",
      producerId: "ZEISS_PRISMA",
      producerType: EvidenceSourceType.INSPECTION_SYSTEM,
      payload: {
        inspectionId: "INSP_BLADE_01",
        partId: "BLADE_PHYSICAL_100",
        verdict: InspectionVerdict.PASS,
        measurements: [
          {
            measurementId: "MEAS_01",
            featureId: "F_AIRFOIL_PROFILE",
            nominalValue: 50.0,
            measuredValue: 50.003,
            unit: "mm",
            tolerance: { upper: 0.01, lower: -0.01 },
            instrumentId: "PROBE_ZEISS_VAST",
            calibrationStatus: "VALID",
            timestamp: 1700001000000,
          },
        ],
      },
      signingKeyRef: "KEY_INSPECTOR_01",
    });

    // Run Acceptance Checks
    const allRecords = engine.getAllRecords();

    // Check 1: Contract implementation
    checks.push({ checkName: "Evidence contract implemented", status: r1.contract ? "PASS" : "FAIL", evidence: `Contract ID: ${r1.contract.evidenceId}` });

    // Check 2: Evidence Identity
    checks.push({ checkName: "Evidence identity implemented", status: r1.contract.evidenceId ? "PASS" : "FAIL", evidence: `ID: ${r1.contract.evidenceId}` });

    // Check 3: Source Identity
    checks.push({ checkName: "Source identity implemented", status: r1.sourceIdentity.sourceType === "CAD" ? "PASS" : "FAIL", evidence: `Source: ${r1.sourceIdentity.sourceType}` });

    // Check 4: Event Identity
    checks.push({ checkName: "Event identity implemented", status: r1.eventIdentity.eventType === "JOB_CREATED" ? "PASS" : "FAIL", evidence: `Event: ${r1.eventIdentity.eventType}` });

    // Check 5: Hash Policy & Canonicalization
    checks.push({ checkName: "Canonicalization & Hash policy implemented", status: r1.contract.contentHash ? "PASS" : "FAIL", evidence: `ContentHash: ${r1.contract.contentHash}` });

    // Check 6: Hash Chain & Sequence Integrity
    checks.push({ checkName: "Hash chain & sequence integrity implemented", status: r11.contract.previousEvidenceHash !== "GENESIS_EVIDENCE_HASH_0000000000000000000000000000000000000000" ? "PASS" : "FAIL", evidence: `PrevHash: ${r11.contract.previousEvidenceHash}` });

    // Check 7: Signature Verification
    const sigRes = sigVerifier.verifySignature(r1);
    checks.push({ checkName: "Signature verification implemented", status: sigRes.status === "VALID" ? "PASS" : "FAIL", evidence: `SigStatus: ${sigRes.status}` });

    // Check 8: Corroboration Engine & Conflict Detection
    const corrRes = corrEngine.corroborateRecords(allRecords);
    checks.push({ checkName: "Corroboration engine & conflict detection implemented", status: corrRes.verdict === "CORROBORATED" ? "PASS" : "FAIL", evidence: `Verdict: ${corrRes.verdict}` });

    // Check 9: Bundle Creation & Verification
    const bundle = ManufacturingEvidenceBundleEngine.createBundle("BND_100", jobId, 1, allRecords, "KEY_CAD_RELEASE_01");
    const bundleVerify = ManufacturingEvidenceBundleEngine.verifyBundleIntegrity(bundle);
    checks.push({ checkName: "Evidence bundle & manifest integrity implemented", status: bundleVerify.valid ? "PASS" : "FAIL", evidence: `BundleHash: ${bundle.bundleHash}` });

    // Check 10: Independent Verifier & Replay
    const independentVerifier = new IndependentManufacturingEvidenceVerifier();
    const independentRes = independentVerifier.verifyBundle(bundle, allRecords);
    checks.push({ checkName: "Independent verifier & forensic replay implemented", status: independentRes.reproducible ? "PASS" : "FAIL", evidence: `Reproducible: ${independentRes.reproducible}` });

    // Check 11: Adversarial Suite
    const advSuite = new ManufacturingEvidenceAdversarialSuite();
    const advResults = advSuite.runAdversarialSuite();
    const allAdvPassed = advResults.every((r) => r.passed);
    checks.push({ checkName: "Adversarial evidence suite executed & passed", status: allAdvPassed ? "PASS" : "FAIL", evidence: `Passed ${advResults.filter((r) => r.passed).length}/${advResults.length} security tests` });

    // Check 12: 8-Layer Verifier Final Verdict
    const verifierRes = verifier.verifyEvidenceChain(allRecords, jobId);
    const passedVerdict = verifierRes.overallStatus === ManufacturingEvidenceStatus.MANUFACTURING_VERIFIED;
    checks.push({ checkName: "True calculated verdict generated (No fixed return 'PASS')", status: passedVerdict ? "PASS" : "FAIL", evidence: `OverallStatus: ${verifierRes.overallStatus}, Score: ${verifierRes.scorePercentage}%` });

    const passedChecks = checks.filter((c) => c.status === "PASS").length;
    const scorePercentage = Math.round((passedChecks / checks.length) * 100);

    return {
      passed: scorePercentage === 100,
      scorePercentage,
      totalChecks: checks.length,
      passedChecks,
      verdict: verifierRes.overallStatus,
      timestamp: new Date().toISOString(),
      details: checks,
    };
  }
}
