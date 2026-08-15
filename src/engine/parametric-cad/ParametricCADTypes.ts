/**
 * PATCH-SECP-071: Advanced Parametric CAD Kernel & Geometric Intelligence Core Types
 * Defines the core primitives for sketch constraints, B-Rep topology, NURBS, assemblies, and feature trees.
 */

export type ConstraintType = 'COINCIDENT' | 'PARALLEL' | 'PERPENDICULAR' | 'TANGENT' | 'CONCENTRIC' | 'HORIZONTAL' | 'VERTICAL' | 'DISTANCE' | 'ANGLE' | 'RADIUS';

export type MateType = 'COINCIDENT' | 'CONCENTRIC' | 'PARALLEL' | 'PERPENDICULAR' | 'DISTANCE' | 'ANGLE';

export type FeatureType = 'SKETCH' | 'EXTRUDE' | 'REVOLVE' | 'FILLET' | 'CHAMFER' | 'SHELL' | 'BOOLEAN';

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
  curveType: 'LINE' | 'ARC' | 'NURBS';
  controlPoints?: CADVertex[];
}

export interface CADFace {
  id: string;
  edgeIds: string[];
  surfaceType: 'PLANE' | 'CYLINDER' | 'SPHERE' | 'NURBS';
  normal: { x: number; y: number; z: number };
}

export interface CADSolid {
  id: string;
  faceIds: string[];
  volume: number;
  mass: number;
}

export interface GeometricConstraint {
  id: string;
  type: ConstraintType;
  entityIds: string[]; // Vertices or edges constrained
  value?: number;      // For dimensional constraints (distance, angle, radius)
}

export interface Sketch {
  id: string;
  planeFaceId: string;
  vertices: CADVertex[];
  edges: CADEdge[];
  constraints: GeometricConstraint[];
}

export interface ParametricFeature {
  id: string;
  type: FeatureType;
  parameters: Record<string, any>;
  dependencyIds: string[]; // parent feature IDs
  createdAt: string;
}

export interface CADPart {
  id: string;
  parameters?: Record<string, number>;
  name: string;
  sketches: Sketch[];
  features: ParametricFeature[];
  solids: CADSolid[];
  fingerprint: string; // Deterministic geometry hash
  version: number;
}

export interface AssemblyMate {
  id: string;
  type: MateType;
  partAId: string;
  entityAId: string;
  partBId: string;
  entityBId: string;
  value?: number;
}

export interface CADAssembly {
  id: string;
  name: string;
  partIds: string[];
  mates: AssemblyMate[];
  degreesOfFreedom: number;
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
