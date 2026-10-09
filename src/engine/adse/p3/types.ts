/**
 * SECP — ADSE-P3 System Architecture Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 */

import { CoreBindingState } from '../p2/types';

export type ArchitecturalLayer = 
  | 'SYSTEM'
  | 'SUBSYSTEM'
  | 'COMPONENT'
  | 'SUBCOMPONENT'
  | 'EXTERNAL';

export type ArchitectureElementType = 
  | 'Architecture'
  | 'System'
  | 'Subsystem'
  | 'Component'
  | 'ExternalSystem'
  | 'SystemBoundary'
  | 'SubsystemBoundary'
  | 'ComponentBoundary'
  | 'ExternalInterface'
  | 'ArchitecturalLayer'
  | 'ArchitectureView'
  | 'ArchitectureConcern'
  | 'ArchitectureDecision'
  | 'ArchitectureConstraint'
  | 'ArchitectureAlternative'
  | 'ArchitectureTradeStudy';

export type ArchitectureRelationshipType = 
  | 'DECOMPOSES'
  | 'CONTAINS'
  | 'PART_OF'
  | 'ALLOCATED_TO'
  | 'DEPENDS_ON'
  | 'INTERFACES_WITH'
  | 'CONSTRAINED_BY'
  | 'VERIFIED_BY'
  | 'DERIVES_FROM'
  | 'REFINES'
  | 'SATISFIES'
  | 'BINDS_TO';

export type ArchitectureViewType = 
  | 'FUNCTIONAL'
  | 'LOGICAL'
  | 'PHYSICAL'
  | 'INTERFACE'
  | 'DEPENDENCY'
  | 'BEHAVIOR'
  | 'CONFIGURATION'
  | 'VERIFICATION';

export interface ArchitectureElementIdentity {
  archId: string; // e.g. 'arch:subsystem:S-02'
  elementType: ArchitectureElementType;
  displayName: string;
  layer: ArchitecturalLayer;
  configurationId: string;
  revisionId: string;
  coreBindingState: CoreBindingState;
  engineeringObjectId?: string; // SECP Core identity
  p2MbseId?: string; // P2 MBSE identity
  p1RequirementId?: string; // P1 Requirement identity
  revisionHash?: string;
  metadata: Record<string, any>;
}

export interface ArchitectureRelationshipContract {
  relationshipId: string;
  relationshipType: ArchitectureRelationshipType;
  sourceArchId: string;
  targetArchId: string;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  metadata?: Record<string, any>;
}

export interface ArchitectureDecision {
  decisionId: string; // e.g. 'AD-004'
  title: string;
  rationale: string;
  alternatives: string[]; // List of alternative concepts
  selectedConcept: string;
  affectedElementArchIds: string[];
  constraints: string[];
  requirementIds: string[];
  assumptions: string[];
  risks: string[];
  verificationIntentId?: string;
  revisionId: string;
  provenanceId: string;
  configurationId: string;
  status: 'PROPOSED' | 'UNDER_REVIEW' | 'AUTHORIZED' | 'REJECTED';
  authorizedBy?: string;
  authorizedAt?: string;
}

export type ArchitectureConstraintType = 
  | 'STRUCTURAL'
  | 'INTERFACE'
  | 'ALLOCATION'
  | 'DEPENDENCY'
  | 'CONFIGURATION'
  | 'RESOURCE'
  | 'COMPATIBILITY';

export interface ArchitectureConstraint {
  constraintId: string;
  type: ArchitectureConstraintType;
  displayName: string;
  expression: string; // e.g. 'totalPowerWatts <= 1500'
  affectedArchIds: string[];
  configurationId: string;
  solverIntent?: {
    pluginId: string;
    executionKind: string;
    parameters: Record<string, any>;
  };
}

export interface ArchitectureInterface {
  interfaceId: string;
  displayName: string;
  providerArchId: string;
  consumerArchId: string;
  direction: 'UNIDIRECTIONAL' | 'BIDIRECTIONAL';
  requiredContract: string;
  providedContract: string;
  flowItemType?: string;
  configurationId: string;
  revisionId: string;
  isCompatible: boolean;
  compatibilityDetails?: string;
}

