/**
 * SECP — ADSE-P6 Thermal Integration & Multi-Physics Engineering Truth Types & Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Governing Architectural Principle:
 * «Thermal Integration does not create an independent thermal truth. It establishes the
 * authoritative, verifiable and reconstructable thermal relationships between canonical geometry,
 * structure, materials, interfaces, thermal loads, boundary conditions, execution,
 * verification and evidence.»
 * 
 * Core Authority Rule:
 * «AI proposes → ADSE models → SECP Engineering Core authorizes → Thermal Execution computes
 * → Verification challenges → Evidence proves → Persistence reconstructs.»
 */

import { EngineeringAuthority, LifecycleState } from '../p0/types';
import { CoreBindingState } from '../p2/types';

export type ThermalDomainType = 
  | 'STEADY_STATE' 
  | 'TRANSIENT' 
  | 'CONDUCTION' 
  | 'CONVECTION' 
  | 'RADIATION' 
  | 'MULTI_PHYSICS_COUPLED';

export type ThermalExecutionStatus = 
  | 'PENDING' 
  | 'RUNNING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'STALE' 
  | 'INVALIDATED' 
  | 'VERIFIED';

export type BoundaryConditionType = 
  | 'PRESCRIBED_TEMPERATURE' 
  | 'HEAT_FLUX' 
  | 'CONVECTION' 
  | 'RADIATION' 
  | 'VOLUMETRIC_HEAT_GENERATION' 
  | 'THERMAL_CONTACT' 
  | 'HEAT_SINK_ENVIRONMENT';

export type HeatSourceType = 
  | 'REQUIREMENT_DERIVED' 
  | 'ARCHITECTURE_DERIVED' 
  | 'EXECUTION_DERIVED' 
  | 'EXTERNALLY_SUPPLIED' 
  | 'AI_PROPOSED';

export type ThermalPathEndpointType = 
  | 'HEAT_SOURCE' 
  | 'COMPONENT' 
  | 'INTERFACE' 
  | 'STRUCTURE' 
  | 'HEAT_SINK' 
  | 'ENVIRONMENT';

export type ThermalFindingSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ThermalFingerprintSet {
  inputFingerprint: string;
  boundaryFingerprint: string;
  materialFingerprint: string;
  geometryFingerprint: string;
  combinedFingerprint: string;
}

