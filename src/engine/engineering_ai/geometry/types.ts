export type GeometryEntityType =
  | 'VERTEX'
  | 'EDGE'
  | 'WIRE'
  | 'FACE'
  | 'SHELL'
  | 'SOLID'
  | 'BODY'
  | 'COMPONENT'
  | 'ASSEMBLY'
  | 'FEATURE'
  | 'DATUM'
  | 'SKETCH';

export type GeometryRelationType =
  | 'INCIDENT_TO'
  | 'CONNECTED_TO'
  | 'BOUNDS'
  | 'CONTAINS'
  | 'ADJACENT_TO'
  | 'SHARES_EDGE'
  | 'SHARES_VERTEX'
  | 'BELONGS_TO'
  | 'DERIVED_FROM';

export type SpatialRelationType =
  | 'PARALLEL'
  | 'PERPENDICULAR'
  | 'COAXIAL'
  | 'CONCENTRIC'
  | 'TANGENT'
  | 'COPLANAR'
  | 'SYMMETRIC'
  | 'OFFSET'
  | 'INTERSECTS'
  | 'DISJOINT'
  | 'OVERLAPS';

export type FeatureType =
  | 'HOLE'
  | 'POCKET'
  | 'SLOT'
  | 'BOSS'
  | 'RIB'
  | 'FILLET'
  | 'CHAMFER'
  | 'THREAD'
  | 'PATTERN'
  | 'GROOVE'
  | 'SHELL'
  | 'DRAFT'
  | 'REVOLVE'
  | 'EXTRUDE';

export type GeometryReasoningVerdict =
  | 'VERIFIED'
  | 'REFUTED'
  | 'UNRESOLVED'
  | 'INVALID'
  | 'OUT_OF_CONTEXT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'KERNEL_REJECTED';

export type HallucinationVerdict =
  | 'GROUNDED'
  | 'PARTIALLY_GROUNDED'
  | 'UNGROUNDED'
  | 'CONTRADICTED_BY_KERNEL'
  | 'INVALID';

export type AnomalyVerdict =
  | 'VALID'
  | 'SUSPECTED'
  | 'INVALID'
  | 'KERNEL_REJECTED'
  | 'INSUFFICIENT_EVIDENCE';

export type ChangeType =
  | 'GEOMETRIC'
  | 'TOPOLOGICAL'
  | 'PARAMETRIC'
  | 'COSMETIC'
  | 'MANUFACTURING_RELEVANT'
  | 'STRUCTURAL_RELEVANT'
  | 'ADDED_FEATURE'
  | 'REMOVED_FEATURE'
  | 'UNKNOWN';

export interface GeometryToleranceProfile {
  linearTolerance: number; // e.g., 0.001 mm
  angularTolerance: number; // e.g., 0.01 degrees
  topologyTolerance: number; // e.g., 1e-6
  intersectionTolerance: number; // e.g., 1e-5
  classificationTolerance: number;
}

export interface GeometryContext {
  modelId: string;
  geometryRevision: string;
  kernelVersion: string;
  topologyVersion: string;
  coordinateSystem: string;
  units: 'mm' | 'm' | 'inch' | string;
  toleranceProfile: GeometryToleranceProfile;
  geometryHash: string;
}

export interface GeometryEntityDescriptor {
  entityId: string;
  entityType: GeometryEntityType;
  geometryType: string; // e.g. CYLINDER, PLANE, B-SPLINE, LINE, CIRCLE
  dimension: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  coordinateFrame?: {
    origin: [number, number, number];
    axisZ: [number, number, number];
  };
  parameters: Record<string, any>; // e.g. { diameter: 12, depth: 30, radius: 2.5 }
  tolerance?: number;
  kernelReference: string;
  hash: string;
}

export interface GeometryRelation {
  relationId: string;
  type: GeometryRelationType | SpatialRelationType;
  sourceEntityId: string;
  targetEntityId: string;
  metricValue?: number; // e.g. angle in degrees, distance in mm
  unit?: string;
  toleranceUsed?: number;
  kernelVerified: boolean;
}

export interface GeometryFeatureHypothesis {
  hypothesisId: string;
  featureType: FeatureType;
  entityIds: string[];
  proposedParameters: Record<string, any>;
  recognitionConfidence: number;
  reasoningNotes: string;
}

export interface GeometryFeatureEvidence {
  featureId: string;
  featureType: FeatureType;
  entityIds: string[];
  sourceGeometryHash: string;
  modelVersion: string;
  recognitionMethod: string;
  confidence: number;
  kernelVerification: 'PASS' | 'CONTRADICTED_BY_KERNEL' | 'FAILED';
  evidenceHash: string;
}

export interface GeometryQueryPlan {
  queryId: string;
  rawQuery: string;
  targetEntity?: string;
  featureType?: FeatureType;
  filter?: {
    field: string;
    operator: '>' | '<' | '==' | '>=' | '<=' | '!=';
    value: number;
    unit: string;
  };
  relationTarget?: SpatialRelationType;
  isValid: boolean;
  validationError?: string;
}

export interface GeometryChangeRecord {
  entityId: string;
  changeType: ChangeType;
  oldValue?: any;
  newValue?: any;
  details: string;
}

export interface GeometryChangeEvidence {
  changeEvidenceId: string;
  oldGeometryHash: string;
  newGeometryHash: string;
  changedEntities: GeometryChangeRecord[];
  changeType: ChangeType;
  kernelComparison: 'MATCH' | 'MODIFIED' | 'MISMATCH';
  evidenceHash: string;
}

export interface GeometryDependencyNode {
  nodeId: string;
  nodeType: 'GEOMETRY' | 'FEATURE' | 'SIMULATION' | 'CAM' | 'INSPECTION' | 'ASSEMBLY';
  refId: string;
  dependsOn: string[];
}

export interface GeometryReasoningEvidence {
  evidenceId: string;
  claim: string;
  geometryContext: GeometryContext;
  entityReferences: string[];
  reasoningModel: string;
  modelVersion: string;
  kernelQuery: string;
  kernelResult: string;
  confidence: number;
  verdict: GeometryReasoningVerdict;
  timestamp: string;
  evidenceHash: string;
}

export interface GeometrySimilarityRecord {
  modelAHash: string;
  modelBHash: string;
  shapeSimilarityScore: number; // 0..1
  featureSimilarityScore: number; // 0..1
  topologySimilarityScore: number; // 0..1
  overallSimilarity: number;
  verdict: 'IDENTICAL' | 'SIMILAR' | 'DISSIMILAR';
  kernelVerified: boolean;
}

export interface GeometryAnomalyRecord {
  anomalyId: string;
  entityId: string;
  anomalyType: 'SELF_INTERSECTION' | 'TINY_FACE' | 'SLIVER_FACE' | 'OPEN_SHELL' | 'NON_MANIFOLD' | 'GAP';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  verdict: AnomalyVerdict;
  details: string;
}
