/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-317 — Registration / Alignment Engine
 * Type Definitions & Architectural Data Structures
 * 
 * CORE RULES ENFORCED:
 * - Rule 2 & 3: ALIGNMENT ESTIMATES TRANSFORM, DOES NOT MODIFY GEOMETRY.
 * - Rule 11 & 14: Rigid Registration — Scale = 1, p' = R*p + t. No arbitrary deformation.
 * - Rule 32: Convergence Status (CONVERGED, MAX_ITERATIONS, FAILED, DEGENERATE, CANCELLED).
 * - Rule 41 & 44: Registration Graph & Pose Graph for Multi-Scan Alignment.
 * - Rule 67 & 68: Multi-Source RegisteredPointCloud maintains original point provenance.
 * - Rule 73, 74, 75: Alignment != Fusion != Mesh != CAD.
 * - Rule 83: GPU Truth Rule (ExecutionBackend = CPU_SINGLE_THREAD).
 */

import { Point3D, PointCloudBounds, PointCloudCoordinateSystem } from '../point_cloud/PointCloudTypes315';
import { FilteredPointCloud } from '../filtering/PointCloudFilterTypes316';

export type RegistrationAlgorithm =
  | 'ICP_POINT_TO_POINT'
  | 'ICP_POINT_TO_PLANE'
  | 'MANUAL_CORRESPONDENCE_SVD'
  | 'FEATURE_BASED_INITIAL'
  | 'MULTI_SCAN_GLOBAL_GRAPH';

export type RegistrationMode = 'MANUAL' | 'PAIRWISE' | 'GLOBAL' | 'FINE';

export type ConvergenceStatus =
  | 'CONVERGED'
  | 'MAX_ITERATIONS'
  | 'FAILED'
  | 'DEGENERATE'
  | 'INSUFFICIENT_OVERLAP'
  | 'CANCELLED';

export type ExecutionBackend = 'CPU_SINGLE_THREAD' | 'CPU_WORKER' | 'GPU_ACCELERATED';

/**
 * 4x4 Homogeneous Transformation Matrix Representation
 * R (3x3 Rotation) + t (3x1 Translation)
 */
export interface RigidTransform {
  transformId: string;
  sourceFrame: string;
  targetFrame: string;
  
  // 4x4 Row-Major Homogeneous Matrix
  matrix: [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
  ];
  
  rotationMatrix: [
    number, number, number,
    number, number, number,
    number, number, number
  ];
  
  translationVector: [number, number, number];
  
  scaleFactor: number;            // Must be strictly 1.0 for rigid transform
  isValidRigid: boolean;          // Det(R) ≈ 1 and R^T * R ≈ I
  determinantR: number;           // Should be 1.0
}

export interface PointCorrespondence {
  sourcePointIndex: number;
  targetPointIndex: number;
  sourcePoint: [number, number, number];
  targetPoint: [number, number, number];
  distanceMm: number;
  weight: number;
  confidence: number;
  rejected: boolean;
  rejectionReason?: string;
}

export interface RegistrationSettings {
  algorithm: RegistrationAlgorithm;
  mode: RegistrationMode;
  
  // ICP & Correspondence Parameters
  maxIterations?: number;                    // Default: 50
  transformationTolerance?: number;         // Delta matrix norm threshold (e.g. 1e-6)
  residualToleranceMm?: number;              // Delta RMSE threshold (e.g. 0.001 mm)
  maxCorrespondenceDistanceMm?: number;      // Distance cutoff for valid pairing (e.g. 10.0 mm)
  
  // Outlier Rejection & Robust Loss
  outlierRejectionRatio?: number;            // Trimmed ICP ratio (e.g. 0.10 for top 10% worst rejection)
  minOverlapRatio?: number;                  // Minimum overlap ratio required (e.g. 0.15)
  
  // Initial Transform
  initialTransform?: RigidTransform;
  
  // Execution Context
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
  executionBackendRequested?: ExecutionBackend;
}

export interface RegistrationResidualAnalysis {
  meanResidualMm: number;
  medianResidualMm: number;
  stdDevResidualMm: number;
  rmseMm: number;
  maxResidualMm: number;
  percentile90ResidualMm: number;
  validCorrespondenceCount: number;
  rejectedCorrespondenceCount: number;
}

export interface RegistrationQualityReport {
  registrationId: string;
  convergenceStatus: ConvergenceStatus;
  iterationsCompleted: number;
  initialRmseMm: number;
  finalRmseMm: number;
  rmseImprovementMm: number;
  overlapRatioEstimate: number;
  isSufficientOverlap: boolean;
  residualAnalysis: RegistrationResidualAnalysis;
  transformValidity: {
    isRigid: boolean;
    scalePreserved: boolean;
    rotationDeterminant: number;
    orthogonalityError: number;
  };
  warnings: string[];
  errors: string[];
}

export interface TransformProvenance {
  transformId: string;
  sourceDatasetId: string;
  targetDatasetId: string;
  algorithm: RegistrationAlgorithm;
  algorithmVersion: string;
  executionBackend: ExecutionBackend;
  timestamp: string;
  executionTimeMs: number;
  settingsHash: string;
  transformHash: string;
}

/**
 * Registered Point Cloud Dataset
 * Preserves point-by-point provenance referencing original scan / filtered dataset
 */
export interface RegisteredPointRecord {
  pointIndex: number;
  originalPoint: Point3D;
  transformedPoint: Point3D;
  sourceDatasetId: string;
  residualErrorMm?: number;
}

export interface RegisteredPointCloud {
  registeredDatasetId: string;
  sourceDatasetIds: string[];               // Scan A, Scan B, etc.
  targetRefDatasetId: string;               // Anchor frame dataset
  
  registrationId: string;
  appliedTransform: RigidTransform;
  
  pointCount: number;
  bounds: PointCloudBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
  globalCoordinateFrame: string;            // 'GLOBAL_ALIGNMENT_FRAME'
  
  registeredPoints: RegisteredPointRecord[];
  qualityReport: RegistrationQualityReport;
  provenance: TransformProvenance;
  integrityHash: string;
  createdAt: string;
}

export interface PoseGraphNode {
  datasetId: string;
  label: string;
  pose: RigidTransform;
}

export interface PoseGraphEdge {
  edgeId: string;
  sourceDatasetId: string;
  targetDatasetId: string;
  relativeTransform: RigidTransform;
  rmseMm: number;
  confidence: number;
}

export interface RegistrationGraph {
  nodes: PoseGraphNode[];
  edges: PoseGraphEdge[];
  globalAccumulatedDriftMm: number;
  loopClosureDetected: boolean;
}
