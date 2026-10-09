import { NURBSSurface322 } from './NURBSTypes322';

export interface BRepPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface BRepVertex {
  vertexId: string;
  point: BRepPoint3D;
  toleranceMm: number;
}

export type BRepEdgeBoundaryType = 'U_MIN' | 'U_MAX' | 'V_MIN' | 'V_MAX' | 'CUSTOM';

export interface BRepEdgeCurve {
  type: 'NURBS_ISO_CURVE' | 'DEGENERATE';
  surfaceId: string;
  boundaryType: BRepEdgeBoundaryType;
  tMin: number;
  tMax: number;
}

export interface BRepEdge {
  edgeId: string;
  curve: BRepEdgeCurve;
  startVertexId: string;
  endVertexId: string;
  isDegenerate: boolean;
  toleranceMm: number;
}

export interface BRepCoEdge {
  coedgeId: string;
  edgeId: string;
  orientation: 'FORWARD' | 'REVERSED';
}

export interface BRepLoop {
  loopId: string;
  coedgeIds: string[];
  type: 'OUTER' | 'INNER';
}

export interface BRepFace {
  faceId: string;
  surfaceId: string;
  outerLoopId: string;
  innerLoopIds: string[];
  orientation: 'FORWARD' | 'REVERSED';
  uvDomain: { uMin: number; uMax: number; vMin: number; vMax: number };
}

export interface BRepShell {
  shellId: string;
  faceIds: string[];
}

export interface BRepSolid {
  solidId: string;
  outerShellId: string;
  innerShellIds: string[];
}

export interface BRepTopologicalValidation {
  vertexCount: number;
  edgeCount: number;
  coedgeCount: number;
  loopCount: number;
  faceCount: number;
  shellCount: number;
  solidCount: number;
  eulerCharacteristic: number;
  isManifold: boolean;
  isClosed: boolean;
  openEdgeCount: number;
  nonManifoldEdgeCount: number;
  degenerateEdgeCount: number;
  hasTjunctions: boolean;
  orientationConsistent: boolean;
}

export interface BRepGeometricValidation {
  maxGapMm: number;
  rmsDeviationMm: number;
  maxDeviationMm: number;
  areaMm2: number;
  volumeMm3: number;
  signedVolumeMm3?: number;
  shellOrientation?: 'OUTWARD' | 'INWARD' | 'UNKNOWN';
  centroid: BRepPoint3D;
  verticesValid: boolean;
  edgesValid: boolean;
  loopsClosed: boolean;
}

export interface BRepValidationReport {
  isValid: boolean;
  topology: BRepTopologicalValidation;
  geometry: BRepGeometricValidation;
  failures: string[];
}

export interface BRepProvenance {
  sourceNurbsIds: string[];
  timestamp: string;
}

export interface BRepModel323 {
  modelId: string;
  units: 'mm';
  coordinateFrame: 'WORLD';
  vertices: BRepVertex[];
  edges: BRepEdge[];
  coedges: BRepCoEdge[];
  loops: BRepLoop[];
  faces: BRepFace[];
  shells: BRepShell[];
  solids: BRepSolid[];
  provenance: BRepProvenance;
  validationReport: BRepValidationReport | null;
}

export interface BRepEvidencePayload {
  modelId: string;
  sourceNurbsIds: string[];
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  shellCount: number;
  solidCount: number;
  manifoldStatus: 'MANIFOLD' | 'NON_MANIFOLD' | 'UNKNOWN';
  closedStatus: 'CLOSED' | 'OPEN' | 'UNKNOWN';
  eulerCharacteristic: number;
  rmsDeviationMm: number;
  maxDeviationMm: number;
  validationPassed: boolean;
}
