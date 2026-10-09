/**
 * PATCH-SECP-063: Root Cause Analysis Engine
 * Integrates SPC ROOT_CAUSE_CANDIDATE markers with engineering investigations.
 * Prevents automated closed-loop corrections by requiring formal manual review.
 */

import { RootCauseInvestigation, RootCauseStatus } from './NCRTypes';

export class RootCauseAnalysisEngine {
  /**
   * Spawns an engineering investigation from a statistical SPC anomaly
   */
  public static initiateInvestigation(params: {
    ncrId: string;
    candidateCause: string;
    sourceSpcCorrelationR?: number;
  }): RootCauseInvestigation {
    const investigationId = `rca-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return {
      investigationId,
      ncrId: params.ncrId,
      sourceSpcCorrelationR: params.sourceSpcCorrelationR,
      candidateCause: params.candidateCause,
      status: 'CANDIDATE',
      investigationNotes: 'RCA process initiated. SPC correlation is indexed as a candidate trigger.',
      evidencePaths: []
    };
  }

  /**
   * Transitions investigation to active review
   */
  public static beginInvestigation(investigation: RootCauseInvestigation): RootCauseInvestigation {
    return {
      ...investigation,
      status: 'UNDER_INVESTIGATION',
      investigationNotes: investigation.investigationNotes + '\nEngineering inspection commenced.'
    };
  }

  /**
   * Confirms the root cause with direct evidence and engineering approval
   */
  public static confirmCause(
    investigation: RootCauseInvestigation,
    evidencePath: string,
    notes: string,
    engineerId: string
  ): RootCauseInvestigation {
    if (!evidencePath || evidencePath.length === 0) {
      throw new Error('Engineering Governance: Root cause confirmation requires a verifiable physical evidence attachment path.');
    }

    return {
      ...investigation,
      status: 'CONFIRMED',
      investigationNotes: notes,
      evidencePaths: [...investigation.evidencePaths, evidencePath],
      reviewedBy: engineerId,
      resolutionTimestamp: new Date().toISOString()
    };
  }

  /**
   * Rejects the statistical candidate cause after inspection
   */
  public static rejectCandidate(
    investigation: RootCauseInvestigation,
    notes: string,
    engineerId: string
  ): RootCauseInvestigation {
    return {
      ...investigation,
      status: 'REJECTED',
      investigationNotes: notes,
      reviewedBy: engineerId,
      resolutionTimestamp: new Date().toISOString()
    };
  }
}
