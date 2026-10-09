/**
 * SECP — ADSE-P6 Thermal Integration & Multi-Physics Engineering Truth Façade
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Invariant:
 * «Thermal Integration does not create an independent thermal truth. It establishes the
 * authoritative, verifiable and reconstructable thermal relationships between canonical geometry,
 * structure, materials, interfaces, thermal loads, boundary conditions, execution,
 * verification and evidence.»
 */

import { ADSEEngine } from '../p0/ADSEEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { ThermalMaterialBindingEngine } from './ThermalMaterialBindingEngine';
import { ThermalRegistry } from './ThermalRegistry';
import { ThermalBoundaryEngine } from './ThermalBoundaryEngine';
import { ThermalInterfaceEngine } from './ThermalInterfaceEngine';
import { ThermalPathEngine } from './ThermalPathEngine';
import { ThermalSolverBridge } from './ThermalSolverBridge';
import { ThermalVerificationAndEvidenceEngine } from './ThermalVerificationAndEvidenceEngine';
import { ThermalResultInvalidationEngine } from './ThermalResultInvalidationEngine';
import { ThermalImpactAnalyzer } from './ThermalImpactAnalyzer';
import { ThermalConsistencyEngine } from './ThermalConsistencyEngine';
import { ThermalPersistenceEngine } from './ThermalPersistenceEngine';
import { ADSEP6GovernanceProposal } from './types';
import { EngineeringAuthority } from '../p0/types';

export class ADSEP6ThermalEngine {
  private static instance: ADSEP6ThermalEngine;

  public readonly revisionEngine: RevisionEngine;
  public readonly materials: ThermalMaterialBindingEngine;
  public readonly registry: ThermalRegistry;
  public readonly boundaries: ThermalBoundaryEngine;
  public readonly interfaces: ThermalInterfaceEngine;
  public readonly paths: ThermalPathEngine;
  public readonly solver: ThermalSolverBridge;
  public readonly verifications: ThermalVerificationAndEvidenceEngine;
  public readonly invalidations: ThermalResultInvalidationEngine;
  public readonly impact: ThermalImpactAnalyzer;
  public readonly consistency: ThermalConsistencyEngine;
  public readonly persistence: ThermalPersistenceEngine;

  private proposals: Map<string, ADSEP6GovernanceProposal> = new Map();

  public constructor() {
    this.revisionEngine = ADSEEngine.getInstance().getRevisionEngine();
    this.materials = new ThermalMaterialBindingEngine();
    this.registry = new ThermalRegistry(this.revisionEngine, this.materials);
    this.boundaries = new ThermalBoundaryEngine(this.registry);
    this.interfaces = new ThermalInterfaceEngine(this.registry);
    this.paths = new ThermalPathEngine(this.registry);
    this.solver = new ThermalSolverBridge();
    this.verifications = new ThermalVerificationAndEvidenceEngine();
    this.invalidations = new ThermalResultInvalidationEngine(this.solver, this.verifications);
    this.impact = new ThermalImpactAnalyzer(
      this.registry,
      this.boundaries,
      this.interfaces,
      this.solver,
      this.verifications
    );
    this.consistency = new ThermalConsistencyEngine(
      this.registry,
      this.materials,
      this.boundaries,
      this.interfaces,
      this.paths,
      this.solver,
      this.verifications
    );
    this.persistence = new ThermalPersistenceEngine(
      this.registry,
      this.materials,
      this.boundaries,
      this.interfaces,
      this.paths,
      this.solver,
      this.verifications
    );

    this.registerP6Capabilities();
  }

  public static getInstance(): ADSEP6ThermalEngine {
    if (!ADSEP6ThermalEngine.instance) {
      ADSEP6ThermalEngine.instance = new ADSEP6ThermalEngine();
    }
    return ADSEP6ThermalEngine.instance;
  }

  // --- AI Governance Layer ---

