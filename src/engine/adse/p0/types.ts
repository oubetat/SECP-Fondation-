/**
 * SECP — ADSE-P0 Architecture & Domain Contract Types
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 */

export type ADSEAuthorityState = 'DECLARED' | 'PROPOSED' | 'CORE_BOUND' | 'CANONICAL_BOUND' | 'AUTHORITATIVE' | 'REJECTED';

export type ADSELifecycleState = 'DRAFT' | 'IN_REVIEW' | 'VERIFIED' | 'RELEASED' | 'SUPERSEDED' | 'OBSOLETE';

/**
 * Common identity and lifecycle contract for ADSE objects
 */
export interface EngineeringEntity {
  id: string;
  type: ADSEEntityType;
  systemId: string;
  revisionId: string;
  configurationId: string;
  authorityState: ADSEAuthorityState;
  lifecycleState: ADSELifecycleState;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  relationships: Array<{
    targetId: string;
    relationshipType: string;
  }>;
  dependencies: string[];
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  evidenceReferences: string[];
}

export type ADSEEntityType = 
  | 'Requirement'
  | 'Function'
  | 'System'
  | 'Subsystem'
  | 'Component'
  | 'Interface'
  | 'Constraint'
  | 'Allocation'
  | 'Analysis'
  | 'VerificationCase'
  | 'Configuration'
  | 'Evidence'
  | 'ControlSystem'
  | 'ControlledPlant'
  | 'ControlLoop'
  | 'Controller'
  | 'ControlLaw'
  | 'ControlExecution'
  | 'ControlExecutionResult'
  | 'ControlVerificationIntent'
  | 'ControlEvidence'
  | 'ControlSnapshot';

export type SystemInterfaceType = 
  | 'Mechanical'
  | 'Electrical'
  | 'Thermal'
  | 'Power'
  | 'Control'
  | 'Data'
  | 'Software'
  | 'Sensor'
  | 'Manufacturing';

export interface SystemInterface {
  interfaceId: string;
  systemId: string;
  sourceId: string;
  targetId: string;
  interfaceType: SystemInterfaceType;
  parameters: Record<string, any>;
  constraints: string[];
  requirements: string[];
  verificationId?: string;
  evidenceId?: string;
  revisionId: string;
}

export interface SystemRequirement {
  id: string;
  systemId: string;
  title: string;
  statement: string;
  category: 'FUNCTIONAL' | 'PERFORMANCE' | 'SAFETY' | 'INTERFACE' | 'ENVIRONMENTAL';
  allocatedTo?: string[]; // Subsystem or Component IDs
  verificationMethod: 'ANALYSIS' | 'TEST' | 'INSPECTION' | 'SIMULATION';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'FAILED';
  evidenceReferences: string[];
}

export interface SystemModel {
  systemId: string;
  name: string;
  revisionId: string;
  configurationId: string;
  requirements: Map<string, SystemRequirement>;
  functions: Map<string, any>;
  subsystems: Map<string, any>;
  components: Map<string, any>;
  interfaces: Map<string, SystemInterface>;
  constraints: Map<string, any>;
  allocations: Map<string, any>;
  analyses: Map<string, any>;
  verifications: Map<string, any>;
  evidence: Map<string, any>;
  revisions: Map<string, any>;
}

/**
 * Unified Plugin Maturity Levels M0 -> M10
 */
export type PluginMaturityLevel = 
  | 'M0' // FORENSIC BASELINE
  | 'M1' // PLUGIN CONTRACT
  | 'M2' // SDK / REGISTRY
  | 'M3' // CORE INTEGRATION
  | 'M4' // CANONICAL INTEGRATION
  | 'M5' // REAL EXECUTION
  | 'M6' // VERIFICATION
  | 'M7' // EVIDENCE & PERSISTENCE
  | 'M8' // CROSS-DOMAIN INTEGRATION
  | 'M9' // BENCHMARK / INDUSTRIAL VALIDATION
  | 'M10'; // PRODUCTION PUBLICATION

/**
 * Authoritative Engineering Gate Stages
 */
export type EngineeringGateStage = 
  | 'DECLARE'
  | 'IMPLEMENT'
  | 'EXECUTE'
  | 'CORE_BIND'
  | 'CANONICAL_BIND'
  | 'VERIFY'
  | 'EVIDENCE'
  | 'PERSIST'
  | 'BENCHMARK'
  | 'PUBLISH';

export interface GateEvaluationResult {
  stage: EngineeringGateStage;
  passed: boolean;
  timestamp: string;
  reason: string;
  evidenceRef?: string;
}

export interface ADSECapabilityRegistration {
  capabilityId: string;
  pluginId: string;
  name: string;
  domain: string;
  maturity: PluginMaturityLevel;
  coreBound: boolean;
  canonicalBound: boolean;
  executable: boolean;
  verified: boolean;
  persisted: boolean;
  benchmarkValidated: boolean;
  published: boolean;
  gateResults: Record<EngineeringGateStage, GateEvaluationResult>;
}

export type GovernanceAction = 
  | 'VIEW'
  | 'ANALYZE'
  | 'PROPOSE'
  | 'EXECUTE'
  | 'VERIFY'
  | 'APPROVE'
  | 'PUBLISH';

export interface GovernanceActionRecord {
  actionId: string;
  action: GovernanceAction;
  actor: string;
  role: string;
  capabilityId: string;
  systemId: string;
  configurationId: string;
  revisionId: string;
  timestamp: string;
  evidenceId?: string;
  approved: boolean;
}
