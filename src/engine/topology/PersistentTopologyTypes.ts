/**
 * SECP-052 Persistent Topological Identity Types
 */

export type TopologicalEntityType = 'FACE' | 'EDGE' | 'VERTEX' | 'SHELL' | 'SOLID';

export type TopologyEvolutionStatus =
  | 'UNCHANGED'
  | 'REFERENCE_CHANGED'
  | 'REFERENCE_REPLACED'
  | 'REFERENCE_SPLIT'
  | 'REFERENCE_MERGED'
  | 'REFERENCE_DELETED'
  | 'REFERENCE_UNRESOLVED';

export interface GeometricSignature {
  centroid: { x: number; y: number; z: number };
  normalOrDirection?: { x: number; y: number; z: number };
  measure: number; // Area for face, length for edge
  shapeHash: string;
}

export interface PersistentTopologyIdentity {
  persistentId: string;         // e.g. "Part/Box_01/TopFace" or "Part/Pocket_01/WallFace[0]"
  featureId: string;            // Source feature ID
  entityType: TopologicalEntityType;
  localIndex: number;
  semanticTag: string;          // e.g. "TopFace", "BottomFace", "SideFace[0]", "FilletEdge[0]"
  geometricSignature: GeometricSignature;
  parentPersistentIds: string[];
  revision: number;
}

export interface TopologyReference {
  refId: string;
  persistentId: string;
  entityType: TopologicalEntityType;
  expectedSignature: GeometricSignature;
  currentStatus: TopologyEvolutionStatus;
  resolvedEntityId?: string;
  healingHistory?: string[];
}

export interface TopologyEvolutionRecord {
  oldPersistentId: string;
  newPersistentIds: string[];
  evolutionType: TopologyEvolutionStatus;
  reason: string;
  timestamp: string;
}

export interface TopologyFingerprint {
  shapeHash: string;
  faceCount: number;
  edgeCount: number;
  vertexCount: number;
  persistentIdentities: PersistentTopologyIdentity[];
  fingerprintHash: string;
}
