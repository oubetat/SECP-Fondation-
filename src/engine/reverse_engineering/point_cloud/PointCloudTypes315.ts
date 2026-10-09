/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-315 — Point Cloud Import
 * Type Definitions & Data Structures
 * 
 * CORE PRINCIPLE:
 * POINT CLOUD DATA ≠ ENGINEERING CAD MODEL
 * Point Cloud represents spatial measurements (X, Y, Z, Intensity, Colors, Normals),
 * NOT Feature Trees, B-Rep solids, or NURBS surfaces.
 */

export type PointCloudFormat =
  | 'PLY'
  | 'PCD'
  | 'XYZ'
  | 'PTS'
  | 'LAS'
  | 'LAZ'
  | 'PTX'
  | 'E57'
  | 'CSV';

export type PointCloudImportStatus =
  | 'PENDING'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED';

export type QualityClassification = 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID';

export interface Point3D {
  x: number;
  y: number;
  z: number;
  intensity?: number;
  color?: [number, number, number]; // RGB 0-255
  normal?: [number, number, number];
  classification?: number;
  scanId?: string;
  timestamp?: number;
}

export interface PointCloudBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  center: [number, number, number];
  diagonalMm: number;
}

export type BoundingBox3D = PointCloudBounds;

export interface PointCloudImportResult {
  format: PointCloudFormat;
  declaredPointCount: number;
  points: Point3D[];
  rejectedPoints: RejectedPointRecord[];
  detectedUnits: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
}

export interface PointCloudChunk {
  chunkId: string;
  startIndex: number;
  endIndex: number;
  pointCount: number;
  bounds: PointCloudBounds;
  points: Point3D[];
  storageRef?: string;
  status: 'LOADED' | 'DISK' | 'PROCESSING';
}

export interface PointCloudCoordinateSystem {
  coordinateFrame: string; // e.g., "LOCAL_SCAN_FRAME", "UTM_ZONE_32N"
  origin: [number, number, number];
  axes: {
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
  };
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
  transformMatrix: number[]; // 4x4 matrix
}

export interface RejectedPointRecord {
  pointIndex: number;
  rawText?: string;
  reason: 'NAN_COORDINATE' | 'INFINITY_VALUE' | 'MALFORMED_ROW' | 'OUT_OF_BOUNDS' | 'MISSING_XYZ';
  sourceLocation: string;
}

export interface PointCloudIntegrityReport {
  fileHash: string; // SHA-256
  totalDeclaredPoints?: number;
  importedCount: number;
  rejectedCount: number;
  rejectedRecords: RejectedPointRecord[];
  hasCoordinateErrors: boolean;
  precisionPreserved: boolean;
}

export interface PointCloudImportProvenance {
  importId: string;
  sourceFileHash: string;
  sourceFileName: string;
  importerVersion: string;
  timestamp: string;
  operatorId: string;
  importSettings: {
    targetUnits: string;
    coordinateHandling: string;
    chunkSize: number;
    validationMode: string;
  };
  resultHash: string;
}

export interface ScanProvenance {
  scanId: string;
  scannerManufacturer?: string;
  scannerModel?: string;
  acquisitionDate?: string;
  operator?: string;
  scannerPrecisionMm?: number;
  measurementUncertaintyMm?: number;
  resolutionMm?: number;
}

export interface NativePointCloud {
  pointCloudId: string;
  projectId: string;
  revisionId: string;
  scanId: string;
  format: PointCloudFormat;
  pointCount: number;
  bounds: PointCloudBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'UNIT_UNKNOWN';
  coordinateSystem: PointCloudCoordinateSystem;
  chunks: PointCloudChunk[];
  integrityReport: PointCloudIntegrityReport;
  importProvenance: PointCloudImportProvenance;
  scanProvenance: ScanProvenance;
  qualityClassification: QualityClassification;
  densityEstimatePtsPerMm3: number;
  hasNormals: boolean;
  hasColors: boolean;
  hasIntensities: boolean;
  status: PointCloudImportStatus;
  createdAt: string;
}

export interface PointCloudImportSettings {
  targetUnits?: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'AUTO';
  chunkSizePoints?: number;
  preserveRawData?: boolean;
  strictPrecision?: boolean;
  calculateNormalsIfMissing?: boolean;
}

export interface ReverseEngineeringSession {
  sessionId: string;
  projectId: string;
  revisionId: string;
  traceId: string;
  pointCloudId?: string;
  currentState: 'RAW' | 'IMPORTED' | 'VALIDATED' | 'FILTERED' | 'REGISTERED' | 'RECONSTRUCTED';
  createdAt: string;
}