export interface ThermalModel {
  thermalId: string;
  canonicalId: string; // Binding to P3 Architecture Element or P5 Structural Element
  p5StructuralId?: string; // Authoritative Structural Integration Link
  p4NodeId: string; // Digital Thread Lineage Node Link
  displayName: string;
  domain: ThermalDomainType;
  configurationId: string;
  revisionId: string;
  revisionHash: string;
  provenanceId: string;
  authority: EngineeringAuthority;
  lifecycleState: LifecycleState;
  coreBindingState: CoreBindingState;
  isPublished: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ThermalRegion {
  regionId: string;
  thermalId: string;
  canonicalGeometryId: string; // Real Canonical Geometry Identity (e.g. from P5 / SECP Core)
  p5ElementId?: string;
  materialId: string; // Bound to canonical MaterialRegistry materialId
  materialRevision: number;
  configurationId: string;
  revisionId: string;
  volumeM3?: number;
  surfaceAreaM2?: number;
  initialTemperatureK: number;
  provenanceId: string;
  coreBindingState: CoreBindingState;
}

export interface ThermalMaterialBinding {
  bindingId: string;
  materialId: string;
  materialRevision: number;
  canonicalName: string;
  conductivityW_mK: number; // Thermal conductivity (k) in W/(m·K)
  densityKg_m3: number;     // Density (rho) in kg/m^3
  specificHeatJ_kgK: number; // Specific heat (c_p) in J/(kg·K)
  emissivity: number;       // Surface emissivity (epsilon) 0.0 - 1.0
  absorptivity?: number;    // Absorptivity (alpha) 0.0 - 1.0
  thermalExpansion1_K?: number;
  isTemperatureDependent?: boolean;
  temperatureCurve?: Array<{ temperatureK: number; conductivity: number }>;
  provenanceId: string;
  verifiedByAuthority: EngineeringAuthority;
}

export interface HeatSource {
  sourceId: string;
  thermalId: string;
  targetRegionId: string;
  sourceType: HeatSourceType;
  heatPowerWatts: number; // Watts (W)
  unit: 'W' | 'W/m^2' | 'W/m^3';
  configurationId: string;
  revisionId: string;
  derivedFromRequirementId?: string;
  derivedFromArchitectureId?: string;
  proposedByAI?: boolean;
  provenanceId: string;
}

export interface HeatSink {
  sinkId: string;
  thermalId: string;
  targetRegionId?: string;
  sinkType: 'ENVIRONMENT' | 'FLUID_LOOP' | 'RADIATOR_PANEL' | 'STRUCTURAL_CHASSIS';
  capacityWatts: number;
  ambientTemperatureK: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface ThermalBoundaryCondition {
  boundaryId: string;
  thermalId: string;
  type: BoundaryConditionType;
  targetId: string; // RegionId, InterfaceId or Geometry Surface Id
  value: number; // Temperature (K), Flux (W/m^2), Heat (W), or HTC (W/m^2·K)
  unit: string;  // 'K' | 'W/m^2' | 'W' | 'W/(m^2*K)'
  ambientTemperatureK?: number;
  emissivity?: number;
  configurationId: string;
  revisionId: string;
  authority: EngineeringAuthority;
  provenanceId: string;
  proposedByAI?: boolean;
}

export interface ThermalInterface {
  interfaceId: string;
  thermalId: string;
  p5InterfaceId: string; // Mandatory link to P5 Structural Interface
  sourceRegionId: string;
  targetRegionId: string;
  contactResistanceK_W: number; // R_th in K/W
  conductanceW_K: number;        // G = 1 / R_th in W/K
  contactAreaM2: number;
  isPerfectContact: boolean;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  coreBindingState: CoreBindingState;
}

export interface ThermalPathSegment {
  segmentId: string;
  fromType: ThermalPathEndpointType;
  fromId: string;
  toType: ThermalPathEndpointType;
  toId: string;
  conductanceW_K: number;
  resistanceK_W: number;
  mode: 'CONDUCTION' | 'CONVECTION' | 'RADIATION' | 'CONTACT';
}

export interface ThermalPath {
  pathId: string;
  thermalId: string;
  name: string;
  sourceEndpoint: { type: ThermalPathEndpointType; id: string };
  sinkEndpoint: { type: ThermalPathEndpointType; id: string };
  segments: ThermalPathSegment[];
  equivalentResistanceK_W: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface ThermalExecution {
  executionId: string;
  thermalId: string;
  modelRevision: string;
  configurationId: string;
  solverName: string;
  solverVersion: string;
  domain: ThermalDomainType;
  startTime: string;
  endTime?: string;
  status: ThermalExecutionStatus;
  fingerprints: ThermalFingerprintSet;
  provenanceId: string;
  invalidatedReason?: string;
}

export interface ThermalExecutionResult {
  resultId: string;
  executionId: string;
  thermalId: string;
  regionResults: Record<string, {
    temperatureK: number;
    heatFluxW_m2?: number;
    energyBalanceError?: number;
  }>;
  interfaceHeatFlowsWatts: Record<string, number>;
  totalHeatInputWatts: number;
  totalHeatDissipatedWatts: number;
  maxTemperatureK: number;
  minTemperatureK: number;
  energyBalanceDiscrepancyPercent: number;
  executionStatus: ThermalExecutionStatus;
  fingerprint: string;
  isVerified: boolean;
  verificationEvidenceId?: string;
}

export interface ThermalVerificationIntent {
  intentId: string;
  thermalId: string;
  executionId: string;
  maxAllowableTemperatureK: number;
  minAllowableTemperatureK?: number;
  maxAllowableThermalGradientK_m?: number;
  maxAllowableEnergyBalanceErrorPercent: number;
  verificationMethod: 'ANALYTICAL_CHECK' | 'ENERGY_CONSERVATION_AUDIT' | 'INDEPENDENT_BENCHMARK';
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'CHALLENGED';
  verifiedAt?: string;
  verifiedByAuthority?: EngineeringAuthority;
  evidenceId?: string;
}

export interface ThermalEvidence {
  evidenceId: string;
  thermalId: string;
  executionId: string;
  intentId: string;
  evidenceHash: string;
  summary: string;
  metrics: {
    maxTempK: number;
    marginK: number;
    energyConservationSatisfied: boolean;
  };
  provenanceId: string;
  recordedAt: string;
  authority: EngineeringAuthority;
}

export interface ThermalImpact {
  affectedModelIds: string[];
  invalidatedExecutionIds: string[];
  supersededEvidenceIds: string[];
  impactedDownstreamArtifacts: string[];
  reason: string;
  timestamp: string;
}

export interface ThermalConsistencyFinding {
  code: string;
  severity: ThermalFindingSeverity;
  dimension: string;
  message: string;
  targetId: string;
  remediation?: string;
}

export interface ThermalConsistencyReport {
  timestamp: string;
  isConsistent: boolean;
  totalFindings: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  merkleRoot: string;
  findings: ThermalConsistencyFinding[];
}

export interface ThermalSnapshot {
  snapshotId: string;
  timestamp: string;
  configurationId: string;
  models: ThermalModel[];
  regions: ThermalRegion[];
  materials: ThermalMaterialBinding[];
  heatSources: HeatSource[];
  heatSinks: HeatSink[];
  boundaries: ThermalBoundaryCondition[];
  interfaces: ThermalInterface[];
  paths: ThermalPath[];
  executions: ThermalExecution[];
  results: ThermalExecutionResult[];
  verifications: ThermalVerificationIntent[];
  evidences: ThermalEvidence[];
  merkleRoot: string;
}

export interface ADSEP6GovernanceProposal {
  proposalId: string;
  action: 'CREATE_MODEL' | 'MODIFY_MATERIAL' | 'SET_BOUNDARY' | 'RUN_EXECUTION' | 'PUBLISH_TRUTH';
  proposedBy: 'AI_AGENT' | 'ENGINEER' | 'SYSTEM';
  isAuthorized: boolean;
  authorizedBy?: EngineeringAuthority;
  payload: any;
}
