/**
 * SECP — ADSE-P9 Communication Engine (Orchestrator)
 * 
 * Main entry point for Communications Integration & Information Engineering Truth.
 * Orchestrates topology, flow, link, analysis, execution, verification, persistence,
 * and forensic auditing.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationArchitectureEngine } from './CommunicationArchitectureEngine';
import { CommunicationFlowEngine } from './CommunicationFlowEngine';
import { CommunicationLinkEngine } from './CommunicationLinkEngine';
import { CommunicationAnalysisEngine } from './CommunicationAnalysisEngine';
import { CommunicationExecutionEngine } from './CommunicationExecutionEngine';
import { CommunicationVerificationEngine } from './CommunicationVerificationEngine';
import { CommunicationResultInvalidationEngine } from './CommunicationResultInvalidationEngine';
import { CommunicationImpactAnalyzer } from './CommunicationImpactAnalyzer';
import { CommunicationPersistenceEngine } from './CommunicationPersistenceEngine';
import { ADSEP9ForensicAuditEngine } from './ADSEP9ForensicAuditEngine';
import { CommunicationGovernanceEngine } from './CommunicationGovernanceEngine';

import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { MBSEBehavioralEngine } from '../p2/MBSEBehavioralEngine';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { 
  ADSE_P9_CAPABILITIES, 
  ADSEP9GovernanceProposal, 
  ADSEP9GovernanceAction, 
  ADSEP9EngineeringAuthority 
} from './types';

export class ADSEP9CommunicationEngine {
  public registry: CommunicationRegistry;
  public architecture: CommunicationArchitectureEngine;
  public flow: CommunicationFlowEngine;
  public link: CommunicationLinkEngine;
  public analysis: CommunicationAnalysisEngine;
  public execution: CommunicationExecutionEngine;
  public verification: CommunicationVerificationEngine;
  public invalidation: CommunicationResultInvalidationEngine;
  public impact: CommunicationImpactAnalyzer;
  public persistence: CommunicationPersistenceEngine;
  public forensics: ADSEP9ForensicAuditEngine;
  public governance: CommunicationGovernanceEngine;

  private behavioralEngine: MBSEBehavioralEngine;
  private digitalThread: DigitalThreadRegistry;
  private capabilityRegister: Map<string, boolean> = new Map();

  constructor(
    revisionEngine: RevisionEngine,
    behavioralEngine: MBSEBehavioralEngine,
    digitalThread: DigitalThreadRegistry
  ) {
    this.behavioralEngine = behavioralEngine;
    this.digitalThread = digitalThread;

    this.registry = new CommunicationRegistry(revisionEngine, behavioralEngine, digitalThread);
    this.architecture = new CommunicationArchitectureEngine(this.registry);
    this.flow = new CommunicationFlowEngine(this.registry);
    this.link = new CommunicationLinkEngine(this.registry);
    this.analysis = new CommunicationAnalysisEngine(this.registry);
    this.execution = new CommunicationExecutionEngine(this.registry);
    this.verification = new CommunicationVerificationEngine(this.registry);
    this.invalidation = new CommunicationResultInvalidationEngine(this.registry);
    this.impact = new CommunicationImpactAnalyzer(revisionEngine, this.registry);
    this.persistence = new CommunicationPersistenceEngine(this.registry);
    this.forensics = new ADSEP9ForensicAuditEngine(this.registry);
    this.governance = new CommunicationGovernanceEngine(this.registry, this.verification, revisionEngine);

    this.initializeCapabilityRegister();
    this.registerWithCore();
  }

  private initializeCapabilityRegister() {
    Object.values(ADSE_P9_CAPABILITIES).forEach(cap => {
      this.capabilityRegister.set(cap, true);
    });
  }

  private registerWithCore() {
    CoreExecutionAuthority.registerSolver({
      solverId: 'P9-COMM-ANALYSIS-SOLVER-V1',
      solverVersion: '1.0.0',
      pluginId: 'adse-p9-communications',
      executionKind: 'communication-analysis',
      execute: (req, snapshot) => this.execution.solve(req, snapshot)
    });
  }

  public getCapabilityRegister() {
    return Array.from(this.capabilityRegister.entries()).map(([name, active]) => ({
      name,
      active,
      status: active ? 'AUTHORIZED' : 'DEACTIVATED'
    }));
  }

  /**
   * High-level entry point to authorize a Communication System
   */
  public async authorizeCommunicationSystem(params: {
    systemId: string;
    architectureId: string;
    p4NodeId: string;
    configId: string;
  }) {
    const system = this.registry.registerSystem({
      id: `COMM-${params.systemId}`,
      systemId: params.systemId,
      p3ArchitectureId: params.architectureId,
      p4NodeId: params.p4NodeId,
      displayName: `Communication System for ${params.systemId}`,
      configurationId: params.configId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED'
    });

    return system;
  }

  /**
   * Consumes canonical revision impact analysis
   */
  public evaluateCanonicalImpact(changedRevisionId: string) {
    return this.registry.evaluateCanonicalRevisionImpact(changedRevisionId);
  }

  // --- AI Governance Access Points ---
  public submitAIProposal(params: {
    proposalId: string;
    action: ADSEP9GovernanceAction;
    actor: string;
    systemId: string;
    configurationId: string;
    revisionId: string;
    proposedData: any;
  }): ADSEP9GovernanceProposal {
    return this.governance.submitProposal(params);
  }

  public analyzeAIProposal(proposalId: string, actor: string) {
    return this.governance.analyzeProposal(proposalId, actor);
  }

  public evaluateAIProposal(proposal: ADSEP9GovernanceProposal) {
    return this.governance.evaluateAIProposal(proposal);
  }

  public authorizeProposal(proposalId: string, authority: ADSEP9EngineeringAuthority) {
    return this.governance.authorizeProposal(proposalId, authority);
  }

  public publishCommunicationSystem(communicationSystemId: string, authority: ADSEP9EngineeringAuthority) {
    return this.governance.publishSystem(communicationSystemId, authority);
  }

  public promoteLifecycleState(
    communicationSystemId: string, 
    targetState: any, 
    authority: ADSEP9EngineeringAuthority
  ) {
    return this.governance.promoteLifecycleState(communicationSystemId, targetState, authority);
  }
}
