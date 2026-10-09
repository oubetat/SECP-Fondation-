/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-320 — Feature Recognition Engine Types
 */

import { Point3D } from '../point_cloud/PointCloudTypes315';

export type PrimitiveType = 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS' | 'UNKNOWN';

export type EngineeringFeatureType = 
  | 'HOLE_THROUGH' 
  | 'HOLE_BLIND' 
  | 'BOSS' 
  | 'POCKET' 
  | 'SLOT' 
  | 'RIB' 
  | 'FILLET' 
  | 'CHAMFER' 
  | 'PATTERN_LINEAR' 
  | 'PATTERN_CIRCULAR';

export type FeatureStatus = 
  | 'CANDIDATE' 
  | 'RECOGNIZED' 
  | 'REJECTED' 
  | 'AMBIGUOUS' 
  | 'UNSUPPORTED' 
  | 'INVALIDATED';

export interface FittingMetrics {
  meanResidualMm: number;
  rmseMm: number;
  maxResidualMm: number;
  p95ResidualMm: number;
  supportingAreaMm2: number;
  coverageRatio: number; // Percentage of segment area explained by primitive
  pointCount: number;
}

export interface GeometricPrimitive {
  type: PrimitiveType;
  origin: [number, number, number];
  direction?: [number, number, number]; // Axis for cylinder/cone/torus, Normal for plane
  radius?: number;
  secondaryRadius?: number; // Torus minor radius
  angle?: number; // Cone half-angle
  extent?: number; // Length along axis
}

export interface FeatureSourceMap {
  sourceMeshId: string;
  sourcePointCloudId?: string;
  faceIndices: number[];
  vertexIndices: number[];
  pointIndices?: number[];
}

export interface RecognizedFeature {
  featureId: string;
  type: EngineeringFeatureType | PrimitiveType;
  primitive?: GeometricPrimitive;
  parameters: Record<string, number | string | boolean | number[]>;
  metrics: FittingMetrics;
  sourceMap: FeatureSourceMap;
  confidence: {
    score: number; // 0.0 to 1.0
    method: string;
    metricsUsed: string[];
  };
  relationships: FeatureRelationship[];
  status: FeatureStatus;
  provenance: {
    algorithm: string;
    algorithmVersion: string;
    timestamp: string;
    settingsHash: string;
  };
}

export interface FeatureRelationship {
  targetFeatureId: string;
  type: 'PARALLEL' | 'PERPENDICULAR' | 'COAXIAL' | 'CONCENTRIC' | 'TANGENT' | 'ADJACENT' | 'SYMMETRIC' | 'PATTERN_MEMBER';
  toleranceMm: number;
  measuredValue: number; // e.g. angle in degrees or distance in mm
}

export interface FeatureRecognitionSession {
  sessionId: string;
  inputMeshId: string;
  inputPointCloudId?: string;
  segments: {
    segmentId: string;
    faceIndices: number[];
    primitiveCandidate?: GeometricPrimitive;
    fittingMetrics?: FittingMetrics;
  }[];
  features: RecognizedFeature[];
  totalAreaAnalyzedMm2: number;
  recognizedAreaMm2: number;
  status: 'ANALYZING' | 'SEGMENTED' | 'FITTED' | 'CLASSIFIED' | 'VALIDATED' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface FeatureRecognitionSettings {
  normalToleranceDeg: number;
  curvatureTolerance?: number;
  minSegmentAreaMm2: number;
  ransacIterations: number;
  fittingToleranceMm: number;
  minCoverageRatio: number;
}
