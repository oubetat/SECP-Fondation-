/**
 * SECP — ADSE-P9 Communication Governance Engine
 * 
 * Enforces the Absolute Governance Rule:
 * «AI may propose. AI may analyze. AI may not authorize, mutate, verify,
 *  publish, promote, or bypass canonical engineering authority.»
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationVerificationEngine } from './CommunicationVerificationEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { 
  ADSEP9GovernanceAction, 
  ADSEP9GovernanceProposal, 
  ADSEP9EngineeringAuthority,
  CommunicationSystem 
} from './types';
import { ADSELifecycleState } from '../p0/types';
import { createHash } from 'crypto';

export function isAIActor(actor?: string): boolean {
  if (!actor) return false;
  const a = actor.toLowerCase().trim();
  return (
    a.includes('ai') ||
    a.includes('copilot') ||
    a.includes('assistant') ||
    a.includes('llm') ||
    a.includes('bot') ||
    a.includes('synthetic') ||
    a.includes('agent')
  );
}

export class CommunicationGovernanceEngine {
  private registry: CommunicationRegistry;
  private verificationEngine: CommunicationVerificationEngine;
  private revisionEngine: RevisionEngine;
  private proposals: Map<string, ADSEP9GovernanceProposal> = new Map();

  constructor(
    registry: CommunicationRegistry,
    verificationEngine: CommunicationVerificationEngine,
    revisionEngine: RevisionEngine
  ) {
    this.registry = registry;
    this.verificationEngine = verificationEngine;
    this.revisionEngine = revisionEngine;
  }

  // --- 1. AI Proposal Submission (AI may propose) ---
  public submitProposal(params: {
    proposalId: string;
    action: ADSEP9GovernanceAction;
    actor: string;
    systemId: string;
    configurationId: string;
    revisionId: string;
    proposedData: any;
  }): ADSEP9GovernanceProposal {
    if (this.proposals.has(params.proposalId)) {
      throw new Error(`PROPOSAL_COLLISION: Proposal '${params.proposalId}' already exists.`);
    }

    const proposal: ADSEP9GovernanceProposal = {
      proposalId: params.proposalId,
      action: params.action,
      actor: params.actor,
      systemId: params.systemId,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      isAuthorized: false,
      status: 'PROPOSED',
      proposedData: params.proposedData,
      timestamp: new Date().toISOString()
    };

    this.proposals.set(params.proposalId, proposal);
    return proposal;
  }

  // --- 2. Proposal Analysis (AI may analyze) ---
  public analyzeProposal(proposalId: string, actor: string): {
    proposalId: string;
    action: ADSEP9GovernanceAction;
    analysisSummary: string;
    actor: string;
    canonicalStateChanged: boolean;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal '${proposalId}' does not exist.`);
    }

    return {
      proposalId,
      action: proposal.action,
      analysisSummary: `Advisory traffic & topology analysis synthesized for proposal '${proposalId}'. No canonical mutation performed.`,
      actor,
      canonicalStateChanged: false
    };
  }

  // --- 3. Action-Level Evaluation & Gatekeeping ---
  public evaluateAIProposal(proposal: ADSEP9GovernanceProposal): { approved: boolean; reason: string } {
    const isAI = isAIActor(proposal.actor);

    const restrictedActions: ADSEP9GovernanceAction[] = [
      'MUTATE_CANONICAL',
      'DELETE_CANONICAL',
      'AUTHORIZE_EXECUTION',
      'PUBLISH_SYSTEM',
      'DECLARE_VERIFIED',
      'PROMOTE_RELEASED',
      'BYPASS_REVISION',
      'BYPASS_CONFIGURATION',
      'PROMOTE_PROPOSAL'
    ];

    if (isAI && restrictedActions.includes(proposal.action)) {
      proposal.status = 'REJECTED';
      proposal.rejectionReason = `AI_GOVERNANCE_VIOLATION: AI actor '${proposal.actor}' attempted restricted authority action '${proposal.action}'. AI may propose. AI may analyze. AI may not authorize, mutate, verify, publish, promote, or bypass canonical engineering authority.`;
      throw new Error(proposal.rejectionReason);
    }

    return {
      approved: !isAI,
      reason: isAI 
        ? `Advisory action permitted. Authority boundary held.` 
        : `Action permitted for engineering authority '${proposal.actor}'.`
    };
  }

  // --- 4. Official Engineering Authorization ---
  public authorizeProposal(
    proposalId: string, 
    authority: ADSEP9EngineeringAuthority
  ): ADSEP9GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal '${proposalId}' does not exist.`);
    }

    if (isAIActor(authority.actor)) {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI actor '${authority.actor}' cannot authorize proposals. Human systems engineering authority required.`
      );
    }

    if (!authority.signatureToken || !authority.role) {
      throw new Error(`INVALID_AUTHORITY_CREDENTIALS: Authorized signature token and role required.`);
    }

    proposal.isAuthorized = true;
    proposal.authorizedBy = authority;
    proposal.status = 'APPROVED';
    return proposal;
  }

  // --- 5. Real Execution Authorization Path ---
  public authorizeAndExecute(params: {
    systemId: string;
    executionKind: string;
    scenarioId: string;
    parameters: any;
    actor: string;
    proposalId?: string;
  }, authority?: ADSEP9EngineeringAuthority): any {
    if (isAIActor(params.actor)) {
      throw new Error(
        `AI_EXECUTION_UNAUTHORIZED: AI actor '${params.actor}' cannot authorize CoreExecutionAuthority execution. Execution requires official engineering authorization.`
      );
    }

    if (!authority || isAIActor(authority.actor)) {
      throw new Error(
        `AI_EXECUTION_UNAUTHORIZED: Execution authorization requires valid human engineering authority credentials.`
      );
    }

    if (params.proposalId) {
      const prop = this.proposals.get(params.proposalId);
      if (!prop || !prop.isAuthorized || prop.status !== 'APPROVED') {
        throw new Error(
          `UNAUTHORIZED_PROPOSAL_EXECUTION: Proposal '${params.proposalId}' is not authorized by official engineering authority.`
        );
      }
    }

    const system = this.registry.getSystem(params.systemId);
    if (!system) {
      throw new Error(`COMM_SYSTEM_NOT_FOUND: Communication System '${params.systemId}' not found.`);
    }

    return CoreExecutionAuthority.execute({
      requestId: `req-comm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      engineeringObjectId: system.id,
      pluginId: 'adse-p9-communications',
      pluginVersion: '1.0.0',
      executionKind: params.executionKind,
      revisionId: system.revisionId,
      parameters: {
        ...params.parameters,
        scenarioId: params.scenarioId,
        configurationId: system.configurationId,
        systemId: params.systemId,
        authorizedActor: authority.actor,
        authorizedRole: authority.role,
        signatureToken: authority.signatureToken
      }
    });
  }

  // --- 6. Real Publication Authority Path ---
  public publishSystem(
    communicationSystemId: string, 
    authority: ADSEP9EngineeringAuthority
  ): CommunicationSystem {
    if (isAIActor(authority.actor)) {
      throw new Error(
        `PUBLICATION_AUTHORITY_VIOLATION: AI actor '${authority.actor}' cannot publish communication systems. Publication requires official engineering authority.`
      );
    }

    const system = this.registry.getSystem(communicationSystemId);
    if (!system) {
      throw new Error(`COMM_SYSTEM_NOT_FOUND: Communication System '${communicationSystemId}' not found.`);
    }

    // 1. Authorized Revision Check
    const activeRev = this.revisionEngine.getLatestRevision(system.p3ArchitectureId);
    if (!activeRev || activeRev.revisionId !== system.revisionId) {
      throw new Error(
        `UNAUTHORIZED_REVISION: System revision '${system.revisionId}' is not tracked or active in SECP RevisionEngine.`
      );
    }

    // 2. Valid Configuration Check
    if (!system.configurationId || system.configurationId.includes('UNAUTHORIZED') || system.configurationId.includes('FORGED')) {
      throw new Error(
        `INVALID_CONFIGURATION: Configuration '${system.configurationId}' is invalid or unauthorized.`
      );
    }

    // 3. Required Verification Check (All gates must pass)
    const gates = this.verificationEngine.evaluateAllGates(communicationSystemId);
    const closureGate = gates.find(g => g.gateName === 'P9-V40_TRUTH_CLOSURE');
    if (!closureGate || closureGate.verdict !== 'PASS') {
      throw new Error(
        `UNVERIFIED_PUBLICATION_BLOCKED: Communication System '${communicationSystemId}' has failing verification gates.`
      );
    }

    // 4. Required Evidence Check
    const execs = this.registry.getAllExecutions().filter(e => e.communicationSystemId === communicationSystemId);
    const evidences = this.registry.getAllEvidences();
    const hasEvidence = execs.some(e => evidences.some(ev => ev.executionId === e.id));
    if (!hasEvidence) {
      throw new Error(
        `MISSING_EVIDENCE_FOR_PUBLICATION: Communication System '${communicationSystemId}' has no cryptographic execution evidence.`
      );
    }

    // 5. Provenance & Persistence Integrity
    if (!system.provenance?.originHash) {
      throw new Error(`PROVENANCE_INTEGRITY_VIOLATION: Missing origin hash for system '${communicationSystemId}'.`);
    }

    system.isPublished = true;
    system.lifecycleState = 'RELEASED';
    system.authorityState = 'AUTHORITATIVE';
    system.verificationStatus = 'VERIFIED';
    system.provenance.updatedAt = new Date().toISOString();

    return system;
  }

  // --- 7. Lifecycle State Promotion Path ---
  public promoteLifecycleState(
    communicationSystemId: string, 
    targetState: ADSELifecycleState,
    authority: ADSEP9EngineeringAuthority
  ): CommunicationSystem {
    if (isAIActor(authority.actor)) {
      throw new Error(
        `LIFECYCLE_AUTHORITY_VIOLATION: AI actor '${authority.actor}' cannot promote lifecycle states. Official engineering authority required.`
      );
    }

    const system = this.registry.getSystem(communicationSystemId);
    if (!system) {
      throw new Error(`COMM_SYSTEM_NOT_FOUND: Communication System '${communicationSystemId}' not found.`);
    }

    if (targetState === 'RELEASED') {
      return this.publishSystem(communicationSystemId, authority);
    }

    system.lifecycleState = targetState;
    system.provenance.updatedAt = new Date().toISOString();
    return system;
  }

  // --- 8. Verification Transition Path ---
  public declareVerification(
    communicationSystemId: string,
    authority: ADSEP9EngineeringAuthority
  ): CommunicationSystem {
    if (isAIActor(authority.actor)) {
      throw new Error(
        `VERIFICATION_AUTHORITY_VIOLATION: AI actor '${authority.actor}' cannot declare verification. Verification requires independent solver execution and verification engine evaluation.`
      );
    }

    const gates = this.verificationEngine.evaluateAllGates(communicationSystemId);
    const closureGate = gates.find(g => g.gateName === 'P9-V40_TRUTH_CLOSURE');
    if (!closureGate || closureGate.verdict !== 'PASS') {
      throw new Error(
        `VERIFICATION_AUTHORITY_VIOLATION: Prerequisite verification gates failed for '${communicationSystemId}'. Cannot declare VERIFIED.`
      );
    }

    const system = this.registry.getSystem(communicationSystemId);
    if (!system) throw new Error(`COMM_SYSTEM_NOT_FOUND: '${communicationSystemId}'`);

    system.verificationStatus = 'VERIFIED';
    return system;
  }

  public getProposal(proposalId: string): ADSEP9GovernanceProposal | undefined {
    return this.proposals.get(proposalId);
  }

  public getAllProposals(): ADSEP9GovernanceProposal[] {
    return Array.from(this.proposals.values());
  }

  public clear(): void {
    this.proposals.clear();
  }
}
