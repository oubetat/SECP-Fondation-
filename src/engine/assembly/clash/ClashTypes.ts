import { Vector3D } from '../../cadKernel';

export type ClashVerdict =
  | 'NO_CLASH'
  | 'CLASH'
  | 'CLEARANCE_VIOLATION'
  | 'INCONCLUSIVE'
  | 'INVALID';

export type ClashSeverity =
  | 'NONE'
  | 'WARNING'
  | 'CRITICAL';

export type ClashAnalysisMode =
  | 'STATIC_ANALYSIS'
  | 'DISCRETE_SWEEP'
  | 'CONTINUOUS_COLLISION_DETECTION';

export interface ClashPair {
  componentAId: string;
  componentBId: string;
}

export interface ClashContact {
  point: [number, number, number];
  normal?: [number, number, number];
  penetrationDepth?: number;
}

export interface ClashResult {
  id: string;
  pair: ClashPair;

  verdict: ClashVerdict;
  severity: ClashSeverity;

  penetrationDepth?: number;
  minimumClearance?: number;

  contacts: ClashContact[];

  transformAHash: string;
  transformBHash: string;

  geometryHashA: string;
  geometryHashB: string;

  toleranceUsed: number;

  algorithmVersion: string;

  evidenceId?: string;
  diagnostics?: string[];
}

export interface AxisAlignedBoundingBox {
  min: Vector3D;
  max: Vector3D;
}

export interface ClashGeometryPrimitive {
  id: string;
  type: 'BOX' | 'CYLINDER' | 'SPHERE' | 'TRIANGLE_MESH' | 'BREP_SOLID';
  dimensions?: {
    dx?: number;
    dy?: number;
    dz?: number;
    radius?: number;
    height?: number;
  };
  vertices?: number[]; // [x, y, z, x, y, z...]
  indices?: number[];
  faces?: any[];
  rawSolid?: any;
}

export interface ClashComponentDefinition {
  componentId: string;
  geometryId: string;
  geometry: ClashGeometryPrimitive;
  worldTransform: number[][]; // 4x4 matrix
  suppressed?: boolean;
  visible?: boolean;
}

export interface ClashDetectionOptions {
  requiredClearance?: number;
  tolerance?: number;
  allowTouching?: boolean;
  touchingTolerance?: number;
  analysisMode?: ClashAnalysisMode;
  allowedPairs?: Array<[string, string]>;
  maxPairsToEvaluate?: number;
}

export interface ClashAssemblyReport {
  assemblyId: string;
  verdict: ClashVerdict;
  analysisMode: ClashAnalysisMode;
  totalEvaluatedPairs: number;
  candidatePairsCount: number;
  clashCount: number;
  clearanceViolationCount: number;
  inconclusiveCount: number;
  invalidCount: number;
  results: ClashResult[];
  algorithmVersion: string;
  timestamp: string;
  evidenceId: string;
  determinismHash: string;
}