  /**
   * AI can submit proposals for thermal boundaries, loads, or candidate models.
   * AI CANNOT authorize or publish directly.
   */
  public submitAIProposal(params: {
    proposalId: string;
    action: 'CREATE_MODEL' | 'MODIFY_MATERIAL' | 'SET_BOUNDARY' | 'RUN_EXECUTION' | 'PUBLISH_TRUTH';
    payload: any;
  }): ADSEP6GovernanceProposal {
    const proposal: ADSEP6GovernanceProposal = {
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
   * Human Engineer or Engineering Authority authorizes an AI proposal.
   */
  public authorizeProposal(proposalId: string, authority: EngineeringAuthority): ADSEP6GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`PROPOSAL_NOT_FOUND: Proposal '${proposalId}' does not exist.`);
    }
    proposal.isAuthorized = true;
    proposal.authorizedBy = authority;
    return proposal;
  }

  /**
   * Attempts to publish a Thermal Model as verified Engineering Truth.
   * Rejects if there is no verified evidence.
   */
  public publishThermalModel(thermalId: string, authority: EngineeringAuthority): void {
    const model = this.registry.getModel(thermalId);
    if (!model) throw new Error(`MODEL_NOT_FOUND: Thermal Model '${thermalId}' not found.`);

    const evidences = this.verifications.getAllEvidences().filter(e => e.thermalId === thermalId);
    if (evidences.length === 0) {
      throw new Error(`UNVERIFIED_PUBLICATION_BLOCKED: Thermal Model '${thermalId}' has no verified evidence and cannot be published.`);
    }

    model.isPublished = true;
    model.authority = authority;
    model.updatedAt = new Date().toISOString();
  }

  /**
   * Registers all 35 required ADSE-P6 capabilities into the central ADSE capability registry.
   */
  private registerP6Capabilities(): void {
    const adse = ADSEEngine.getInstance();
    const capabilities = [
      'ADSE_THERMAL_INTEGRATION',
      'ADSE_THERMAL_TRUTH',
      'ADSE_THERMAL_MODEL',
      'ADSE_THERMAL_REGIONS',
      'ADSE_THERMAL_TOPOLOGY',
      'ADSE_THERMAL_PATHS',
      'ADSE_HEAT_SOURCE_TRUTH',
      'ADSE_HEAT_SINK_TRUTH',
      'ADSE_THERMAL_LOADS',
      'ADSE_THERMAL_BOUNDARIES',
      'ADSE_THERMAL_INTERFACES',
      'ADSE_THERMAL_MATERIAL_BINDING',
      'ADSE_THERMAL_PROPERTY_TRUTH',
      'ADSE_CONDUCTION_ANALYSIS',
      'ADSE_CONVECTION_ANALYSIS',
      'ADSE_RADIATION_ANALYSIS',
      'ADSE_STEADY_STATE_THERMAL',
      'ADSE_TRANSIENT_THERMAL',
      'ADSE_THERMAL_EXECUTION',
      'ADSE_THERMAL_SOLVER_BINDING',
      'ADSE_THERMAL_RESULT_INVALIDATION',
      'ADSE_THERMAL_CONSTRAINTS',
      'ADSE_THERMAL_MARGINS',
      'ADSE_THERMAL_IMPACT_ANALYSIS',
      'ADSE_THERMAL_STRUCTURAL_COUPLING',
      'ADSE_THERMAL_DIGITAL_THREAD',
      'ADSE_THERMAL_VERIFICATION',
      'ADSE_THERMAL_EVIDENCE',
      'ADSE_THERMAL_PROVENANCE',
      'ADSE_THERMAL_PERSISTENCE',
      'ADSE_THERMAL_RECONSTRUCTION',
      'ADSE_THERMAL_AI_GOVERNANCE',
      'ADSE_THERMAL_FORENSIC_AUDIT',
      'ADSE_THERMAL_PUBLICATION',
      'ADSE_THERMAL_TRUTH_CLOSURE'
    ];

    capabilities.forEach(cap => {
      adse.registerCapability({
        capabilityId: cap,
        name: cap.replace(/_/g, ' '),
        domain: 'AEROSPACE_DEFENSE',
        stage: 'P6_THERMAL_INTEGRATION',
        status: 'ACTIVE',
        governingPrinciple: 'Thermal Integration establishes verifiable thermal consequences without creating parallel authority',
        authority: 'SYSTEM_ARCHITECT'
      });
    });
  }

  public clear(): void {
    this.registry.clear();
    this.materials.clear();
    this.boundaries.clear();
    this.interfaces.clear();
    this.paths.clear();
    this.solver.clear();
    this.verifications.clear();
    this.proposals.clear();
  }
}
