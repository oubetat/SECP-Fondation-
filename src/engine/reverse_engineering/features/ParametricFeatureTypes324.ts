export enum FeatureType {
  EXTRUDE = 'EXTRUDE',
  REVOLVE = 'REVOLVE',
  HOLE = 'HOLE',
  FILLET = 'FILLET',
  CHAMFER = 'CHAMFER',
  PATTERN = 'PATTERN',
  SHELL = 'SHELL',
  LOFT = 'LOFT',
  SWEEP = 'SWEEP',
  DATUM_PLANE = 'DATUM_PLANE'
}

export enum ClassificationStatus {
  PROVEN = 'PROVEN',
  RECONSTRUCTED = 'RECONSTRUCTED',
  INFERRED = 'INFERRED',
  AMBIGUOUS = 'AMBIGUOUS',
  UNRESOLVED = 'UNRESOLVED'
}

export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export enum ParameterType {
  LENGTH = 'LENGTH',
  ANGLE = 'ANGLE',
  COUNT = 'COUNT',
  BOOLEAN = 'BOOLEAN',
  STRING = 'STRING'
}

export interface FeatureParameter {
  id: string;
  name: string;
  type: ParameterType;
  value: any;
  unit?: string;
  min?: number;
  max?: number;
  isDriven?: boolean;
}

export interface ParametricFeature {
  id: string;
  name: string;
  type: FeatureType;
  status: ClassificationStatus;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  parentId?: string;
  childrenIds?: string[];
  parameters: FeatureParameter[];
  references: string[];
  isSuppressed: boolean;
}

export interface ParametricFeatureTree {
  id: string;
  rootId: string;
  features: ParametricFeature[];
  version: number;
  metadata: {
    sourceMeshId?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface RebuildValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  brokenReferences: string[];
  geometryDeviation?: number;
  rebuildTimeMs: number;
  solidVolumeMm3?: number;
  isWatertight?: boolean;
  topologySummary?: {
    verticesCount: number;
    edgesCount: number;
    facesCount: number;
    faceIds?: string[];
  };
}
