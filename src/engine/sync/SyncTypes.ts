/**
 * SECP Industrial OS v3 — PROMPT-054: State Synchronization Types
 * Defines the formal contracts for Backend-to-UI State Synchronization,
 * Canonical Projections, Revision Tracking, and Divergence Detection.
 */

import { MeshGeometryData } from '../cadKernel';

export interface DocumentRevisionEvent {
  documentId: string;
  fromRevision: number;
  toRevision: number;
  mutationId: string;
  actionId: string;
  timestamp: string;
  changedEntities: string[]; // e.g. ['features', 'parameters', 'topology']
  invalidatedEntities: string[];
  mutationType: string;
}

export interface FeatureTreeProjectionItem {
  id: string;
  featureId: string;
  documentId: string;
  documentRevision: number;
  name: string;
  type: string;
  suppressed: boolean;
  active: boolean;
  parent?: string;
  children: string[];
  dependencies: string[];
  regenerationState: 'PENDING' | 'VALID' | 'DIRTY' | 'FAILED';
  validationStatus: 'VALID' | 'INVALID' | 'UNPROVEN';
  evidenceHash: string;
}

export interface PropertyItem {
  id: string;
  name: string;
  value: any;
  unit?: string;
  expression?: string;
  isDriving?: boolean;
  documentRevision: number;
  sourceFeatureId?: string;
}

export interface PropertiesProjection {
  documentId: string;
  documentRevision: number;
  selectedFeatureId?: string;
  items: PropertyItem[];
}

export interface ViewportGeometryProjection {
  documentId: string;
  documentRevision: number;
  mesh?: MeshGeometryData;
  bRepHash?: string;
  isStale: boolean;
  topologyCount: {
    solids: number;
    faces: number;
    edges: number;
    vertices: number;
  };
}

export interface SelectionReference {
  topologyId: string;
  persistentTag?: string;
  entityType: 'FACE' | 'EDGE' | 'VERTEX' | 'SOLID' | 'FEATURE';
  featureId?: string;
  documentRevision: number;
}

export interface SelectionProjection {
  documentId: string;
  documentRevision: number;
  selectedEntity?: SelectionReference;
  selectionStatus: 'VALID' | 'REMAPPED' | 'INVALIDATED' | 'EMPTY';
  remappedTopologyId?: string;
  reason?: string;
}

export interface EvidenceProjection {
  documentId: string;
  documentRevision: number;
  records: {
    evidenceId: string;
    stage: string;
    verdict: string;
    evidenceRevision: number;
    isStale: boolean;
    canonicalHash: string;
  }[];
  hasStaleEvidence: boolean;
}

export interface DerivedStatusProjection {
  documentId: string;
  documentRevision: number;
  status: 'MUTATED' | 'VALIDATED' | 'VERIFIED' | 'STALE' | 'FAILED' | 'INVALID' | 'REGENERATING';
  explanation: string;
  actionId?: string;
  evidenceId?: string;
}

export interface CanonicalStateProjectionSnapshot {
  documentId: string;
  revision: number;
  timestamp: string;
  featureTree: FeatureTreeProjectionItem[];
  properties: PropertiesProjection;
  viewport: ViewportGeometryProjection;
  selection: SelectionProjection;
  evidence: EvidenceProjection;
  status: DerivedStatusProjection;
  isStale: boolean;
  lastMutationSource: 'INITIAL' | 'MUTATION' | 'UNDO' | 'REDO' | 'RECONNECT' | 'PERSISTENCE_RELOAD';
}

export interface SyncTelemetryRecord {
  documentId: string;
  fromRevision: number;
  toRevision: number;
  mutationId: string;
  syncResult: 'SUCCESS' | 'REJECTED_OUT_OF_ORDER' | 'REJECTED_STALE' | 'FAILED';
  durationMs: number;
  timestamp: string;
}
