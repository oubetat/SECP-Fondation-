import { ADSEAuthorityState, ADSELifecycleState } from '../p0/types';

export enum FailureGovernanceState {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  ANALYZED = 'ANALYZED',
  EVIDENCE_REQUIRED = 'EVIDENCE_REQUIRED',
  VERIFIED = 'VERIFIED',
  INVALIDATED = 'INVALIDATED',
  SUPERSEDED = 'SUPERSEDED',
  REASSESSMENT_REQUIRED = 'REASSESSMENT_REQUIRED'
}

export interface Cause {
  causeId: string;
  type: string;
  sourceEntity: string; // Component, Environment, etc.
  physicalMechanism: string;
  assumptionRefs: string[];
  requirementRefs: string[];
  evidenceRefs: string[];
  confidence: number; // 0.0 to 1.0
}

export interface FailureMode {
  failureModeId: string;
  systemId: string;
  elementId: string; // ComponentId
  revisionId: string;
  configurationId: string;
  description: string;
  failureType: string;
  failureMechanism: string;
  localEffect: string;
  systemEffect: string;
  detectionMethod: string;
  mitigationStrategy: string;
  severity: number; // 1 to 10
  occurrence: number; // 1 to 10
  detectability: number; // 1 to 10
  criticality: number; // severity * occurrence
  status: FailureGovernanceState;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  evidenceRefs: string[];
  causes: Cause[];
  physicalFindingId?: string;
}

export interface FTAGate {
  gateId: string;
  type: 'AND' | 'OR';
  inputEventIds: string[];
  outputEventId: string;
}

export interface FTAEvent {
  eventId: string; // e.g. 'EV-FM-01' or 'EV-TOP'
  description: string;
  probability: number;
  isBasicEvent: boolean;
  failureModeId?: string;
}

export interface FaultTree {
  treeId: string;
  revisionId: string;
  configurationId: string;
  topEvent: FTAEvent;
  gates: FTAGate[];
  events: FTAEvent[];
  dependencies: string[];
  assumptions: string[];
  evidenceRefs: string[];
}

export interface ReliabilityBlock {
  blockId: string;
  name: string;
  type: 'SERIES' | 'PARALLEL' | 'REDUNDANT';
  failureRate: number; // Failures per hour
  redundancyK?: number; // k-out-of-n redundancy count
  childrenIds: string[];
}

export interface ReliabilityModel {
  modelId: string;
  revisionId: string;
  configurationId: string;
  MTBFHours: number;
  MTTRHours: number;
  availability: number;
  blocks: ReliabilityBlock[];
  assumptions: string[];
  evidenceRefs: string[];
  datasetRefs: string[];
}

export interface P11Snapshot {
  id: string;
  failureModes: FailureMode[];
  faultTrees: FaultTree[];
  reliabilityModels: ReliabilityModel[];
  merkleRootHash: string;
  persistedAt: string;
  persistedByAuthority: string;
}
