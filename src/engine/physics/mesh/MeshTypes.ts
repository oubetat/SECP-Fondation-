/**
 * SECP Industrial OS v2 — Mesh Abstraction Types
 * PATCH-047: Mesh Abstraction
 */

export type MeshDimension = '1D' | '2D' | '3D';

export interface MeshNode {
  nodeId: string;
  coordinates: [number, number] | [number, number, number];
  coordinateSystemId?: string;
  regionId?: string;
  metadata?: Record<string, any>;
}

export type MeshElementType = 
  | 'LINE' 
  | 'TRIANGLE' 
  | 'QUADRILATERAL' 
  | 'TETRAHEDRON' 
  | 'HEXAHEDRON' 
  | 'PRISM' 
  | 'PYRAMID';

export interface MeshElement {
  elementId: string;
  type: MeshElementType;
  nodeIds: string[];
  dimension: 1 | 2 | 3;
  regionId?: string;
  materialRegionId?: string;
  metadata?: Record<string, any>;
}

export type MeshRegionType = 
  | 'BOUNDARY' 
  | 'INTERIOR' 
  | 'INLET' 
  | 'OUTLET' 
  | 'WALL' 
  | 'SYMMETRY' 
  | 'FLUID' 
  | 'SOLID' 
  | 'MATERIAL_REGION' 
  | 'OTHER';

export interface MeshRegion {
  regionId: string;
  name: string;
  regionType: MeshRegionType;
  entityIds: string[]; // Node IDs or Element IDs belonging to this region
  dimension?: 1 | 2 | 3;
  metadata?: Record<string, any>;
}

export interface MeshTopologySummary {
  nodeCount: number;
  elementCount: number;
  orphanNodeIds: string[];
  orphanElementIds: string[];
  duplicateElementIds: string[];
  nodeToElementMap: Record<string, string[]>;
  isManifold: boolean | 'UNPROVEN';
}

export type MeshQualityMetricStatus = 'COMPUTED' | 'NOT_COMPUTED' | 'INVALID' | 'UNPROVEN';

export interface MeshQualityReport {
  status: MeshQualityMetricStatus;
  elementCount: number;
  minVolumeOrArea?: number;
  maxVolumeOrArea?: number;
  averageVolumeOrArea?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  averageAspectRatio?: number;
  nonPositiveElements: string[]; // IDs of elements with zero or negative volume/area
  skewnessStatus: MeshQualityMetricStatus;
  orthogonalityStatus: MeshQualityMetricStatus;
  details?: Record<string, any>;
}

export interface MeshSet {
  meshId: string;
  modelId: string;
  meshVersion: string;
  dimension: MeshDimension;
  topologyType: 'STRUCTURED' | 'UNSTRUCTURED' | 'HYBRID';
  elementFamily: string;
  coordinateSystemId?: string;
  nodes: MeshNode[];
  elements: MeshElement[];
  regions: MeshRegion[];
  quality?: MeshQualityReport;
  provenanceId?: string;
  revision: string;
  metadata?: Record<string, any>;
  canonicalHash?: string;
}
