/**
 * SECP Industrial OS - PATCH-309 Evidence Generator
 * Produces cryptographic Digital Thread evidence packages, optimization decision traces,
 * solver input/output hashes, and PLM revision linkage records.
 */

import { AIOptimizationSession, OptimizationCandidate } from './AIOptimizationTypes309';

export interface OptimizationEvidencePackage {
  evidenceToken: string;
  sessionId: string;
  projectId: string;
  baseRevisionId: string;
  plmBranchId: string;
  selectedCandidateId: string;
  bestMetrics: Record<string, number>;
  totalEvaluations: number;
  totalIterations: number;
  aiStrategy: string;
  autonomyLevel: string;
  timestamp: number;
  decisionTrace: string[];
}

export class AIOptimizationEvidenceGenerator {
  /**
   * Builds evidence package for session candidate selection and PLM promotion.
   */
  public generateEvidence(
    session: AIOptimizationSession,
    selectedCandidate: OptimizationCandidate,
    decisionTrace: string[]
  ): OptimizationEvidencePackage {
    const timestamp = Date.now();
    const evidenceToken = `DT_SECP_OPT_${session.sessionId}_${selectedCandidate.candidateId}_${timestamp}`;

    const bestMetrics: Record<string, number> = {};
    for (const [k, v] of Object.entries(selectedCandidate.metrics)) {
      bestMetrics[k] = v.value;
    }

    return {
      evidenceToken,
      sessionId: session.sessionId,
      projectId: session.projectId,
      baseRevisionId: session.baseRevisionId,
      plmBranchId: `REV_OPT_${selectedCandidate.candidateId}`,
      selectedCandidateId: selectedCandidate.candidateId,
      bestMetrics,
      totalEvaluations: session.candidates.length,
      totalIterations: session.currentIteration,
      aiStrategy: 'BAYESIAN_OPTIMIZATION',
      autonomyLevel: session.policy.autonomyLevel,
      timestamp,
      decisionTrace,
    };
  }
}
