import { ContactStateHasher } from "./ContactStateHasher";
import { ContactPointState, ContactStatus } from "./types";

export interface ContactEvidenceRecord {
  evidenceId: string;
  timestamp: string;
  patchId: 'PATCH-081';
  pairId: string;
  sourceSurfaceId: string;
  targetSurfaceId: string;
  contactPointId: string;
  gap: number;
  normal: number[];
  pressure: number;
  status: ContactStatus;
  penaltyParameter: number;
  step: number;
  iteration: number;
  previousStateHash: string;
  currentStateHash: string;
  residualContribution: number;
  energyContribution: number;
  verdict: 'VERIFIED' | 'TAMPERED' | 'INVALID';
}

export class ContactEvidenceEngine {
  /**
   * Generates a forensic evidence record for a contact point state.
   */
  static generateEvidenceRecord(
    pairId: string,
    sourceSurfaceId: string,
    targetSurfaceId: string,
    state: ContactPointState,
    penaltyParameter: number,
    previousStateHash: string = 'GENESIS'
  ): ContactEvidenceRecord {
    const currentStateHash = ContactStateHasher.computeStateHash(pairId, [state]);

    const evidenceId = `EVIDENCE_081_${pairId}_${state.pointId}_S${state.step}_I${state.iteration}`;

    return {
      evidenceId,
      timestamp: new Date().toISOString(),
      patchId: 'PATCH-081',
      pairId,
      sourceSurfaceId,
      targetSurfaceId,
      contactPointId: state.pointId,
      gap: state.gap,
      normal: [...state.normal],
      pressure: state.contactPressure,
      status: state.status,
      penaltyParameter,
      step: state.step,
      iteration: state.iteration,
      previousStateHash,
      currentStateHash,
      residualContribution: state.contactPressure,
      energyContribution: state.contactWork,
      verdict: 'VERIFIED'
    };
  }
}
