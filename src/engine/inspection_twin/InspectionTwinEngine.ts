// SECP Industrial OS v2 — Inspection Twin Orchestration Engine
import {
  InspectionTwin,
  InspectionState,
  InspectionPlan,
  MeasurementDevice,
  CalibrationRecord,
  MeasurementRecord,
  InspectionEvent,
  InspectionEvidence,
  ToleranceEvaluation
} from './types';
import { CanonicalInspectionSerializer } from './CanonicalInspectionSerializer';
import { InspectionIdentityService } from './InspectionIdentityService';

export class InspectionTwinEngine {
  private twins: Map<string, InspectionTwin> = new Map();
  private events: Map<string, InspectionEvent[]> = new Map();
  private evidences: Map<string, InspectionEvidence> = new Map();

  public createInspectionTwin(params: {
    inspectionTwinId: string;
    partSerial: string;
    manufacturingTwinId: string;
    designRevision: string;
    geometryRevision: string;
    inspectionRevision: string;
    inspectionPlan: InspectionPlan;
    measurementDevice: MeasurementDevice;
    calibrationRecord: CalibrationRecord;
    measurements: MeasurementRecord[];
    partIdentityHash: string;
    requirementRevision: string;
  }): InspectionTwin {
    
    // Cross-part evidence attack check at creation time?
    // We'll trust the input mapping, but record it deterministically.
    
    const evidenceId = `EVID-INSP-${params.inspectionTwinId}-001`;

    const state: InspectionState = {
      partIdentityHash: params.partIdentityHash,
      designRevision: params.designRevision,
      geometryRevision: params.geometryRevision,
      requirementRevision: params.requirementRevision,
      inspectionPlan: params.inspectionPlan,
      measurementDevice: params.measurementDevice,
      calibrationRecord: params.calibrationRecord,
      measurements: params.measurements,
      evaluations: [],
      evidenceId
    };

    const inputHash = CanonicalInspectionSerializer.computeInspectionInputHash(state);

    const auditRes = InspectionIdentityService.auditInspectionState(state, params.partSerial);
    state.evaluations = auditRes.evaluations;

    const evaluationsHash = CanonicalInspectionSerializer.sha256(JSON.stringify(state.evaluations));

    const rootHash = CanonicalInspectionSerializer.computeInspectionRootHash({
      inputHash,
      evaluationsHash,
      verdict: auditRes.verdict,
      evidenceHash: evidenceId
    });

    const now = new Date().toISOString();
    const twin: InspectionTwin = {
      inspectionTwinId: params.inspectionTwinId,
      partSerial: params.partSerial,
      manufacturingTwinId: params.manufacturingTwinId,
      designRevision: params.designRevision,
      geometryRevision: params.geometryRevision,
      inspectionRevision: params.inspectionRevision,
      inspectionPlanId: params.inspectionPlan.inspectionPlanId,
      measurementDeviceId: params.measurementDevice.deviceId,
      calibrationId: params.calibrationRecord.calibrationId,
      measurementExecutionId: `EXEC-${params.inspectionTwinId}`,
      inspectionState: state,
      state: 'EVALUATED',
      verdict: auditRes.verdict,
      createdAt: now,
      updatedAt: now,
      inputHash,
      rootHash
    };

    // Link evidence
    const evidence: InspectionEvidence = {
      evidenceId,
      inspectionTwinId: twin.inspectionTwinId,
      evidenceType: 'INSPECTION_REPORT',
      source: 'CMM_SYSTEM',
      timestamp: now,
      payloadHash: rootHash,
      parentEvidenceHash: 'GENESIS',
      signature: 'SIG-AUTO'
    };

    this.twins.set(twin.inspectionTwinId, twin);
    this.evidences.set(twin.inspectionTwinId, evidence);
    this.events.set(twin.inspectionTwinId, []);
    
    this.recordEvent(twin.inspectionTwinId, 'INSPECTION_CREATED', 'System', 'Inspector', evidenceId);

    return twin;
  }

  private recordEvent(
    inspectionTwinId: string,
    eventType: string,
    source: string,
    actor: string,
    evidenceId: string
  ): void {
    const list = this.events.get(inspectionTwinId) || [];
    const prevHash = list.length > 0 ? list[list.length - 1].eventHash : 'GENESIS';
    const now = new Date().toISOString();
    const eventHash = CanonicalInspectionSerializer.sha256([inspectionTwinId, eventType, now, prevHash].join('|'));

    const evt: InspectionEvent = {
      eventId: `EVT-${list.length + 1}`,
      inspectionTwinId,
      eventType,
      timestamp: now,
      actor,
      source,
      previousStateHash: prevHash,
      newStateHash: eventHash,
      evidenceId,
      eventHash
    };
    list.push(evt);
  }

  public getTwin(inspectionTwinId: string): InspectionTwin | undefined {
    return this.twins.get(inspectionTwinId);
  }

  public getEvidence(inspectionTwinId: string): InspectionEvidence | undefined {
    return this.evidences.get(inspectionTwinId);
  }
}
