/**
 * SECP — ADSE-P9 Communications Integration & Information Engineering Truth Types
 */

import { ADSEAuthorityState, ADSELifecycleState } from '../p0/types';

export enum ADSE_P9_CAPABILITIES {
  COMMUNICATION_SYSTEM_AUTHORIZATION = 'P9_COMMUNICATION_SYSTEM_AUTHORIZATION',
  BANDWIDTH_BUDGETING = 'P9_BANDWIDTH_BUDGETING',
  LATENCY_BUDGETING = 'P9_LATENCY_BUDGETING',
  QUEUE_BUFFER_ANALYSIS = 'P9_QUEUE_BUFFER_ANALYSIS',
  RELIABILITY_AVAILABILITY_MODELING = 'P9_RELIABILITY_AVAILABILITY_MODELING',
  PATH_INTEGRITY_VERIFICATION = 'P9_PATH_INTEGRITY_VERIFICATION',
  P2_MBSE_BINDING = 'P9_P2_MBSE_BINDING',
  P3_ARCHITECTURE_BINDING = 'P9_P3_ARCHITECTURE_BINDING',
  P4_DIGITAL_THREAD_BINDING = 'P9_P4_DIGITAL_THREAD_BINDING',
  P5_PHYSICAL_COUPLING = 'P9_P5_PHYSICAL_COUPLING',
  P6_THERMAL_COUPLING = 'P9_P6_THERMAL_COUPLING',
  P7_POWER_COUPLING = 'P9_P7_POWER_COUPLING',
  P8_CONTROL_COUPLING = 'P9_P8_CONTROL_COUPLING',
  DURABLE_PERSISTENCE = 'P9_DURABLE_PERSISTENCE',
  FORENSIC_AUDITING = 'P9_FORENSIC_AUDITING'
}

export type CommunicationProtocol = 'ETHERNET_IP' | 'CAN_BUS' | 'ARINC_429' | 'MIL_STD_1553' | 'SPACEWIRE' | 'OPTICAL_LINK' | 'RS485' | 'PROFINET';
export type MediumType = 'COPPER_TWISTED_PAIR' | 'OPTICAL_FIBER' | 'WIRELESS_RF' | 'BACKPLANE_BUS';
export type FlowPriority = 'CRITICAL_REALTIME' | 'HIGH_PRIORITY' | 'BEST_EFFORT' | 'BACKGROUND';

export interface CommunicationSystem {
  id: string;
  type: 'CommunicationSystem';
  systemId: string;
  displayName: string;
  p3ArchitectureId: string;
  p4NodeId: string;
  p5StructuralContextId?: string;
  p6ThermalContextId?: string;
  p7PowerContextId?: string;
  p8ControlContextId?: string;
  configurationId: string;
  revisionId: string;
  authorityState: ADSEAuthorityState;
  lifecycleState: ADSELifecycleState;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  relationships: any[];
  dependencies: any[];
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'INVALIDATED';
  evidenceReferences: string[];
  isPublished: boolean;
}

export interface CommunicationNode {
  id: string;
  type: 'CommunicationNode';
  systemId: string;
  communicationSystemId: string;
  p3ComponentId: string;
  p4NodeId: string;
  p5StructuralId?: string;
  p6ThermalContextId?: string;
  p7PowerLoadId?: string;
  nodeName: string;
  processingDelayMs: number;
  bufferCapacityBytes: number;
  configurationId: string;
  revisionId: string;
  authorityState: ADSEAuthorityState;
  lifecycleState: ADSELifecycleState;
  provenance: any;
  relationships: any[];
  dependencies: any[];
  verificationStatus: string;
  evidenceReferences: string[];
}

export interface CommunicationEndpoint {
  id: string;
  type: 'CommunicationEndpoint';
  systemId: string;
  nodeId: string;
  endpointName: string;
  ipAddressOrId: string;
  supportedProtocols: CommunicationProtocol[];
  configurationId: string;
  revisionId: string;
  provenance: any;
}

export interface CommunicationInterface {
  id: string;
  type: 'CommunicationInterface';
  systemId: string;
  nodeId: string;
  p5PhysicalInterfaceId?: string;
  interfaceName: string;
  mediumType: MediumType;
  maxBandwidthBps: number;
  configurationId: string;
  revisionId: string;
  provenance: any;
}

export interface CommunicationLink {
  id: string;
  type: 'CommunicationLink';
  systemId: string;
  communicationSystemId: string;
  sourceInterfaceId: string;
  targetInterfaceId: string;
  lengthMeters: number;
  propagationSpeedMps: number;
  linkCapacityBps: number;
  bitErrorRate: number;
  reliability: number; // 0.0 to 1.0
  availability: number; // 0.0 to 1.0
  configurationId: string;
  revisionId: string;
  provenance: any;
}

export interface CommunicationChannel {
  id: string;
  type: 'CommunicationChannel';
  systemId: string;
  linkId: string;
  channelName: string;
  assignedBandwidthBps: number;
  protocol: CommunicationProtocol;
  configurationId: string;
  revisionId: string;
  provenance: any;
}

export interface CommunicationPath {
  id: string;
  type: 'CommunicationPath';
  systemId: string;
  sourceNodeId: string;
  destinationNodeId: string;
  linkIds: string[];
  totalPropagationDelayMs: number;
  pathReliability: number;
  pathAvailability: number;
  configurationId: string;
  revisionId: string;
  provenance: any;
}

