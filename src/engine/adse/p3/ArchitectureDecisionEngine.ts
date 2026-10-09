/**
 * SECP — ADSE-P3 Architecture Decision & Trade Engine
 * Formalizes architecture decisions (ArchitectureDecision), rationale, alternatives,
 * trade studies, and evaluates trade-offs (coverage, complexity, dependency count).
 * Enforces human authorization: AI proposals remain proposals until approved.
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureDecision, ArchitectureTradeStudy } from './types';
import { createHash } from 'crypto';

export class ArchitectureDecisionEngine {
  private registry: ArchitectureElementRegistry;
  private decisions: Map<string, ArchitectureDecision> = new Map();
  private tradeStudies: Map<string, ArchitectureTradeStudy> = new Map();

  constructor(registry: ArchitectureElementRegistry) {
    this.registry = registry;
  }

  public proposeDecision(params: {
    decisionId: string;
    title: string;
    rationale: string;
    alternatives: string[];
    selectedConcept: string;
    affectedElementArchIds: string[];
    constraints?: string[];
    requirementIds?: string[];
    assumptions?: string[];
    risks?: string[];
    verificationIntentId?: string;
    configurationId: string;
    proposedBy: string;
  }): ArchitectureDecision {
    if (this.decisions.has(params.decisionId)) {
      throw new Error(`DECISION_ERROR: Decision '${params.decisionId}' already registered.`);
    }

    // Validate that affected elements exist in the registry
    for (const archId of params.affectedElementArchIds) {
      if (!this.registry.getElement(archId)) {
        throw new Error(`DECISION_ERROR: Affected architecture element '${archId}' not found.`);
      }
    }

    const provenanceId = `PROV-DECISION-${createHash('sha256').update(params.decisionId + params.title).digest('hex').substring(0, 12)}`;

    const decision: ArchitectureDecision = {
      decisionId: params.decisionId,
      title: params.title,
      rationale: params.rationale,
      alternatives: params.alternatives,
      selectedConcept: params.selectedConcept,
      affectedElementArchIds: params.affectedElementArchIds,
      constraints: params.constraints || [],
      requirementIds: params.requirementIds || [],
      assumptions: params.assumptions || [],
      risks: params.risks || [],
      verificationIntentId: params.verificationIntentId,
      revisionId: `REV-${params.decisionId}-01`,
      provenanceId,
      configurationId: params.configurationId,
      status: 'PROPOSED'
    };

    this.decisions.set(params.decisionId, decision);
    return decision;
  }

  public authorizeDecision(decisionId: string, authorizedBy: string): ArchitectureDecision {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error(`DECISION_ERROR: Decision '${decisionId}' not found.`);
    }

    const isAI = authorizedBy.toLowerCase().includes('ai') || 
                 authorizedBy.toLowerCase().includes('copilot') || 
                 authorizedBy.toLowerCase().includes('assistant');

    if (isAI) {
      throw new Error(`AI_AUTHORITY_VIOLATION: AI actor '${authorizedBy}' cannot authorize Architecture Decision '${decisionId}'. Requires human engineering authority.`);
    }

    decision.status = 'AUTHORIZED';
    decision.authorizedBy = authorizedBy;
    decision.authorizedAt = new Date().toISOString();

    return decision;
  }

  public registerTradeStudy(study: ArchitectureTradeStudy): ArchitectureTradeStudy {
    if (this.tradeStudies.has(study.tradeStudyId)) {
      throw new Error(`TRADE_STUDY_ERROR: Trade study '${study.tradeStudyId}' already exists.`);
    }

    // Compute scores for each alternative
    for (const alt of study.alternatives) {
      const s = alt.scores;
      // Formula: higher coverage is better, lower complexity/dependencies is better
      alt.overallScore = parseFloat((
        (s.requirementCoverage * 0.4) +
        ((100 - s.interfaceComplexity) * 0.2) +
        ((100 - Math.min(100, s.dependencyCount * 10)) * 0.15) +
        ((100 - Math.min(100, s.constraintViolationsCount * 25)) * 0.15) +
        ((100 - s.verificationBurden) * 0.1)
      ).toFixed(2));
    }

    // Sort descending by score
    study.alternatives.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

    this.tradeStudies.set(study.tradeStudyId, study);
    return study;
  }

  public getDecision(decisionId: string): ArchitectureDecision | undefined {
    return this.decisions.get(decisionId);
  }

  public getAllDecisions(): ArchitectureDecision[] {
    return Array.from(this.decisions.values());
  }

  public getTradeStudy(tradeStudyId: string): ArchitectureTradeStudy | undefined {
    return this.tradeStudies.get(tradeStudyId);
  }

  public getAllTradeStudies(): ArchitectureTradeStudy[] {
    return Array.from(this.tradeStudies.values());
  }

  public clear(): void {
    this.decisions.clear();
    this.tradeStudies.clear();
  }
}
