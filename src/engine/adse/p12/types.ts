export type HazardSeverity = 'CATASTROPHIC' | 'CRITICAL' | 'MAJOR' | 'MINOR';

export type HazardLikelihood = 'FREQUENT' | 'PROBABLE' | 'OCCASIONAL' | 'REMOTE' | 'IMPROBABLE';

export type RiskLevel = 'UNACCEPTABLE' | 'HIGH' | 'MEDIUM' | 'LOW';

export enum SafetyGovernanceState {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  ANALYZED = 'ANALYZED',
  VERIFIED = 'VERIFIED',
  REASSESSMENT_REQUIRED = 'REASSESSMENT_REQUIRED',
  INVALIDATED = 'INVALIDATED'
}

export interface Hazard {
  hazardId: string;
  initiatingConditions: string[];
  hazardousCondition: string;
  consequences: string[];
  severity: HazardSeverity;
  likelihood: HazardLikelihood;
  riskLevel: RiskLevel;
  failureModeRef?: string;
  status: SafetyGovernanceState;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
  revisionId: string;
  configurationId: string;
}

export interface SafetyControl {
  controlId: string;
  hazardId: string;
  controlType: 'PREVENTIVE' | 'MITIGATIVE' | 'INDEPENDENT_BARRIER';
  description: string;
  targetRequirementId: string;
  efficiency: number; // 0.0 - 1.0
  status: SafetyGovernanceState;
  revisionId: string;
  configurationId: string;
  evidenceRefs: string[];
}

export interface SafetyClaim {
  claimId: string;
  argumentId: string;
  claimText: string;
  targetHazardId: string;
  targetControlId: string;
  status: SafetyGovernanceState;
  revisionId: string;
  configurationId: string;
  evidenceRefs: string[];
}

export interface SafetyCaseNode {
  nodeId: string;
  nodeType: 'GOAL' | 'STRATEGY' | 'CLAIM' | 'EVIDENCE' | 'CONTEXT';
  description: string;
  childNodeIds: string[];
  claimId?: string;
}

export interface SafetyCase {
  caseId: string;
  title: string;
  systemId: string;
  revisionId: string;
  configurationId: string;
  topGoal: SafetyCaseNode;
  nodes: SafetyCaseNode[];
  claims: SafetyClaim[];
  assumptions: string[];
  evidenceRefs: string[];
  status: SafetyGovernanceState;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface P12Snapshot {
  timestamp: string;
  merkleRootHash: string;
  authority: string;
  hazards: Hazard[];
  controls: SafetyControl[];
  claims: SafetyClaim[];
  cases: SafetyCase[];
}
