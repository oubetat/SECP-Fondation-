/**
 * SECP — ADSE-P7 Power Integration & Power Engineering Truth Façade
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Invariant:
 * «Power Integration does not create an independent power truth. It establishes the
 * authoritative, verifiable and reconstructable relationships between canonical system
 * architecture, components, electrical interfaces, sources, loads, distribution paths,
 * storage, conversion, protection, operating states, thermal consequences, execution,
 * verification and evidence.»
 */

import { ADSEEngine } from '../p0/ADSEEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { PowerRegistry } from './PowerRegistry';
import { PowerTopologyEngine } from './PowerTopologyEngine';
import { PowerConversionAndStorageEngine } from './PowerConversionAndStorageEngine';
import { PowerBudgetEngine } from './PowerBudgetEngine';
import { PowerSolverBridge } from './PowerSolverBridge';
import { PowerThermalCouplingEngine } from './PowerThermalCouplingEngine';
import { PowerVerificationAndEvidenceEngine } from './PowerVerificationAndEvidenceEngine';
import { PowerResultInvalidationEngine } from './PowerResultInvalidationEngine';
import { PowerImpactAnalyzer } from './PowerImpactAnalyzer';
import { PowerConsistencyEngine } from './PowerConsistencyEngine';
import { PowerPersistenceEngine } from './PowerPersistenceEngine';
import { ADSEP6ThermalEngine } from '../p6/ADSEP6ThermalEngine';
import { ADSEP7GovernanceProposal } from './types';
import { EngineeringAuthority } from '../p0/types';

export class ADSEP7PowerEngine {
  private static instance: ADSEP7PowerEngine;

  public readonly revisionEngine: RevisionEngine;
  public readonly registry: PowerRegistry;
  public readonly topology: PowerTopologyEngine;
  public readonly conversion: PowerConversionAndStorageEngine;
  public readonly budget: PowerBudgetEngine;
  public readonly solver: PowerSolverBridge;
  public readonly thermalCoupling: PowerThermalCouplingEngine;
  public readonly verifications: PowerVerificationAndEvidenceEngine;
  public readonly invalidations: PowerResultInvalidationEngine;
  public readonly impact: PowerImpactAnalyzer;
  public readonly consistency: PowerConsistencyEngine;
  public readonly persistence: PowerPersistenceEngine;

  private proposals: Map<string, ADSEP7GovernanceProposal> = new Map();

  public constructor(p6Engine?: ADSEP6ThermalEngine) {
    this.revisionEngine = ADSEEngine.getInstance().getRevisionEngine();
    this.registry = new PowerRegistry(this.revisionEngine);
    this.topology = new PowerTopologyEngine(this.registry);
    this.conversion = new PowerConversionAndStorageEngine(this.registry);
    this.budget = new PowerBudgetEngine(this.registry, this.topology, this.conversion);
    this.solver = new PowerSolverBridge();
    this.thermalCoupling = new PowerThermalCouplingEngine(this.registry, p6Engine);
    this.verifications = new PowerVerificationAndEvidenceEngine();
    this.invalidations = new PowerResultInvalidationEngine(this.solver, this.verifications);
    this.impact = new PowerImpactAnalyzer(this.registry, this.solver, this.verifications);
    this.consistency = new PowerConsistencyEngine(
      this.registry,
      this.topology,
      this.solver,
      this.verifications
    );
    this.persistence = new PowerPersistenceEngine(
      this.registry,
      this.topology,
      this.solver,
      this.verifications
    );

    this.registerP7Capabilities();
  }

  public static getInstance(p6Engine?: ADSEP6ThermalEngine): ADSEP7PowerEngine {
    if (!ADSEP7PowerEngine.instance) {
      ADSEP7PowerEngine.instance = new ADSEP7PowerEngine(p6Engine);
    }
    return ADSEP7PowerEngine.instance;
  }

  // --- AI Governance Layer ---

  /**
   * AI submits power proposals. AI CANNOT authorize or publish directly.
   */
  public submitAIProposal(params: {
    proposalId: string;
    action: 'CREATE_SYSTEM' | 'MODIFY_LOAD' | 'UPDATE_TOPOLOGY' | 'SET_CONVERTER' | 'RUN_EXECUTION' | 'PUBLISH_TRUTH';
    payload: any;
  }): ADSEP7GovernanceProposal {
    const proposal: ADSEP7GovernanceProposal = {
      proposalId: params.proposalId,
      action: params.action,
      proposedBy: 'AI_AGENT',
      isAuthorized: false,
      payload: params.payload
    };
    this.proposals.set(params.proposalId, proposal);
    return proposal;
  }

