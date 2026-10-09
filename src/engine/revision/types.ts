export enum RevisionEntityType {
  PART = "PART",
  ASSEMBLY = "ASSEMBLY",
  DRAWING = "DRAWING",
  CAD_MODEL = "CAD_MODEL",
  FEM_STUDY = "FEM_STUDY",
  CFD_STUDY = "CFD_STUDY",
  CAM_JOB = "CAM_JOB",
  MATERIAL = "MATERIAL",
  ENGINEERING_DOCUMENT = "ENGINEERING_DOCUMENT",
  EVIDENCE = "EVIDENCE",
  SKETCH = "SKETCH"
}

export enum RevisionLifecycleState {
  DRAFT = "DRAFT",
  IN_WORK = "IN_WORK",
  UNDER_REVIEW = "UNDER_REVIEW",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  RELEASED = "RELEASED",
  SUPERSEDED = "SUPERSEDED",
  OBSOLETE = "OBSOLETE",
  CANCELLED = "CANCELLED"
}

export enum EffectivityType {
  DATE = "DATE",
  SERIAL = "SERIAL",
  LOT = "LOT",
  CONFIGURATION = "CONFIGURATION",
  PROJECT = "PROJECT",
  CONTRACT = "CONTRACT"
}

export interface Effectivity {
  type: EffectivityType;
  start?: string;
  end?: string;
  condition?: string;
  configurationId?: string;
}

export interface DependencySnapshot {
  entityId: string;
  revisionId: string;
  type?: string; // e.g. "DERIVES_FROM", "SIMULATES", etc. (optional for legacy support)
  isFloating?: boolean; // Flag to detect latest/floating references
}

export interface RevisionApproval {
  approvalId: string;
  revisionId: string;
  role: string;
  actorId: string;
  decision: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  timestamp: string;
  reason: string;
  evidenceId?: string;
}

export interface RevisionComment {
  commentId: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface RevisionChangeSet {
  changeSetId: string;
  revisionId: string;
  changes: any[];
  reason: string;
  actorId: string;
  timestamp: string;
}

export interface EngineeringSnapshot {
  geometryState?: {
    parameters: Record<string, any>;
    features: string[];
    topologyHash: string;
    geometryHash: string;
  };
  assemblyRelationships?: { componentId: string; revisionId: string; position: number[] }[];
  drawingReferences?: { viewId: string; sheetSize: string; scale: string; gdtApplied: boolean }[];
  simulationReferences?: { meshSizeMm: number; boundaryConditions: string[]; solver: string; materials: string[] }[];
  camReferences?: { toolpathId: string; cycleTimeSec: number; toolCount: number }[];
  materials?: { densityKgM3: number; youngsModulusGpa: number; poissonsRatio: number; yieldStrengthMpa: number; thermalConductivity: number };
  metadata?: Record<string, any>;
}

export interface Revision {
  revisionId: string;
  entityId: string;
  entityType: RevisionEntityType;
  revisionCode: string; // Revision label (A, B, 01, custom)
  revisionNumber: number; // For sequencing
  parentRevisionId?: string; // Parent lineage linkage
  lifecycleState: RevisionLifecycleState;
  
  createdAt: string;
  createdBy: string;
  releasedAt?: string;
  releasedBy?: string;
  
  supersedesRevisionId?: string;
  supersededByRevisionId?: string;
  
  effectivity: Effectivity[];
  configurationScope: string[];
  
  contentHash: string;
  dependencyHash: string;
  revisionHash: string;

  dependencies: DependencySnapshot[];
  approvals: RevisionApproval[];
  changeSet?: RevisionChangeSet;
  comments?: RevisionComment[]; // optional for legacy
  
  // Custom metadata for PATCH-287
  changeReason?: string; // optional for legacy
  changeDescription?: string; // optional for legacy
  changeSummary?: Record<string, any>; // optional for legacy
  validationState?: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED' | 'ABSENT'; // optional for legacy
  evidenceReferences?: string[]; // optional for legacy
  
  // Immutability block
  isLocked?: boolean;
  lockedBy?: string;
  lockTimestamp?: string;
  
  // Opaque payload or snapshot for the actual content this revision wraps
  content: any;
  snapshot?: EngineeringSnapshot; // optional for legacy
}

export interface RevisionTransition {
  transitionId: string;
  revisionId: string;
  fromState: RevisionLifecycleState;
  toState: RevisionLifecycleState;
  actorId: string;
  timestamp: string;
  reason: string;
  changeSetId?: string;
  evidenceId?: string;
}

export interface RevisionAuditRecord {
  revisionId: string;
  action: string;
  actorId: string;
  timestamp: string;
  beforeState: RevisionLifecycleState | null;
  afterState: RevisionLifecycleState;
  beforeHash: string | null;
  afterHash: string;
  reason: string;
  details: string;
}

export interface RevisionDiff {
  identityMatch: boolean;
  contentMatch: boolean;
  dependencyMatch: boolean;
  differences: string[]; // e.g. "GEOMETRY_CHANGED", "PARAMETER_CHANGED"
  semanticDetails: string[];
}

export interface EngineeringBaseline {
  baselineId: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  isReleased: boolean;
  revisions: Record<string, string>; // entityId -> revisionId
  baselineHash: string;
}
