/**
 * PATCH-SECP-073: FEM & Structural Physics Kernel Types
 * Defines mathematical primitives for structural analysis, meshing, materials,
 * loads, boundary conditions, stiffness matrices, stress/strain tensors, and design feedback.
 */

import { CADPart } from '../parametric-cad/ParametricCADTypes';

export interface MaterialProperties {
  id: string;
  name: string;
  youngsModulus: number; // Pascals (Pa)
  poissonsRatio: number; // Dimensionless
  yieldStrength: number; // Pascals (Pa)
  density: number;        // kg/m^3
}

export interface MeshNode {
  id: number; // Node index (1-based)
  x: number;  // meters
  y: number;  // meters
  z: number;  // meters
  dofIndices: number[]; // Global DOF mapping indices
}

export interface MeshElement {
  id: number;
  type: 'BAR_1D' | 'TRI_2D' | 'TET_3D' | 'QUAD_2D' | 'HEX_3D';
  nodeIds: number[]; // Connected node IDs
  materialId: string;
  crossSectionArea?: number; // m^2 for 1D/2D
  thickness?: number;        // meters for 2D shell
}

export interface FEAMesh {
  nodes: MeshNode[];
  elements: MeshElement[];
  qualityMetrics: {
    aspectRatioMin: number;
    aspectRatioMax: number;
    jacobianDeterminantMin: number;
    isValid: boolean;
  };
}

export type BoundaryConditionType = 'FIXED' | 'ROLLER' | 'PINNED' | 'SYMMETRY';

export interface BoundaryCondition {
  id: string;
  nodeId: number;
  type: BoundaryConditionType;
  constrainedDOFs: boolean[]; // [u_x, u_y, u_z]
  prescribedDisplacements?: number[]; // [val_x, val_y, val_z]
}

export interface LoadDefinition {
  id: string;
  type?: string;
  nodeId: number;
  forceVector: { x: number; y: number; z: number }; // Newtons (N)
  momentVector?: { x: number; y: number; z: number }; // N*m
}

export interface StiffnessMatrix {
  dimension: number;
  values: number[][]; // Dense or sparse representation
}

export interface NodeResults {
  nodeId: number;
  displacement: { x: number; y: number; z: number }; // meters
  strain: { xx: number; yy: number; zz: number; xy: number; yz: number; xz: number };
  stress: { xx: number; yy: number; zz: number; xy: number; yz: number; xz: number };
  vonMises: number; // Pascals (Pa)
  safetyFactor: number;
}

export interface StructuralAnalysisResults {
  assemblyId?: string;
  partId: string;
  nodes: NodeResults[];
  maxDisplacement: number;
  maxStress: number;
  yieldExceeded: boolean;
  converged: boolean;
  residualNorm: number;
}

export interface DesignFeedback {
  recommendation: 'PRESERVE' | 'THICKEN_SECTION' | 'REDUCE_WEIGHT' | 'REALLOCATE_LOAD';
  targetFeatureId?: string;
  suggestedMultiplier: number;
  explanation: string;
}

export interface StructuralProvenanceRecord {
  recordId: string;
  partId: string;
  meshHash: string;
  physicsHash: string;
  signedBy: string;
  timestamp: string;
}

export interface FEAPackage {
  packageId: string;
  partId: string;
  mesh: FEAMesh;
  results: StructuralAnalysisResults;
  provenance: StructuralProvenanceRecord;
  isValid: boolean;
}
