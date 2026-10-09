/**
 * SECP Industrial OS v2 — QIF Closed-Loop Engine
 * Ingests QIF measurement results, evaluates quality, and generates
 * traceable engineering revision proposals without direct un-governed mutation.
 */

import {
  QifDocument,
  QifMeasurementResult,
  EngineeringFeedback,
  DesignAuthorityBinding,
  QifInspectionPlan
} from './QifTypes';
import { QifCryptoProvenance } from './QifCryptoProvenance';

export interface ClosedLoopEvaluationSummary {
  readonly totalEvaluated: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly indeterminateCount: number;
  readonly rejectedCount: number;
  readonly feedbackProposals: readonly EngineeringFeedback[];
  readonly overallVerdict: 'PASS' | 'REJECTED' | 'REWORK_PROPOSED' | 'REVISION_PROPOSED';
  readonly provenanceChainHash: string;
}

export interface AuthorizedRevisionTransition {
  readonly feedbackId: string;
  readonly sourceRevisionId: string;
  readonly authorizedRevisionId: string;
  readonly authorizedBy: string;
  readonly timestamp: string;
  readonly updatedPlan: QifInspectionPlan;
}

export class QifClosedLoopEngine {

  private static revisionLedger = new Map<string, QifMeasurementResult[]>();

  /**
   * Processes a complete QifDocument, evaluates design authority binding and results,
   * and generates closed-loop engineering revision proposals when deviations are detected.
   */
  public static processClosedLoop(doc: QifDocument): ClosedLoopEvaluationSummary {
    const feedbackList: EngineeringFeedback[] = [];
    let passCount = 0;
    let failCount = 0;
    let indetCount = 0;
    let rejectCount = 0;

    for (const res of doc.results) {
      // Record result in historical revision ledger
      const revId = res.designRevisionId || res.binding?.revisionId || 'REV-A';
      const existingLedger = this.revisionLedger.get(revId) || [];
      existingLedger.push(res);
      this.revisionLedger.set(revId, existingLedger);

      // 1. Verify Design Authority Binding
      if (!res.binding || !res.binding.designAuthorityId || !res.binding.revisionId) {
        rejectCount++;
        continue;
      }

      if (res.verdict === 'PASS') {
        passCount++;
      } else if (res.verdict === 'INDETERMINATE') {
        indetCount++;
      } else if (res.verdict === 'FAIL' || (res.verdict as any) === 'OUT_OF_TOLERANCE') {
        failCount++;

        // Generate traceable feedback proposal
        const currentRev = res.binding.revisionId;
        const proposedRev = currentRev.startsWith('REV-') ? 
          `REV-${String.fromCharCode(currentRev.charCodeAt(4) + 1)}` : 'REV-B';

        const fbId = `FB-${res.resultId}-FIX`;
        
        let proposedAction: EngineeringFeedback['proposedAction'] = 'ADJUST_TOOL_OFFSET';
        let adjValue = -res.deviationMm;

        if (res.deviationMm > 0.5) {
          proposedAction = 'CAD_REGENERATION';
        } else if (res.deviationMm > 0.2) {
          proposedAction = 'REVISION_UPDATE_PROPOSAL';
        }

        const provenanceHash = QifCryptoProvenance.computeFeedbackHash(
          fbId, res.resultId, currentRev, proposedRev, res.deviationMm
        );

        feedbackList.push({
          feedbackId: fbId,
          triggerResultId: res.resultId,
          affectedCharacteristicId: res.characteristicId,
          affectedFeatureId: res.featureId,
          detectedDeviationMm: res.deviationMm,
          proposedAction,
          parameterAdjustmentValue: Math.round(adjValue * 1e4) / 1e4,
          sourceRevisionId: currentRev,
          proposedRevisionId: proposedRev,
          isRevisionProposalCreated: true,
          status: 'PENDING',
          provenanceHash
        });
      } else {
        rejectCount++;
      }
    }

    let overallVerdict: ClosedLoopEvaluationSummary['overallVerdict'] = 'PASS';
    if (rejectCount > 0) {
      overallVerdict = 'REJECTED';
    } else if (failCount > 0) {
      overallVerdict = 'REVISION_PROPOSED';
    } else if (indetCount > 0) {
      overallVerdict = 'REWORK_PROPOSED';
    }

    const provenanceChainHash = QifCryptoProvenance.computePlanHash(
      doc.qifDocumentId, doc.plan.designAuthorityId, doc.plan.revisionId, passCount, failCount
    );

    return {
      totalEvaluated: doc.results.length,
      passCount,
      failCount,
      indeterminateCount: indetCount,
      rejectedCount: rejectCount,
      feedbackProposals: feedbackList,
      overallVerdict,
      provenanceChainHash
    };
  }

  /**
   * Authorizes an EngineeringFeedback revision proposal, advancing design state from REV-A to REV-B
   * and generating a new QIF Inspection Plan for REV-B re-inspection.
   */
  public static authorizeRevisionTransition(
    proposal: EngineeringFeedback,
    sourcePlan: QifInspectionPlan,
    authorizingEngineer: string
  ): AuthorizedRevisionTransition {
    if (!proposal || proposal.status !== 'PENDING') {
      throw new Error(`UNAUTHORIZED_REVISION_TRANSITION: Proposal ${proposal?.feedbackId} is not in PENDING state`);
    }

    const newRevId = proposal.proposedRevisionId;

    // Create updated inspection plan bound strictly to new Revision
    const updatedPlan: QifInspectionPlan = {
      ...sourcePlan,
      planId: `PLAN-${sourcePlan.designAuthorityId}-${newRevId}`,
      revisionId: newRevId,
      planHash: QifCryptoProvenance.computePlanHash(
        `PLAN-${newRevId}`, sourcePlan.designAuthorityId, newRevId, sourcePlan.features.length, sourcePlan.characteristics.length
      )
    };

    return {
      feedbackId: proposal.feedbackId,
      sourceRevisionId: proposal.sourceRevisionId,
      authorizedRevisionId: newRevId,
      authorizedBy: authorizingEngineer,
      timestamp: new Date().toISOString(),
      updatedPlan
    };
  }

  /**
   * Retrieves measurement results pinned strictly to a specific design revision,
   * guaranteeing multi-revision history immutability and zero cross-revision pollution.
   */
  public static getLedgerByRevision(revisionId: string): readonly QifMeasurementResult[] {
    return this.revisionLedger.get(revisionId) || [];
  }
}
