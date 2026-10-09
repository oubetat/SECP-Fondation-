export interface CADVertex {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface CADEdge {
  id: string;
  startVertexId: string;
  endVertexId: string;
  curveType: 'LINE' | 'ARC' | string;
}

export interface GeometricConstraint {
  id: string;
  type: 'DISTANCE' | 'FIXED' | string;
  entityIds: string[];
  value: number;
}

export interface Sketch {
  id: string;
  planeFaceId: string;
  vertices: CADVertex[];
  edges: CADEdge[];
  constraints: GeometricConstraint[];
}

export interface BRepSolid {
  id: string;
  faceIds: string[];
  volume?: number;
}

export interface AssemblyMate {
  id: string;
  type: 'COINCIDENT' | 'CONCENTRIC' | 'PARALLEL' | string;
  partAId: string;
  entityAId: string;
  partBId: string;
  entityBId: string;
}

export interface CADAssembly {
  id: string;
  name: string;
  partIds: string[];
  mates: AssemblyMate[];
  degreesOfFreedom: number;
}

export type FeatureType = string;

export interface ParametricFeature {
  id: string;
  type: FeatureType;
  name?: string;
  parameters?: any;
  suppressed?: boolean;
  [key: string]: any;
}

export interface CADBody {
  id: string;
  name: string;
  visible: boolean;
  suppressed: boolean;
  revision: number;
  dependencyIds: string[];
  features?: any[];
  brepSolid?: any;
  transformMatrix?: number[];
  materialId?: string;
  mass?: number;
  volume?: number;
  [key: string]: any;
}

export interface CADPart {
  id: string;
  name: string;
  sketches: Sketch[];
  features: any[];
  solids: BRepSolid[];
  brepSolids?: any[];
  fingerprint: string;
  version: number;
  bodies?: CADBody[];
  activeBodyId?: string;
}

export interface CADProvenanceRecord {
  recordId: string;
  partId: string;
  featureTreeHash: string;
  geometryHash: string;
  signedBy: string;
  timestamp: string;
}

export interface CADPackage {
  packageId: string;
  part?: CADPart;
  assembly?: CADAssembly;
  provenance: CADProvenanceRecord;
  isValid: boolean;
}
