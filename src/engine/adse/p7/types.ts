/**
 * SECP — ADSE-P7 Power Integration & Power Engineering Truth Types & Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Governing Architectural Principle:
 * «Power Integration does not create an independent power truth. It establishes the
 * authoritative, verifiable and reconstructable relationships between canonical system
 * architecture, components, electrical interfaces, sources, loads, distribution paths,
 * storage, conversion, protection, operating states, thermal consequences, execution,
 * verification and evidence.»
 * 
 * Core Authority Rule:
 * «AI proposes → ADSE models → SECP Engineering Core authorizes → Physics/Power Flow computes
 * → Verification challenges → Evidence proves → Persistence reconstructs.»
 */

import { EngineeringAuthority, LifecycleState } from '../p0/types';
import { CoreBindingState } from '../p2/types';

export type PowerDomainType = 
  | 'DC_LOW_VOLTAGE'      // e.g. 28V DC
  | 'DC_HIGH_VOLTAGE'     // e.g. 270V DC / 600V DC
  | 'AC_115V_400HZ'       // Standard aerospace 115V AC 400Hz
  | 'AC_230V_50HZ'        // Ground support / utility
  | 'HYBRID_DISTRIBUTED';

export type PowerSourceType = 
  | 'MAIN_GENERATOR' 
  | 'AUXILIARY_POWER_UNIT' 
  | 'BATTERY_STORAGE' 
  | 'SOLAR_PHOTOVOLTAIC' 
  | 'FUEL_CELL' 
  | 'GROUND_POWER_CART' 
  | 'REGULATED_SUPPLY';

export type PowerLoadCriticality = 
  | 'FLIGHT_CRITICAL_ESSENTIAL' // Category A (Loss is catastrophic)
  | 'PRIMARY_MISSION'           // Category B (Required for primary payload/mission)
  | 'SECONDARY_UTILITY'         // Category C (Non-essential, shed-able in degraded mode)
  | 'EMERGENCY_BACKUP';

export type PowerOperatingMode = 
  | 'GROUND_STANDBY' 
  | 'PRE_LAUNCH_CHECKOUT' 
  | 'ASCENT_MAX_PROPULSION' 
  | 'CRUISE_NOMINAL' 
  | 'MISSION_PAYLOAD_ACTIVE' 
  | 'EMERGENCY_DEGRADED' 
  | 'SAFE_HOLD';

export type PowerExecutionStatus = 
  | 'PENDING' 
  | 'RUNNING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'STALE' 
  | 'INVALIDATED' 
  | 'VERIFIED';

export type ConverterTopology = 'DC_DC_BUCK' | 'DC_DC_BOOST' | 'DC_DC_ISOLATED' | 'AC_DC_RECTIFIER' | 'DC_AC_INVERTER';

export interface PowerFingerprintSet {
  inputFingerprint: string;
  sourceFingerprint: string;
  loadFingerprint: string;
  topologyFingerprint: string;
  combinedFingerprint: string;
}