export interface ArchitectureDependency {
  dependencyId: string;
  sourceArchId: string;
  targetArchId: string;
  dependencyType: 'DATA' | 'POWER' | 'MECHANICAL' | 'CONTROL' | 'LOGICAL';
  configurationId: string;
  revisionId: string;
  isBoundaryViolation?: boolean;
}

export interface ArchitectureTradeAlternative {
  alternativeId: string;
  displayName: string;
  description: string;
  conceptDescription: string;
  scores: {
    requirementCoverage: number; // 0-100
    interfaceComplexity: number; // 0-100 (lower is better)
    dependencyCount: number;
    constraintViolationsCount: number;
    verificationBurden: number; // 0-100
    manufacturingImpact: number; // 0-100
    configurationImpact: number; // 0-100
  };
  overallScore?: number;
}

export interface ArchitectureTradeStudy {
  tradeStudyId: string;
  title: string;
  systemArchId: string;
  alternatives: ArchitectureTradeAlternative[];
  selectedAlternativeId?: string;
  tradeRationale?: string;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  status: 'DRAFT' | 'COMPLETED' | 'AUTHORIZED';
}

export interface ArchitectureViewProjection {
  viewType: ArchitectureViewType;
  configurationId: string;
  elements: ArchitectureElementIdentity[];
  relationships: ArchitectureRelationshipContract[];
  interfaces: ArchitectureInterface[];
  dependencies: ArchitectureDependency[];
  decisions: ArchitectureDecision[];
}

export type ArchitectureFindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type ArchitectureFindingCategory = 
  | 'STRUCTURAL'
  | 'INTERFACE'
  | 'DEPENDENCY'
  | 'REQUIREMENT'
  | 'CONFIGURATION'
  | 'REVISION'
  | 'CANONICAL';

export interface ArchitectureFinding {
  findingId: string;
  severity: ArchitectureFindingSeverity;
  category: ArchitectureFindingCategory;
  sourceArchId: string;
  targetArchId?: string;
  ruleCode: string;
  explanation: string;
  revisionId: string;
  configurationId: string;
  provenanceId: string;
}

export interface ArchitectureConsistencyReport {
  timestamp: string;
  configurationId: string;
  revisionId: string;
  totalChecksPassed: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: ArchitectureFinding[];
  isConsistent: boolean;
}

export interface ArchitectureImpactReport {
  sourceArchId: string;
  directAffectedIds: string[];
  indirectAffectedIds: string[];
  affectedRequirements: string[];
  affectedDecisions: string[];
  affectedInterfaces: string[];
  affectedDependencies: string[];
  riskAssessment: string;
}

// --- Future Engineering & Architecture Design Space Contracts ---

export interface CandidateArchitecture {
  candidateId: string;
  name: string;
  architectureSpaceId: string;
  requirements: string[];
  parameters: Record<string, any>;
  assumptions: string[];
  dependencies: string[];
  simulationReferences: string[];
  verificationState: 'UNVERIFIED' | 'SIMULATED' | 'VERIFIED' | 'FAILED';
  evidenceState: 'ABSENT' | 'PROVISIONAL' | 'SEALED';
  confidence: number; // 0.0 - 1.0
  configurationId: string;
  provenanceId: string;
  isPromotedToCanonical: boolean;
  promotedRevisionId?: string;
  elements?: ArchitectureElementIdentity[];
}

export interface ArchitectureDesignSpace {
  designSpaceId: string;
  title: string;
  systemArchId: string;
  boundingRequirements: string[];
  boundingConstraints: string[];
  assumptions: string[];
  candidates: CandidateArchitecture[];
  configurationId: string;
  provenanceId: string;
}

export interface TechnologyAssumption {
  domain: string;
  description: string;
  multiplier: number;
  maturityHorizonYears: number;
}

export interface MaterialAssumption {
  materialClass: string;
  targetProperty: string;
  baselineValue: number;
  assumedValue: number;
  unit: string;
}

export interface EnergyAssumption {
  energyType: string;
  densityMultiplier: number;
  storageEfficiencyPct: number;
}

export interface ComputingAssumption {
  architecture: string;
  topsMultiplier: number;
  efficiencyTopsPerWatt: number;
}