export interface CommunicationDataFlow {
  id: string;
  type: 'CommunicationDataFlow';
  systemId: string;
  communicationSystemId: string;
  p2MbseFlowId?: string;
  p8ControlSignalId?: string;
  flowName: string;
  sourceNodeId: string;
  destinationNodeId: string;
  protocol: CommunicationProtocol;
  messageRateHz: number;
  messageSizeBytes: number;
  requiredBandwidthBps: number;
  maxLatencyMs: number;
  priority: FlowPriority;
  configurationId: string;
  revisionId: string;
  authorityState: ADSEAuthorityState;
  lifecycleState: ADSELifecycleState;
  provenance: any;
  relationships: any[];
  dependencies: any[];
  verificationStatus: string;
  evidenceReferences: string[];
}

export interface BandwidthBudget {
  totalCapacityBps: number;
  allocatedBps: number;
  remainingBps: number;
  marginPct: number;
  isOverflow: boolean;
}

export interface LatencyBudget {
  sourceDelayMs: number;
  queueDelayMs: number;
  transmissionDelayMs: number;
  processingDelayMs: number;
  propagationDelayMs: number;
  totalLatencyMs: number;
  maxAllowedLatencyMs: number;
  isViolation: boolean;
}

export interface QueueAnalysis {
  arrivalRateMsgsPerSec: number;
  serviceRateMsgsPerSec: number;
  bufferCapacityBytes: number;
  currentQueueLengthBytes: number;
  utilizationRatio: number;
  isOverloaded: boolean;
  isBufferOverflow: boolean;
}

export interface ReliabilityAvailabilityResult {
  pathReliability: number;
  pathAvailability: number;
  meetsRequirements: boolean;
}

export interface CommunicationExecution {
  id: string;
  type: 'CommunicationExecution';
  communicationSystemId: string;
  scenarioId: string;
  startTime: string;
  durationSeconds: number;
  status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'INVALIDATED';
  fingerprint: string;
  systemId: string;
  configurationId: string;
  revisionId: string;
  authorityState: ADSEAuthorityState;
  lifecycleState: ADSELifecycleState;
  provenance: any;
  relationships: any[];
  dependencies: any[];
  verificationStatus: string;
  evidenceReferences: string[];
}

export interface CommunicationExecutionResult {
  id: string;
  executionId: string;
  bandwidthBudget: BandwidthBudget;
  latencyBudget: LatencyBudget;
  queueAnalysis: QueueAnalysis;
  reliabilityAvailability: ReliabilityAvailabilityResult;
  findings: CommunicationFinding[];
  overallVerdict: 'PASS' | 'FAIL';
  calculatedAt: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' | 'INVALIDATED';
}

export interface CommunicationFinding {
  findingId: string;
  category: 'BANDWIDTH' | 'LATENCY' | 'QUEUE_OVERFLOW' | 'RELIABILITY' | 'PATH_DISCONNECTED' | 'INTERFACE_MISMATCH';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'FATAL';
  message: string;
  affectedEntityId: string;
}

export interface CommunicationVerificationIntent {
  id: string;
  communicationSystemId: string;
  gateName: string;
  verdict: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  evaluatedAt: string;
  evidenceHash: string;
  reasons: string[];
}

export interface CommunicationEvidence {
  id: string;
  executionId: string;
  evidenceType: string;
  merkleLeafHash: string;
  signedByAuthority: string;
  createdAt: string;
}

export interface CommunicationSnapshot {
  id: string;
  snapshotId?: string;
  communicationSystemId: string;
  createdAt: string;
  persistedByAuthority: string;
  merkleRootHash: string;
  systems: CommunicationSystem[];
  nodes: CommunicationNode[];
  endpoints: CommunicationEndpoint[];
  interfaces: CommunicationInterface[];
  links: CommunicationLink[];
  channels: CommunicationChannel[];
  paths: CommunicationPath[];
  dataFlows: CommunicationDataFlow[];
  executions: CommunicationExecution[];
  results: CommunicationExecutionResult[];
  verifications: CommunicationVerificationIntent[];
  evidences: CommunicationEvidence[];
}

export type ADSEP9GovernanceAction = 
  | 'PROPOSE_TOPOLOGY'
  | 'ANALYZE_TRAFFIC'
  | 'MUTATE_CANONICAL'
  | 'DELETE_CANONICAL'
  | 'AUTHORIZE_EXECUTION'
  | 'PUBLISH_SYSTEM'
  | 'DECLARE_VERIFIED'
  | 'PROMOTE_RELEASED'
  | 'BYPASS_REVISION'
  | 'BYPASS_CONFIGURATION'
  | 'PROMOTE_PROPOSAL';

export interface ADSEP9EngineeringAuthority {
  actor: string;
  role: 'HUMAN_SYSTEMS_ENGINEER' | 'CHIEF_COMMUNICATIONS_ARCHITECT' | 'SAFETY_AUTHORITY';
  signatureToken: string;
  delegationId?: string;
}

export interface ADSEP9GovernanceProposal {
  proposalId: string;
  action: ADSEP9GovernanceAction;
  actor: string;
  systemId: string;
  configurationId: string;
  revisionId: string;
  isAuthorized: boolean;
  authorizedBy?: ADSEP9EngineeringAuthority;
  status: 'PROPOSED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  proposedData: any;
  timestamp: string;
  rejectionReason?: string;
}

