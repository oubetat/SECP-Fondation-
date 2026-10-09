/**
 * SECP Industrial OS v2 — Evidence Corroboration Engine
 */

import {
  ManufacturingEvidenceRecord,
  EvidenceSourceType,
  CorroborationVerdict,
  EvidenceConflictRecord,
  ConflictResolutionStatus,
  EventType,
} from "./types";

export class EvidenceCorroborationEngine {
  private conflicts: EvidenceConflictRecord[] = [];

  public getConflicts(): EvidenceConflictRecord[] {
    return [...this.conflicts];
  }

  public clearConflicts(): void {
    this.conflicts = [];
  }

  /**
   * Corroborate evidence records from multiple independent sources for a given event/operation.
   */
  public corroborateRecords(records: ManufacturingEvidenceRecord[]): {
    verdict: CorroborationVerdict;
    conflicts: EvidenceConflictRecord[];
    matrix: Record<string, boolean>;
    summary: string;
  } {
    if (records.length === 0) {
      return {
        verdict: CorroborationVerdict.INSUFFICIENT,
        conflicts: [],
        matrix: {},
        summary: "No evidence records provided for corroboration.",
      };
    }

    const newConflicts: EvidenceConflictRecord[] = [];
    const matrix: Record<string, boolean> = {};

    // Group records by source type
    const sourceMap = new Map<EvidenceSourceType, ManufacturingEvidenceRecord[]>();
    for (const rec of records) {
      const st = rec.sourceIdentity.sourceType;
      if (!sourceMap.has(st)) sourceMap.set(st, []);
      sourceMap.get(st)!.push(rec);
      matrix[st] = true;
    }

    // Cross-source verification: CNC vs TELEMETRY
    const cncRecords = sourceMap.get(EvidenceSourceType.CNC) || [];
    const telemetryRecords = sourceMap.get(EvidenceSourceType.SENSOR) || sourceMap.get(EvidenceSourceType.MES) || [];
    const twinRecords = sourceMap.get(EvidenceSourceType.DIGITAL_TWIN) || [];

    // Check for execution state conflict
    for (const cncRec of cncRecords) {
      const cncEvent = cncRec.eventIdentity.eventType;

      // Check against Telemetry
      for (const telRec of telemetryRecords) {
        const telEvent = telRec.eventIdentity.eventType;
        const telPayload = telRec.payload;

        if (
          (cncEvent === EventType.OPERATION_COMPLETED || cncEvent === EventType.EXECUTION_COMPLETED) &&
          (telEvent === EventType.MACHINE_STOPPED || telEvent === EventType.PROGRAM_ABORTED || telPayload?.status === "ABORTED" || telPayload?.quality === "TELEMETRY_GAP")
        ) {
          const conflict: EvidenceConflictRecord = {
            conflictId: `CONF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            evidenceAId: cncRec.contract.evidenceId,
            evidenceBId: telRec.contract.evidenceId,
            sourceA: EvidenceSourceType.CNC,
            sourceB: telRec.sourceIdentity.sourceType,
            conflictType: "EXECUTION_STATUS_CONFLICT",
            detectedAt: Date.now(),
            resolutionStatus: ConflictResolutionStatus.UNRESOLVED,
            details: `CNC reported '${cncEvent}' but telemetry/sensor reported '${telEvent}' or aborted status.`,
          };
          newConflicts.push(conflict);
          this.conflicts.push(conflict);
        }

        // Program hash mismatch between verified NC and telemetry executed program
        if (cncRec.payload?.programHash && telPayload?.programHash && cncRec.payload.programHash !== telPayload.programHash) {
          const conflict: EvidenceConflictRecord = {
            conflictId: `CONF_PGM_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            evidenceAId: cncRec.contract.evidenceId,
            evidenceBId: telRec.contract.evidenceId,
            sourceA: EvidenceSourceType.CNC,
            sourceB: telRec.sourceIdentity.sourceType,
            conflictType: "PROGRAM_HASH_MISMATCH",
            detectedAt: Date.now(),
            resolutionStatus: ConflictResolutionStatus.UNRESOLVED,
            details: `Program hash mismatch: CNC '${cncRec.payload.programHash}' vs Telemetry '${telPayload.programHash}'.`,
          };
          newConflicts.push(conflict);
          this.conflicts.push(conflict);
        }
      }

      // Check against Digital Twin
      for (const twinRec of twinRecords) {
        if (cncRec.payload?.machineId && twinRec.payload?.machineId && cncRec.payload.machineId !== twinRec.payload.machineId) {
          const conflict: EvidenceConflictRecord = {
            conflictId: `CONF_TWIN_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            evidenceAId: cncRec.contract.evidenceId,
            evidenceBId: twinRec.contract.evidenceId,
            sourceA: EvidenceSourceType.CNC,
            sourceB: EvidenceSourceType.DIGITAL_TWIN,
            conflictType: "PHYSICAL_DIGITAL_MISMATCH",
            detectedAt: Date.now(),
            resolutionStatus: ConflictResolutionStatus.UNRESOLVED,
            details: `Machine ID mismatch: CNC '${cncRec.payload.machineId}' vs Digital Twin '${twinRec.payload.machineId}'.`,
          };
          newConflicts.push(conflict);
          this.conflicts.push(conflict);
        }
      }
    }

    let verdict = CorroborationVerdict.CORROBORATED;
    if (newConflicts.length > 0) {
      verdict = CorroborationVerdict.CONFLICTING;
    } else if (sourceMap.size === 1) {
      verdict = CorroborationVerdict.PARTIALLY_CORROBORATED;
    } else if (sourceMap.size === 0) {
      verdict = CorroborationVerdict.INSUFFICIENT;
    }

    return {
      verdict,
      conflicts: newConflicts,
      matrix,
      summary: `Corroboration evaluated across ${sourceMap.size} independent source types. ${newConflicts.length} conflict(s) detected.`,
    };
  }

  /**
   * Resolve a conflict with explicit evidence.
   */
  public resolveConflict(
    conflictId: string,
    resolution: ConflictResolutionStatus,
    resolutionEvidenceId: string,
    explanation: string
  ): boolean {
    const conflict = this.conflicts.find((c) => c.conflictId === conflictId);
    if (!conflict) return false;

    conflict.resolutionStatus = resolution;
    conflict.resolutionEvidenceId = resolutionEvidenceId;
    conflict.details += ` | Resolution: ${resolution} (Evidence: ${resolutionEvidenceId}) - ${explanation}`;
    return true;
  }
}
