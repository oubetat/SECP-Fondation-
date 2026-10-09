export type EvidenceNodeType = 'GEOMETRY_STATE' | 'PHYSICS_STATE' | 'MATERIAL_STATE' | 'MANUFACTURING_STATE' | 'INSPECTION_STATE' | 'TELEMETRY_STATE' | 'SIMULATION_RESULT' | 'PREDICTION' | 'MEASUREMENT' | 'VALIDATION_RESULT' | 'VERIFICATION_RESULT' | 'MODEL' | 'CLAIM' | 'REVISION';
export type EvidenceEdgeType = 'DERIVED_FROM' | 'GENERATED_BY' | 'MEASURED_BY' | 'SIMULATED_BY' | 'PREDICTED_BY' | 'VALIDATED_BY' | 'VERIFIED_BY' | 'INSPECTED_BY' | 'DEPENDS_ON' | 'SUPERSEDES' | 'CONTRADICTS' | 'CORROBORATES' | 'SUPPORTED_BY' | 'VERIFIES';
export type EvidenceNodeStatus = 'ACTIVE' | 'SUPERSEDED' | 'INVALIDATED' | 'RETRACTED' | 'CONTESTED' | 'QUARANTINED' | 'STALE' | 'ORPHAN';
export type EvidenceStrength = 'UNVERIFIED' | 'OBSERVED' | 'REPRODUCED' | 'VALIDATED' | 'INDEPENDENTLY_VERIFIED' | 'EXPERIMENTALLY_CORROBORATED';
export type ClaimStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'INVALID';

export interface TwinEvidenceNode {
  nodeId: string;
  nodeType: EvidenceNodeType;
  entityId: string;
  entityVersion: string;
  source: string;
  contentHash: string;
  createdAt: string;
  validFrom: string;
  validTo?: string;
  status: EvidenceNodeStatus;
  attributes: Record<string, any>;
}

export interface TwinEvidenceEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: EvidenceEdgeType;
  createdAt: string;
  contentHash: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'INVALID';
}

export interface TwinEvidenceGraph {
  graphId: string;
  twinId: string;
  nodes: Map<string, TwinEvidenceNode>;
  edges: Map<string, TwinEvidenceEdge>;
  graphVersion: number;
  rootHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngineeringClaim {
  claimId: string;
  claimType: string;
  subject: string;
  assertion: string;
  value: number;
  unit: string;
  createdAt: string;
  status: ClaimStatus;
}