export interface PowerSystem {
  systemId: string;
  canonicalId: string; // Binding to P3 Architecture Element or P5 Structural Assembly
  p5StructuralId?: string;
  p4NodeId: string;    // Digital Thread Lineage Node
  displayName: string;
  nominalVoltageV: number;
  domainType: PowerDomainType;
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

export interface PowerDomain {
  domainId: string;
  systemId: string;
  name: string;
  domainType: PowerDomainType;
  nominalVoltageV: number;
  voltageRangeMinV: number;
  voltageRangeMaxV: number;
  frequencyHz?: number; // 0 for DC, 400 or 50/60 for AC
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerSource {
  sourceId: string;
  systemId: string;
  domainId: string;
  canonicalComponentId: string; // Binding to P3 Component / P5 Part
  sourceType: PowerSourceType;
  nominalVoltageV: number;
  voltageRegulationPercent: number; // e.g. ±1%
  ratedContinuousPowerWatts: number;
  peakPowerWatts: number;
  internalResistanceOhms: number;
  efficiencyPercent: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  derivedFromRequirementId?: string;
  derivedFromArchitectureId?: string;
}

export interface PowerLoad {
  loadId: string;
  systemId: string;
  domainId: string;
  canonicalComponentId: string; // Binding to P3 Component (e.g., Radar, Avionics Box)
  connectedBusId: string;
  criticality: PowerLoadCriticality;
  nominalVoltageV: number;
  voltageToleranceMinV: number;
  voltageToleranceMaxV: number;
  nominalDemandWatts: number;
  peakDemandWatts: number;
  inrushDemandWatts?: number;
  inrushDurationMs?: number;
  dutyCycle: number; // 0.0 to 1.0
  thermalLossFraction: number; // Fraction of electrical power dissipated as heat (typically 0.85 - 1.0)
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  proposedByAI?: boolean;
}

export interface PowerBus {
  busId: string;
  systemId: string;
  domainId: string;
  name: string;
  nominalVoltageV: number;
  maxCurrentCapacityAmps: number;
  connectedSourceIds: string[];
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerBranch {
  branchId: string;
  systemId: string;
  fromBusId: string;
  toTargetId: string; // Can be LoadId, ConverterId, or Sub-BusId
  lineResistanceOhms: number;
  maxCurrentAmps: number;
  protectionRatingAmps: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerConverter {
  converterId: string;
  systemId: string;
  canonicalComponentId: string;
  inputBusId: string;
  outputBusId: string;
  topology: ConverterTopology;
  inputVoltageNominalV: number;
  outputVoltageNominalV: number;
  ratedPowerWatts: number;
  efficiencyPercent: number; // e.g. 92.0%
  fixedNoLoadLossWatts: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerStorage {
  storageId: string;
  systemId: string;
  canonicalComponentId: string;
  connectedBusId: string;
  chemistry: 'LI_ION_NMC' | 'LI_FE_PO4' | 'LI_S' | 'SOLID_STATE' | 'SUPERCAPACITOR';
  nameplateCapacityWh: number;
  nominalVoltageV: number;
  maxDischargeRateC: number;
  maxChargeRateC: number;
  roundTripEfficiencyPercent: number;
  stateOfChargePercent: number; // 0.0 - 100.0%
  usableSocMinPercent: number;   // e.g. 20.0%
  usableSocMaxPercent: number;   // e.g. 95.0%
  internalResistanceOhms: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerProtection {
  protectionId: string;
  systemId: string;
  branchId: string;
  deviceType: 'SOLID_STATE_POWER_CONTROLLER' | 'THERMAL_BREAKER' | 'FAST_FUSE' | 'CURRENT_LIMITER';
  tripCurrentAmps: number;
  tripTimeMs: number;
  isTripped: boolean;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerOperatingState {
  stateId: string;
  systemId: string;
  mode: PowerOperatingMode;
  name: string;
  activeSourceIds: string[];
  activeLoadIds: string[];
  activeConverterIds: string[];
  loadScalingFactors: Record<string, number>; // loadId -> factor (e.g. 1.0 for full, 0.5 for idle)
  storageDischargeEnabled: boolean;
  ambientTemperatureK: number;
  durationSeconds?: number;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface PowerBudgetSummary {
  stateId: string;
  mode: PowerOperatingMode;
  totalGenerationCapacityWatts: number;
  totalActiveDemandWatts: number;
  totalDistributionLossesWatts: number;
  totalConverterLossesWatts: number;
  netReserveMarginWatts: number;
  reserveMarginPercent: number;
  isPositiveMargin: boolean;
  batteryDischargePowerWatts: number;
  batteryDepletionRatePercentPerHour: number;
}

export interface PowerExecution {
  executionId: string;
  systemId: string;
  modelRevision: string;
  configurationId: string;
  operatingStateId: string;
  solverName: string;
  solverVersion: string;
  startTime: string;
  endTime?: string;
  status: PowerExecutionStatus;
  fingerprints: PowerFingerprintSet;
  provenanceId: string;
  invalidatedReason?: string;
}

export interface PowerExecutionResult {
  resultId: string;
  executionId: string;
  systemId: string;
  operatingStateId: string;
  busVoltagesV: Record<string, number>;
  branchCurrentsA: Record<string, number>;
  branchLossesWatts: Record<string, number>;
  converterLossesWatts: Record<string, number>;
  loadPowerWatts: Record<string, number>;
  sourcePowerSuppliedWatts: Record<string, number>;
  storagePowerWatts: Record<string, number>;
  totalGenerationWatts: number;
  totalLoadWatts: number;
  totalLossesWatts: number;
  netPowerMarginWatts: number;
  powerBalanceDiscrepancyPercent: number; // Must be < 0.001% (Exact Kirchhoff / Energy conservation)
  executionStatus: PowerExecutionStatus;
  fingerprint: string;
  isVerified: boolean;
  verificationEvidenceId?: string;
  thermalLossSummaryWatts: {
    converterThermalLossWatts: number;
    distributionThermalLossWatts: number;
    loadThermalLossWatts: number;
    totalElectricalHeatDissipatedWatts: number;
  };
}

export interface PowerVerificationIntent {
  intentId: string;
  systemId: string;
  executionId: string;
  operatingStateId: string;
  minAllowableVoltageV: number;
  maxAllowableVoltageV: number;
  minRequiredMarginWatts: number;
  minRequiredMarginPercent: number;
  maxAllowablePowerBalanceErrorPercent: number;
  verificationMethod: 'KIRCHHOFF_LOAD_FLOW_AUDIT' | 'CONVERTER_EFFICIENCY_AUDIT' | 'STORAGE_DISCHARGE_INTEGRITY';
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'CHALLENGED';
  verifiedAt?: string;
  verifiedByAuthority?: EngineeringAuthority;
  evidenceId?: string;
}

export interface PowerEvidence {
  evidenceId: string;
  systemId: string;
  executionId: string;
  intentId: string;
  evidenceHash: string;
  summary: string;
  metrics: {
    totalGenerationWatts: number;
    totalDemandWatts: number;
    marginWatts: number;
    marginPercent: number;
    voltageComplianceVerified: boolean;
    balanceConservationVerified: boolean;
  };
  provenanceId: string;
  recordedAt: string;
  authority: EngineeringAuthority;
}

export interface PowerImpact {
  affectedSystemIds: string[];
  invalidatedExecutionIds: string[];
  supersededEvidenceIds: string[];
  impactedThermalModelIds: string[];
  impactedDownstreamArtifacts: string[];
  reason: string;
  timestamp: string;
}

export interface PowerConsistencyFinding {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  dimension: string;
  message: string;
  targetId: string;
  remediation?: string;
}

export interface PowerConsistencyReport {
  timestamp: string;
  isConsistent: boolean;
  totalFindings: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  merkleRoot: string;
  findings: PowerConsistencyFinding[];
}

export interface PowerSnapshot {
  snapshotId: string;
  timestamp: string;
  configurationId: string;
  systems: PowerSystem[];
  domains: PowerDomain[];
  sources: PowerSource[];
  loads: PowerLoad[];
  buses: PowerBus[];
  branches: PowerBranch[];
  converters: PowerConverter[];
  storages: PowerStorage[];
  protections: PowerProtection[];
  operatingStates: PowerOperatingState[];
  executions: PowerExecution[];
  results: PowerExecutionResult[];
  verifications: PowerVerificationIntent[];
  evidences: PowerEvidence[];
  merkleRoot: string;
}

export interface ADSEP7GovernanceProposal {
  proposalId: string;
  action: 'CREATE_SYSTEM' | 'MODIFY_LOAD' | 'UPDATE_TOPOLOGY' | 'SET_CONVERTER' | 'RUN_EXECUTION' | 'PUBLISH_TRUTH';
  proposedBy: 'AI_AGENT' | 'ENGINEER' | 'SYSTEM';
  isAuthorized: boolean;
  authorizedBy?: EngineeringAuthority;
  payload: any;
}