export interface SensingAssumption {
  modality: string;
  resolutionMultiplier: number;
  bandwidthMultiplier: number;
}

export interface ManufacturingAssumption {
  method: string;
  toleranceMicrons: number;
  speedMultiplier: number;
}

export interface ControlAssumption {
  paradigm: string;
  latencyMs: number;
  autonomyLevel: string;
}

export interface UncertaintyBoundary {
  parameter: string;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number;
}

export interface FutureAssumptionSet {
  assumptionSetId: string;
  name: string;
  technologyAssumptions: TechnologyAssumption[];
  materialAssumptions: MaterialAssumption[];
  energyAssumptions: EnergyAssumption[];
  computingAssumptions: ComputingAssumption[];
  sensingAssumptions: SensingAssumption[];
  manufacturingAssumptions: ManufacturingAssumption[];
  controlAssumptions: ControlAssumption[];
  uncertaintyBoundaries: UncertaintyBoundary[];
}

export type FutureScenarioType = 
  | 'CONSERVATIVE' 
  | 'ADVANCED' 
  | 'BREAKTHROUGH' 
  | 'RADICAL_EXPLORATION';

export interface FutureScenario {
  scenarioId: string;
  title: string;
  scenarioType: FutureScenarioType;
  timeHorizonYears: number;
  technologyMaturity: string;
  assumptionSet: FutureAssumptionSet;
  candidateArchitectures: CandidateArchitecture[];
  simulationState: 'UNSIMULATED' | 'IN_PROGRESS' | 'COMPLETED';
  verificationState: 'UNVERIFIED' | 'SCENARIO_VERIFIED' | 'FALSIFIED';
  evidenceRef?: string;
  confidence: number;
  uncertaintyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'SPECULATIVE';
  isIsolatedFromCanonical: boolean; // MUST ALWAYS BE TRUE unless promoted via human governance!
  provenanceId: string;
  configurationId: string;
}

export interface EngineeringPossibilitySpace {
  spaceId: string;
  systemArchId: string;
  knownDesigns: CandidateArchitecture[];
  alternativeDesigns: CandidateArchitecture[];
  unexploredArchitectures: CandidateArchitecture[];
  boundaryArchitectures: CandidateArchitecture[];
  emergentArchitectures: CandidateArchitecture[];
  activeScenarios: FutureScenario[];
  configurationId: string;
  provenanceId: string;
}

export type ADSEP3Action = 
  | 'PROPOSE_ARCHITECTURE'
  | 'PROPOSE_ARCHITECTURE_DECISION'
  | 'AUTHORIZE_ARCHITECTURE_DECISION'
  | 'DECOMPOSE_SYSTEM'
  | 'CREATE_ARCHITECTURE_INTERFACE'
  | 'CREATE_ARCHITECTURE_DEPENDENCY'
  | 'ALLOCATE_COMPONENT'
  | 'BIND_ARCHITECTURE_CONSTRAINT'
  | 'BASELINE_ARCHITECTURE'
  | 'PUBLISH_ARCHITECTURE'
  | 'PROPOSE_DESIGN_SPACE_CANDIDATE'
  | 'PROPOSE_FUTURE_SCENARIO'
  | 'PROPOSE_SCENARIO_PROMOTION';

export interface ADSEP3GovernanceProposal {
  actor: string;
  action: ADSEP3Action;
  proposedData: any;
  configurationId: string;
}

export interface ADSEP3ForensicGateResult {
  gateId: string;
  status: 'PASS' | 'FAIL' | 'UNPROVEN';
  implementation: string;
  artifact: string;
  adversarialTest?: string;
  authoritySource: string;
  evidence?: any;
}

export interface ADSEP3ForensicAuditResult {
  timestamp: string;
  auditPassed: boolean;
  merkleRoot: string;
  gates: ADSEP3ForensicGateResult[];
  capabilities: Record<string, {
    DECLARED: boolean;
    IMPLEMENTED: boolean;
    EXECUTED: boolean;
    CORE_BOUND: boolean;
    CANONICAL_BOUND: boolean;
    VERIFIED: boolean;
    EVIDENCE_BACKED: boolean;
    PERSISTED: boolean;
    BENCHMARKED: boolean;
    PUBLISHED: boolean;
  }>;
  findings: string[];
}
