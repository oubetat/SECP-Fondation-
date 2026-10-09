/**
 * SECP Industrial OS v2 — Manufacturing Evidence Verifier
 * 8-Layer Evidence Verification & Verdict Engine
 */

import {
  ManufacturingEvidenceRecord,
  ManufacturingEvidenceStatus,
  SignatureStatus,
  EvidenceType,
  EventType,
  CorroborationVerdict,
  HardAcceptanceResult112,
} from "./types";
import { ManufacturingEvidenceHashPolicy } from "./ManufacturingEvidenceHashPolicy";
import { EvidenceSignatureVerifier } from "./EvidenceSignatureVerifier";
import { EvidenceCorroborationEngine } from "./EvidenceCorroborationEngine";

export interface LayerVerificationResult {
  layer: number;
  layerName: string;
  passed: boolean;
  issues: string[];
}

export class ManufacturingEvidenceVerifier {
  private signatureVerifier: EvidenceSignatureVerifier;
  private corroborationEngine: EvidenceCorroborationEngine;

  constructor(
    sigVerifier?: EvidenceSignatureVerifier,
    corroborationEngine?: EvidenceCorroborationEngine
  ) {
    this.signatureVerifier = sigVerifier || new EvidenceSignatureVerifier();
    this.corroborationEngine = corroborationEngine || new EvidenceCorroborationEngine();
  }

