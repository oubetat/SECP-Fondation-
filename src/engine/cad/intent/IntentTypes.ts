
export type IntentStatus = 
  | 'DETECTED'
  | 'CANDIDATE'
  | 'VERIFIED'
  | 'APPLIED'
  | 'CONFLICTED'
  | 'REJECTED'
  | 'UNPROVEN'
  | 'INVALIDATED'
  | 'MAPPED'
  | 'AMBIGUOUS';

export type IntentType = 
  // Geometric
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'TANGENT'
  | 'CONCENTRIC'
  | 'COAXIAL'
  | 'COPLANAR'
  | 'COLLINEAR'
  | 'SYMMETRIC'
  | 'EQUAL_RADIUS'
  | 'EQUAL_LENGTH'
  | 'CONSTANT_THICKNESS'
  | 'CONSTANT_OFFSET'
  // Parametric
  | 'FEATURE_DEPENDENCY'
  | 'PATTERN_RELATIONSHIP'
  | 'MIRROR_RELATIONSHIP'
  | 'DIMENSION_DEPENDENCY'
  // Design
  | 'HOLE_ALIGNMENT'
  | 'REPEATED_FEATURE'
  | 'SYMMETRY_INTENT'
  | 'MANUFACTURING_INTENT'
  | 'ASSEMBLY_ALIGNMENT';

export type IntentPriority = 
  | 'HARD_CONSTRAINT'
  | 'DESIGN_INTENT'
  | 'REFERENCE_RELATION'
  | 'DETECTED_PATTERN'
  | 'HEURISTIC_CANDIDATE';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface IntentEvidence {
  type: string;
  measuredValue: number;
  expectedValue: number;
  tolerance: number;
  deviation: number;
  timestamp: string;
  kernelVersion: string;
}

export interface DesignIntent {
  id: string;
  type: IntentType;
  sourceGeometryIds: string[];
  targetGeometryIds: string[];
  evidence: IntentEvidence[];
  confidence: number;
  status: IntentStatus;
  priority: IntentPriority;
  isLocked: boolean;
  metadata?: Record<string, any>;
  dependencies: string[]; // Other intent IDs or Feature IDs
  createdBy: string;
  createdAt: string;
}

export interface IntentDiagnostic {
  code: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  intentId?: string;
}

export interface IntentEvidenceEvent {
  eventId: string;
  eventType: 'INTENT_DETECTED' | 'INTENT_VERIFIED' | 'INTENT_APPLIED' | 'INTENT_REJECTED' | 'INTENT_CONFLICT' | 'INTENT_INVALIDATED' | 'INTENT_RESTORED';
  intentId: string;
  intentType: IntentType;
  timestamp: string;
  hash: string;
}
