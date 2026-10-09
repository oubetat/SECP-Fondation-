/**
 * PATCH-SECP-048-A — Design Intent Contracts
 * Defines the semantic and engineering intent layer.
 */

export enum SemanticTopologyType {
  MOUNTING_FACE = 'MOUNTING_FACE',
  PRIMARY_DATUM = 'PRIMARY_DATUM',
  SECONDARY_DATUM = 'SECONDARY_DATUM',
  CENTER_AXIS = 'CENTER_AXIS',
  HOLE_AXIS = 'HOLE_AXIS',
  SYMMETRY_PLANE = 'SYMMETRY_PLANE',
  COAXIAL_AXIS = 'COAXIAL_AXIS',
  SEALING_FACE = 'SEALING_FACE',
  CLEARANCE_REGION = 'CLEARANCE_REGION',
  REFERENCE_FACE = 'REFERENCE_FACE'
}

export enum IntentType {
  CONCENTRICITY = 'CONCENTRICITY',
  COINCIDENCE = 'COINCIDENCE',
  SYMMETRY = 'SYMMETRY',
  COAXIALITY = 'COAXIALITY',
  MINIMUM_WALL_THICKNESS = 'MINIMUM_WALL_THICKNESS',
  MAXIMUM_DIMENSION = 'MAXIMUM_DIMENSION',
  CLEARANCE_CHECK = 'CLEARANCE_CHECK',
  PARALLELISM = 'PARALLELISM',
  PERPENDICULARITY = 'PERPENDICULARITY'
}

export enum IntentStatus {
  ACTIVE = 'ACTIVE',
  VIOLATED = 'VIOLATED',
  RESOLVE_ERROR = 'RESOLVE_ERROR',
  SUPPRESSED = 'SUPPRESSED'
}

export interface SemanticReference {
  semanticId: string;
  type: SemanticTopologyType;
  featureId: string;          // Source feature that produces the geometry
  topologySignature: string;  // Stable signature from SECP-047
  indexHint?: number;         // For optimization
}

export interface DesignIntent {
  id: string;
  type: IntentType;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  
  // Relations
  sourceFeatureIds: string[];
  semanticReferences: SemanticReference[];
  
  parameters: Record<string, any>;
  
  status: IntentStatus;
  revision: number;
  provenance: string; // Hash of intent definition
}

export interface DesignIntentResult {
  intentId: string;
  status: IntentStatus;
  message?: string;
  deviation?: number;
}

export interface ComprehensiveValidationResult {
  patch?: string;
  timestamp?: string;
  geometricSuccess: boolean;
  topologyResolved?: boolean;
  intentSuccess: boolean;
  intentDetails: DesignIntentResult[];
  overallStatus: 'PASS' | 'FAIL' | 'PARTIAL_VIOLATION';
  provenanceHash?: string;
}