  public verifyEvidenceChain(records: ManufacturingEvidenceRecord[], expectedRootJobId?: string): {
    overallStatus: ManufacturingEvidenceStatus;
    scorePercentage: number;
    layerResults: LayerVerificationResult[];
    criticalFailures: string[];
    completeness: { required: number; present: number; percentage: number };
  } {
    const layerResults: LayerVerificationResult[] = [];
    const criticalFailures: string[] = [];

    const sortedRecords = [...records].sort(
      (a, b) => a.contract.chainSequence - b.contract.chainSequence
    );

    // Track presence of critical evidence types
    const presentTypes = new Set(sortedRecords.map((r) => r.contract.evidenceType));
    const requiredTypes: EvidenceType[] = [
      EvidenceType.DESIGN_EVIDENCE,
      EvidenceType.MATERIAL_EVIDENCE,
      EvidenceType.TOOL_EVIDENCE,
      EvidenceType.MACHINE_EVIDENCE,
      EvidenceType.NC_PROGRAM_EVIDENCE,
      EvidenceType.GCODE_VERIFICATION_EVIDENCE,
      EvidenceType.SIMULATION_EVIDENCE,
      EvidenceType.DIGITAL_TWIN_EVIDENCE,
      EvidenceType.EXECUTION_EVIDENCE,
      EvidenceType.TELEMETRY_EVIDENCE,
      EvidenceType.INSPECTION_EVIDENCE,
    ];

    let presentCount = 0;
    for (const req of requiredTypes) {
      if (presentTypes.has(req)) presentCount++;
    }
    const completenessPct = Math.round((presentCount / requiredTypes.length) * 100);

    // Layer 1 — Identity
    const l1Issues: string[] = [];
    const seenIds = new Set<string>();
    for (const r of sortedRecords) {
      if (seenIds.has(r.contract.evidenceId)) {
        l1Issues.push(`Duplicate evidenceId: '${r.contract.evidenceId}'`);
      }
      seenIds.add(r.contract.evidenceId);

      if (!r.contract.evidenceType || !r.sourceIdentity.sourceId || !r.eventIdentity.eventId) {
        l1Issues.push(`Incomplete identity for record '${r.contract.evidenceId}'`);
      }
    }
    layerResults.push({
      layer: 1,
      layerName: "Layer 1 — Identity",
      passed: l1Issues.length === 0,
      issues: l1Issues,
    });

    // Layer 2 — Integrity
    const l2Issues: string[] = [];
    for (const r of sortedRecords) {
      const calculatedContentHash = ManufacturingEvidenceHashPolicy.computeHash(r.payload);
      if (calculatedContentHash !== r.contract.contentHash) {
        l2Issues.push(`Content hash mismatch on record '${r.contract.evidenceId}'`);
      }
    }
    if (l2Issues.length > 0) criticalFailures.push("HASH_MISMATCH");
    layerResults.push({
      layer: 2,
      layerName: "Layer 2 — Integrity",
      passed: l2Issues.length === 0,
      issues: l2Issues,
    });

    // Layer 3 — Authenticity
    const l3Issues: string[] = [];
    for (const r of sortedRecords) {
      if (r.contract.signature) {
        const sigRes = this.signatureVerifier.verifySignature(r);
        if (sigRes.status !== SignatureStatus.VALID) {
          l3Issues.push(`Signature invalid on '${r.contract.evidenceId}': ${sigRes.details}`);
          criticalFailures.push("FORGED_SIGNATURE");
        }
      }
    }
    layerResults.push({
      layer: 3,
      layerName: "Layer 3 — Authenticity",
      passed: l3Issues.length === 0,
      issues: l3Issues,
    });

    // Layer 4 — Temporal Consistency
    const l4Issues: string[] = [];
    for (let i = 1; i < sortedRecords.length; i++) {
      const prev = sortedRecords[i - 1];
      const curr = sortedRecords[i];
      if (curr.contract.eventTimestamp < prev.contract.eventTimestamp) {
        l4Issues.push(
          `Timestamp inversion: Record #${curr.contract.chainSequence} (${curr.contract.eventTimestamp}) is earlier than #${prev.contract.chainSequence} (${prev.contract.eventTimestamp})`
        );
      }
    }
    layerResults.push({
      layer: 4,
      layerName: "Layer 4 — Temporal Consistency",
      passed: l4Issues.length === 0,
      issues: l4Issues,
    });

    // Layer 5 — Dependency & Chain Consistency
    const l5Issues: string[] = [];
    let expectedSeq = 1;
    let expectedPrevHash = "GENESIS_EVIDENCE_HASH_0000000000000000000000000000000000000000";

    for (const r of sortedRecords) {
      if (r.contract.chainSequence !== expectedSeq) {
        l5Issues.push(`Chain gap: Expected sequence ${expectedSeq}, found ${r.contract.chainSequence}`);
        criticalFailures.push("BROKEN_CRITICAL_CHAIN");
      }
      if (r.contract.previousEvidenceHash !== expectedPrevHash) {
        l5Issues.push(`Previous hash mismatch on record #${r.contract.chainSequence}`);
        criticalFailures.push("BROKEN_CRITICAL_CHAIN");
      }
      expectedSeq = r.contract.chainSequence + 1;
      expectedPrevHash = r.contract.canonicalHash;
    }
    layerResults.push({
      layer: 5,
      layerName: "Layer 5 — Dependency Consistency",
      passed: l5Issues.length === 0,
      issues: l5Issues,
    });

    // Layer 6 — Cross-Source Corroboration
    const l6Issues: string[] = [];
    const corrRes = this.corroborationEngine.corroborateRecords(sortedRecords);
    if (corrRes.verdict === CorroborationVerdict.CONFLICTING) {
      for (const conf of corrRes.conflicts) {
        l6Issues.push(`Conflict (${conf.conflictType}): ${conf.details}`);
        if (conf.conflictType === "PROGRAM_HASH_MISMATCH") criticalFailures.push("PROGRAM_HASH_MISMATCH");
      }
    }
    layerResults.push({
      layer: 6,
      layerName: "Layer 6 — Cross-Source Corroboration",
      passed: l6Issues.length === 0,
      issues: l6Issues,
    });

    // Layer 7 — Physical-Digital Consistency
    const l7Issues: string[] = [];
    const ncRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.NC_PROGRAM_EVIDENCE);
    const execRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.EXECUTION_EVIDENCE);
    const machineRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.MACHINE_EVIDENCE);
    const toolRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.TOOL_EVIDENCE);
    const materialRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.MATERIAL_EVIDENCE);

    if (ncRecord && execRecord) {
      const verifiedHash = ncRecord.payload?.programHash;
      const executedHash = execRecord.payload?.programHash;
      if (verifiedHash && executedHash && verifiedHash !== executedHash) {
        l7Issues.push(`Executed program hash '${executedHash}' does not match verified NC program hash '${verifiedHash}'`);
        criticalFailures.push("PROGRAM_HASH_MISMATCH");
      }
    }

    if (machineRecord && execRecord) {
      const expectedMachine = machineRecord.payload?.machineId;
      const actualMachine = execRecord.payload?.machineId;
      if (expectedMachine && actualMachine && expectedMachine !== actualMachine) {
        l7Issues.push(`Execution machine '${actualMachine}' does not match machine configuration '${expectedMachine}'`);
        criticalFailures.push("MACHINE_CONFIGURATION_MISMATCH");
      }
    }

    if (toolRecord && execRecord) {
      const expectedTool = toolRecord.payload?.toolId;
      const actualTool = execRecord.payload?.activeToolId || execRecord.payload?.toolId;
      if (expectedTool && actualTool && expectedTool !== actualTool) {
        l7Issues.push(`Actual tool '${actualTool}' does not match expected tool '${expectedTool}'`);
        criticalFailures.push("TOOL_MISMATCH");
      }
    }

    if (materialRecord && execRecord) {
      const expectedMat = materialRecord.payload?.materialId;
      const actualMat = execRecord.payload?.materialId;
      if (expectedMat && actualMat && expectedMat !== actualMat) {
        l7Issues.push(`Actual material '${actualMat}' does not match expected material '${expectedMat}'`);
        criticalFailures.push("MATERIAL_MISMATCH");
      }
    }

    layerResults.push({
      layer: 7,
      layerName: "Layer 7 — Physical-Digital Consistency",
      passed: l7Issues.length === 0,
      issues: l7Issues,
    });

    // Layer 8 — Inspection Consistency
    const l8Issues: string[] = [];
    const inspRecord = sortedRecords.find((r) => r.contract.evidenceType === EvidenceType.INSPECTION_EVIDENCE);
    if (inspRecord) {
      const measurements = inspRecord.payload?.measurements || [];
      for (const m of measurements) {
        if (!m.unit) {
          l8Issues.push(`Measurement '${m.measurementId}' missing physical unit.`);
        }
        if (m.calibrationStatus === "CALIBRATION_INVALID") {
          l8Issues.push(`Instrument '${m.instrumentId}' calibration status is CALIBRATION_INVALID.`);
          criticalFailures.push("INSPECTION_CONTEXT_INVALID");
        }
      }
    }
    layerResults.push({
      layer: 8,
      layerName: "Layer 8 — Inspection Consistency",
      passed: l8Issues.length === 0,
      issues: l8Issues,
    });

    // Check missing critical evidence
    if (presentCount < requiredTypes.length) {
      criticalFailures.push("CRITICAL_EVIDENCE_MISSING");
    }

    // Determine overall status
    let overallStatus = ManufacturingEvidenceStatus.MANUFACTURING_VERIFIED;
    if (criticalFailures.length > 0) {
      if (criticalFailures.includes("PROGRAM_HASH_MISMATCH")) overallStatus = ManufacturingEvidenceStatus.INVALID;
      else if (criticalFailures.includes("MACHINE_CONFIGURATION_MISMATCH")) overallStatus = ManufacturingEvidenceStatus.PHYSICAL_DIGITAL_MISMATCH;
      else if (criticalFailures.includes("BROKEN_CRITICAL_CHAIN")) overallStatus = ManufacturingEvidenceStatus.CHAIN_BROKEN;
      else if (criticalFailures.includes("FORGED_SIGNATURE")) overallStatus = ManufacturingEvidenceStatus.AUTHENTICITY_FAILURE;
      else if (criticalFailures.includes("HASH_MISMATCH")) overallStatus = ManufacturingEvidenceStatus.INTEGRITY_FAILURE;
      else overallStatus = ManufacturingEvidenceStatus.INSUFFICIENT;
    }

    const passedLayers = layerResults.filter((l) => l.passed).length;
    const scorePercentage = Math.round((passedLayers / 8) * 100);

    return {
      overallStatus,
      scorePercentage,
      layerResults,
      criticalFailures: Array.from(new Set(criticalFailures)),
      completeness: {
        required: requiredTypes.length,
        present: presentCount,
        percentage: completenessPct,
      },
    };
  }
}
