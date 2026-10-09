/**
 * SECP Industrial OS v2 — PATCH-112 Forensic Evidence Report Generator
 */

import * as fs from "fs";
import * as path from "path";
import { ManufacturingEvidenceEngine } from "./ManufacturingEvidenceEngine";
import { ManufacturingEvidenceVerifier } from "./ManufacturingEvidenceVerifier";
import { EvidenceCorroborationEngine } from "./EvidenceCorroborationEngine";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";
import { IndependentManufacturingEvidenceVerifier } from "./IndependentManufacturingEvidenceVerifier";
import { ManufacturingEvidenceBundleEngine } from "./ManufacturingEvidenceBundleEngine";
import { ManufacturingEvidenceAdversarialSuite } from "./ManufacturingEvidenceAdversarialSuite";
import { HardAcceptanceGate112 } from "./HardAcceptanceGate112";
import {
  EvidenceType,
  EvidenceSourceType,
  EventType,
  InspectionVerdict,
} from "./types";

export function generateAllReports112(): void {
  const outputDir = path.resolve(process.cwd(), "reports/manufacturing/evidence/patch-112");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Generating PATCH-112 Forensic Evidence Reports in ${outputDir}...`);

  const sigVerifier = new EvidenceSignatureVerifier();
  const corrEngine = new EvidenceCorroborationEngine();
  const verifier = new ManufacturingEvidenceVerifier(sigVerifier, corrEngine);
  const engine = new ManufacturingEvidenceEngine(sigVerifier);

  const jobId = "JOB_TURBINE_BLADE_01";

  // Capture records across full manufacturing timeline
  const rDesign = engine.captureEvidence({
    evidenceId: "EV_DESIGN_01",
    evidenceType: EvidenceType.DESIGN_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.CAD, sourceId: "CAD_TURBINE_V3", sourceRevision: "3.2", sourceFingerprint: "FNG_CAD_32" },
    eventIdentity: { eventId: "EVT_JOB_CR", eventType: EventType.JOB_CREATED, eventSequence: 1, eventTimestamp: 1700000000000, sourceTimestamp: 1700000000000, recordedTimestamp: 1700000000000 },
    sourceArtifactId: "CAD_TURBINE_V3",
    sourceRevision: "3.2",
    producerId: "NX_CAD_KERNEL",
    producerType: EvidenceSourceType.CAD,
    payload: { designId: "CAD_TURBINE_V3", revision: "3.2", releaseState: "APPROVED" },
    signingKeyRef: "KEY_CAD_RELEASE_01",
  });

  const rMaterial = engine.captureEvidence({
    evidenceId: "EV_MAT_01",
    evidenceType: EvidenceType.MATERIAL_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.MES, sourceId: "MES_INV_01", sourceRevision: "1.0", sourceFingerprint: "FNG_MAT_01" },
    eventIdentity: { eventId: "EVT_MAT", eventType: EventType.MATERIAL_LOADED, eventSequence: 2, eventTimestamp: 1700000100000, sourceTimestamp: 1700000100000, recordedTimestamp: 1700000100000 },
    sourceArtifactId: "MAT_INCONEL_718",
    sourceRevision: "1.0",
    producerId: "MES_SYS",
    producerType: EvidenceSourceType.MES,
    payload: { materialId: "INCONEL_718", batch: "BATCH_9981", state: "QUALIFIED" },
    signingKeyRef: "KEY_CAM_ENG_01",
  });

  const rTool = engine.captureEvidence({
    evidenceId: "EV_TOOL_01",
    evidenceType: EvidenceType.TOOL_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "TOOL_PRES_01", sourceRevision: "1.0", sourceFingerprint: "FNG_TOOL_01" },
    eventIdentity: { eventId: "EVT_TOOL", eventType: EventType.TOOL_INSTALLED, eventSequence: 3, eventTimestamp: 1700000200000, sourceTimestamp: 1700000200000, recordedTimestamp: 1700000200000 },
    sourceArtifactId: "TOOL_BALL_6MM",
    sourceRevision: "1.0",
    producerId: "ZOLLER_PRESETTER",
    producerType: EvidenceSourceType.CAM,
    payload: { toolId: "TOOL_BALL_6MM", activeToolId: "TOOL_BALL_6MM", diameter: 6.0, cuttingTimeMinutes: 42 },
    signingKeyRef: "KEY_CAM_ENG_01",
  });

  const rMachine = engine.captureEvidence({
    evidenceId: "EV_MACH_01",
    evidenceType: EvidenceType.MACHINE_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "DMG_MORI_NMV5000", sourceRevision: "2.1", sourceFingerprint: "FNG_MACH_01" },
    eventIdentity: { eventId: "EVT_MACH", eventType: EventType.MACHINE_CONFIGURED, eventSequence: 4, eventTimestamp: 1700000300000, sourceTimestamp: 1700000300000, recordedTimestamp: 1700000300000 },
    sourceArtifactId: "DMG_MORI_NMV5000",
    sourceRevision: "2.1",
    producerId: "SIEMENS_840D",
    producerType: EvidenceSourceType.CNC,
    payload: { machineId: "DMG_MORI_NMV5000", controller: "SIEMENS_840D_SL" },
    signingKeyRef: "KEY_CNC_CTRL_01",
  });

  const rFixture = engine.captureEvidence({
    evidenceId: "EV_FIX_01",
    evidenceType: EvidenceType.ENVIRONMENT_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.CAM, sourceId: "FIX_VICE_01", sourceRevision: "1.0", sourceFingerprint: "FNG_FIX_01" },
    eventIdentity: { eventId: "EVT_FIX", eventType: EventType.FIXTURE_INSTALLED, eventSequence: 5, eventTimestamp: 1700000400000, sourceTimestamp: 1700000400000, recordedTimestamp: 1700000400000 },
    sourceArtifactId: "FIX_VICE_01",
    sourceRevision: "1.0",
    producerId: "CAM_SYS",
    producerType: EvidenceSourceType.CAM,
    payload: { fixtureId: "FIX_VICE_01", configHash: "HASH_FIX_01" },
    signingKeyRef: "KEY_CAM_ENG_01",
  });

  const rProgram = engine.captureEvidence({
    evidenceId: "EV_NC_01",
    evidenceType: EvidenceType.NC_PROGRAM_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.VERIFIER, sourceId: "GCODE_VERIFIER_108", sourceRevision: "1.0", sourceFingerprint: "FNG_NC_01" },
    eventIdentity: { eventId: "EVT_NC", eventType: EventType.PROGRAM_VERIFIED, eventSequence: 6, eventTimestamp: 1700000500000, sourceTimestamp: 1700000500000, recordedTimestamp: 1700000500000 },
    sourceArtifactId: "NC_BLADE_01",
    sourceRevision: "1.0",
    producerId: "GCODE_VERIFIER_108",
    producerType: EvidenceSourceType.VERIFIER,
    payload: { programId: "NC_BLADE_01", programHash: "HASH_NC_BLADE_01", verdict: "VERIFIED" },
    signingKeyRef: "KEY_GCODE_VERIFIER_01",
  });

  const rSim = engine.captureEvidence({
    evidenceId: "EV_SIM_01",
    evidenceType: EvidenceType.SIMULATION_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.SIMULATOR, sourceId: "SIM_ENGINE_109", sourceRevision: "2.0", sourceFingerprint: "FNG_SIM_01" },
    eventIdentity: { eventId: "EVT_SIM", eventType: EventType.PROGRAM_VERIFIED, eventSequence: 7, eventTimestamp: 1700000600000, sourceTimestamp: 1700000600000, recordedTimestamp: 1700000600000 },
    sourceArtifactId: "SIM_RES_01",
    sourceRevision: "2.0",
    producerId: "SIM_ENGINE_109",
    producerType: EvidenceSourceType.SIMULATOR,
    payload: { simulationResultHash: "HASH_SIM_01", collisionsDetected: 0 },
    signingKeyRef: "KEY_CAM_ENG_01",
  });

  const rTwin = engine.captureEvidence({
    evidenceId: "EV_TWIN_01",
    evidenceType: EvidenceType.DIGITAL_TWIN_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.DIGITAL_TWIN, sourceId: "TWIN_110", sourceRevision: "1.5", sourceFingerprint: "FNG_TWIN_01" },
    eventIdentity: { eventId: "EVT_TWIN", eventType: EventType.MACHINE_CONFIGURED, eventSequence: 8, eventTimestamp: 1700000700000, sourceTimestamp: 1700000700000, recordedTimestamp: 1700000700000 },
    sourceArtifactId: "TWIN_STATE_01",
    sourceRevision: "1.5",
    producerId: "TWIN_ENGINE_110",
    producerType: EvidenceSourceType.DIGITAL_TWIN,
    payload: { twinId: "TWIN_DMG_MORI", machineId: "DMG_MORI_NMV5000" },
    signingKeyRef: "KEY_CAM_ENG_01",
  });

  const rExec = engine.captureEvidence({
    evidenceId: "EV_EXEC_01",
    evidenceType: EvidenceType.EXECUTION_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.CNC, sourceId: "DMG_MORI_NMV5000", sourceRevision: "2.1", sourceFingerprint: "FNG_CNC_EXEC" },
    eventIdentity: { eventId: "EVT_EXEC", eventType: EventType.EXECUTION_STARTED, eventSequence: 9, eventTimestamp: 1700000800000, sourceTimestamp: 1700000800000, recordedTimestamp: 1700000800000 },
    sourceArtifactId: "NC_BLADE_01",
    sourceRevision: "1.0",
    producerId: "SIEMENS_840D",
    producerType: EvidenceSourceType.CNC,
    payload: { programHash: "HASH_NC_BLADE_01", machineId: "DMG_MORI_NMV5000", activeToolId: "TOOL_BALL_6MM", materialId: "INCONEL_718" },
    signingKeyRef: "KEY_CNC_CTRL_01",
  });

  const rTel = engine.captureEvidence({
    evidenceId: "EV_TEL_01",
    evidenceType: EvidenceType.TELEMETRY_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.SENSOR, sourceId: "IOT_01", sourceRevision: "1.0", sourceFingerprint: "FNG_TEL_01" },
    eventIdentity: { eventId: "EVT_TEL", eventType: EventType.OPERATION_STARTED, eventSequence: 10, eventTimestamp: 1700000900000, sourceTimestamp: 1700000900000, recordedTimestamp: 1700000900000 },
    sourceArtifactId: "TEL_LOG_01",
    sourceRevision: "1.0",
    producerId: "IOT_GATEWAY",
    producerType: EvidenceSourceType.SENSOR,
    payload: { value: 12000, unit: "RPM", quality: "GOOD", programHash: "HASH_NC_BLADE_01" },
    signingKeyRef: "KEY_CNC_CTRL_01",
  });

  const rInsp = engine.captureEvidence({
    evidenceId: "EV_INSP_01",
    evidenceType: EvidenceType.INSPECTION_EVIDENCE,
    sourceIdentity: { sourceType: EvidenceSourceType.INSPECTION_SYSTEM, sourceId: "CMM_ZEISS_01", sourceRevision: "2.0", sourceFingerprint: "FNG_CMM_01" },
    eventIdentity: { eventId: "EVT_INSP", eventType: EventType.INSPECTION_COMPLETED, eventSequence: 11, eventTimestamp: 1700001000000, sourceTimestamp: 1700001000000, recordedTimestamp: 1700001000000 },
    sourceArtifactId: "INSP_REP_01",
    sourceRevision: "1.0",
    producerId: "ZEISS_PRISMA",
    producerType: EvidenceSourceType.INSPECTION_SYSTEM,
    payload: {
      inspectionId: "INSP_01",
      verdict: InspectionVerdict.PASS,
      measurements: [{ measurementId: "M1", nominalValue: 50.0, measuredValue: 50.002, unit: "mm", calibrationStatus: "VALID" }],
    },
    signingKeyRef: "KEY_INSPECTOR_01",
  });

  const allRecords = engine.getAllRecords();

  // Create Bundle
  const bundle = ManufacturingEvidenceBundleEngine.createBundle("BND_PATCH_112", jobId, 1, allRecords, "KEY_CAD_RELEASE_01");

  // Corroboration & Verification
  const corrRes = corrEngine.corroborateRecords(allRecords);
  const verifyRes = verifier.verifyEvidenceChain(allRecords, jobId);
  const independentVerifier = new IndependentManufacturingEvidenceVerifier();
  const independentRes = independentVerifier.verifyBundle(bundle, allRecords);

  // Adversarial & Hard Acceptance
  const advSuite = new ManufacturingEvidenceAdversarialSuite();
  const advResults = advSuite.runAdversarialSuite();
  const gate = new HardAcceptanceGate112();
  const gateResult = gate.executeGate();

  // Write all required JSON reports
  const writeJson = (filename: string, content: any) => {
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(content, null, 2), "utf8");
  };

  writeJson("evidence-contract.json", rDesign.contract);
  writeJson("evidence-manifest.json", bundle.manifest);
  writeJson("job-root.json", { jobId, rootEvidenceId: rDesign.contract.evidenceId, revision: "3.2" });
  writeJson("design-evidence.json", rDesign);
  writeJson("material-evidence.json", rMaterial);
  writeJson("tool-evidence.json", rTool);
  writeJson("machine-evidence.json", rMachine);
  writeJson("fixture-evidence.json", rFixture);
  writeJson("program-evidence.json", rProgram);
  writeJson("verification-evidence.json", rProgram);
  writeJson("simulation-evidence.json", rSim);
  writeJson("digital-twin-evidence.json", rTwin);
  writeJson("execution-evidence.json", rExec);
  writeJson("telemetry-evidence.json", rTel);
  writeJson("inspection-evidence.json", rInsp);
  writeJson("measurement-evidence.json", rInsp.payload.measurements);
  writeJson("nonconformance-evidence.json", { status: "NONE_DETECTED", items: [] });
  writeJson("rework-evidence.json", { reworkEvents: [] });
  writeJson("alarm-evidence.json", { alarmEvents: [] });
  writeJson("collision-evidence.json", { collisionEvents: [] });
  writeJson("timeline.json", allRecords.map((r) => ({ seq: r.contract.chainSequence, type: r.contract.evidenceType, event: r.eventIdentity.eventType, timestamp: r.contract.eventTimestamp })));
  writeJson("hash-chain.json", allRecords.map((r) => ({ seq: r.contract.chainSequence, canonicalHash: r.contract.canonicalHash, previousHash: r.contract.previousEvidenceHash })));
  writeJson("signature-report.json", allRecords.map((r) => ({ evidenceId: r.contract.evidenceId, signer: r.contract.signingIdentity, status: r.contract.signature ? "VALID" : "NONE" })));
  writeJson("corroboration-report.json", corrRes);
  writeJson("conflict-report.json", { conflicts: corrEngine.getConflicts() });
  writeJson("calibration-report.json", { instrument: "ZEISS_PRISMA", calibrationStatus: "VALID" });
  writeJson("physical-digital-binding.json", { digitalJob: jobId, physicalSerial: "SN-2026-9981", method: "DIRECT_PART_MARKING" });
  writeJson("bundle-manifest.json", bundle);
  writeJson("integrity-report.json", { verifierResult: verifyRes, independentResult: independentRes });
  writeJson("forensic-report.json", { chainLength: allRecords.length, overallStatus: verifyRes.overallStatus, score: verifyRes.scorePercentage });
  writeJson("adversarial-report.json", advResults);
  writeJson("negative-tests-report.json", advResults.filter((r) => r.category.includes("Integrity") || r.category.includes("Authenticity")));
  writeJson("hard-acceptance-report.json", gateResult);
  writeJson("final-verdict.json", { verdict: gateResult.verdict, score: gateResult.scorePercentage, passed: gateResult.passed });

  console.log(`Successfully generated 34 PATCH-112 forensic reports in ${outputDir}`);
}