  /**
   * Human Engineer / Engineering Authority authorizes an AI proposal.
   */
  public authorizeProposal(proposalId: string, authority: EngineeringAuthority): ADSEP7GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal '${proposalId}' does not exist.`);
    }
    proposal.isAuthorized = true;
    proposal.authorizedBy = authority;
    return proposal;
  }

  /**
   * Publishes a Power System as verified Engineering Truth.
   * Rejects if there is no verified evidence.
   */
  public publishPowerSystem(systemId: string, authority: EngineeringAuthority): void {
    const system = this.registry.getSystem(systemId);
    if (!system) throw new Error(`SYSTEM_NOT_FOUND: Power System '${systemId}' not found.`);

    const evidences = this.verifications.getAllEvidences().filter(e => e.systemId === systemId);
    if (evidences.length === 0) {
      throw new Error(`UNVERIFIED_PUBLICATION_BLOCKED: Power System '${systemId}' has no verified evidence and cannot be published.`);
    }

    system.isPublished = true;
    system.authority = authority;
    system.updatedAt = new Date().toISOString();
  }

  /**
   * Registers all 35 required ADSE-P7 capabilities into the central ADSE capability registry.
   */
  private registerP7Capabilities(): void {
    const adse = ADSEEngine.getInstance();
    const capabilities = [
      'ADSE_POWER_INTEGRATION',
      'ADSE_POWER_TRUTH',
      'ADSE_POWER_SYSTEM_MODEL',
      'ADSE_POWER_DOMAINS',
      'ADSE_POWER_SOURCES',
      'ADSE_POWER_LOADS',
      'ADSE_POWER_BUSES',
      'ADSE_POWER_DISTRIBUTION_TOPOLOGY',
      'ADSE_POWER_BRANCHES',
      'ADSE_POWER_CONVERSION',
      'ADSE_POWER_STORAGE',
      'ADSE_POWER_PROTECTION',
      'ADSE_POWER_OPERATING_STATES',
      'ADSE_POWER_BUDGET_BALANCE',
      'ADSE_POWER_LOAD_FLOW_ANALYSIS',
      'ADSE_POWER_CONVERTER_LOSSES',
      'ADSE_POWER_STORAGE_DYNAMICS',
      'ADSE_POWER_VOLTAGE_COMPLIANCE',
      'ADSE_POWER_PEAK_TRANSIENT_ANALYSIS',
      'ADSE_POWER_THERMAL_COUPLING',
      'ADSE_POWER_RESULT_INVALIDATION',
      'ADSE_POWER_SAFETY_MARGINS',
      'ADSE_POWER_IMPACT_ANALYSIS',
      'ADSE_POWER_STRUCTURAL_COUPLING',
      'ADSE_POWER_DIGITAL_THREAD',
      'ADSE_POWER_VERIFICATION',
      'ADSE_POWER_EVIDENCE',
      'ADSE_POWER_PROVENANCE',
      'ADSE_POWER_PERSISTENCE',
      'ADSE_POWER_RECONSTRUCTION',
      'ADSE_POWER_AI_GOVERNANCE',
      'ADSE_POWER_FORENSIC_AUDIT',
      'ADSE_POWER_CONFIGURATION_ISOLATION',
      'ADSE_POWER_PUBLICATION',
      'ADSE_POWER_TRUTH_CLOSURE'
    ];

    capabilities.forEach(cap => {
      adse.registerCapability({
        capabilityId: cap,
        name: cap.replace(/_/g, ' '),
        domain: 'AEROSPACE_DEFENSE',
        stage: 'P7_POWER_INTEGRATION',
        status: 'ACTIVE',
        governingPrinciple: 'Power Integration establishes verifiable electrical relationships and balances without creating parallel authority',
        authority: 'SYSTEM_ARCHITECT'
      });
    });
  }

  public clear(): void {
    this.registry.clear();
    this.topology.clear();
    this.solver.clear();
    this.thermalCoupling.clear();
    this.verifications.clear();
    this.proposals.clear();
  }
}
