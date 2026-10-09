/**
 * SECP Industrial OS v2 — CFD Mesh Types
 * PATCH-051: CFD Mesh Infrastructure
 */

export enum CellType {
  TETRA = 'TETRA',
  HEXA = 'HEXA',
  PRISM = 'PRISM',
  PYRAMID = 'PYRAMID',
  POLYHEDRAL = 'POLYHEDRAL'
}

export enum BoundaryType {
  INLET = 'INLET',
  OUTLET = 'OUTLET',
  WALL = 'WALL',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC',
  UNKNOWN = 'UNKNOWN'
}

export interface Node {
  id: number;
  coords: [number, number, number];
}

export interface Face {
  id: number;
  nodeIds: number[];
  adjacentCellIds: number[];
  boundaryId?: string;
  normal?: [number, number, number];
  area?: number;
  centroid?: [number, number, number];
}

export interface Cell {
  id: number;
  nodeIds: number[];
  faceIds: number[];
  cellType: CellType;
  centroid?: [number, number, number];
  volume?: number;
}

export interface BoundaryRegistryEntry {
  id: string;
  name: string;
  boundaryType: BoundaryType;
  faceIds: number[];
}

export interface MeshProvenance {
  sourceArtifact?: string;
  sourceFormat?: string;
  generator?: string;
  generatorVersion?: string;
  inputIdentity?: string;
  parentMeshIdentity?: string;
  timestamp: string;
  transformationHistory: string[];
}

export interface MeshToleranceConfig {
  geometricTolerance: number; // e.g. 1e-8
  volumeTolerance: number;    // e.g. 1e-12
  areaTolerance: number;      // e.g. 1e-10
}

export interface CFDMesh {
  meshId: string;
  nodes: Node[];
  faces: Face[];
  cells: Cell[];
  boundaries: BoundaryRegistryEntry[];
  dimensionality: 2 | 3;
  provenance: MeshProvenance;
  metadata: Record<string, any>;
  toleranceConfig: MeshToleranceConfig;
}

export enum MeshVerdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  UNPROVEN = 'UNPROVEN',
  INCONCLUSIVE = 'INCONCLUSIVE',
  INVALID = 'INVALID'
}

export enum MeshDiagnostic {
  VALID_MESH = 'VALID_MESH',
  DEGENERATE_MESH = 'DEGENERATE_MESH',
  NON_MANIFOLD_MESH = 'NON_MANIFOLD_MESH',
  INVALID_TOPOLOGY = 'INVALID_TOPOLOGY',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  ORIENTATION_FAILURE = 'ORIENTATION_FAILURE',
  BOUNDARY_REGISTRY_FAILURE = 'BOUNDARY_REGISTRY_FAILURE',
  FVM_NOT_READY = 'FVM_NOT_READY',
  DUPLICATE_ID = 'DUPLICATE_ID',
  OUT_OF_BOUNDS_INDEX = 'OUT_OF_BOUNDS_INDEX'
}

export interface MeshValidationResult {
  verdict: MeshVerdict;
  diagnostics: MeshDiagnostic[];
  errors: string[];
  fvmReady: boolean;
}

export interface MeshQualityMetrics {
  minVolume: number;
  maxVolume: number;
  totalVolume: number;
  minFaceArea: number;
  maxFaceArea: number;
  degenerateCellCount: number;
  zeroAreaFaceCount: number;
  invertedCellCount: number;
  nonManifoldFaceCount: number;
  disconnectedComponentCount: number;
  cellCount: number;
  faceCount: number;
  nodeCount: number;
}

export interface CFDMeshCell3D {
  id: number;
  center?: [number, number, number];
  volume: number;
  neighbors?: number[];
  faceIds?: number[];
}

export interface CFDMeshFace3D {
  id: number;
  ownerCellId: number;
  neighborCellId: number | null;
  area: number;
  normal: [number, number, number];
  isBoundary: boolean;
  center?: [number, number, number];
  boundaryId?: number | string;
}

export type Face3D = CFDMeshFace3D;
export type CFDFace3D = CFDMeshFace3D;
export type Cell3D = CFDMeshCell3D;

export interface CFDMeshBoundaryCondition3D {
  type: BoundaryType;
  faceIds: number[];
}

export interface CFDMesh3D {
  meshId?: string;
  cells: CFDMeshCell3D[];
  faces: CFDMeshFace3D[];
  boundaryConditions?: CFDMeshBoundaryCondition3D[];
  nodes?: any[];
  metadata?: any;
}

