/**
 * PATCH-SECP-075: Integration Contracts
 * Enforces strict interfaces for data passing between CAD, Topology, FEA, and Results.
 */

import { CADPart } from '../parametric-cad/ParametricCADTypes';
import { NurbsSurface } from '../nurbs-geometry/NurbsTypes';
import { FEAMesh, BoundaryCondition, LoadDefinition, StructuralAnalysisResults } from '../structural-physics/StructuralPhysicsTypes';

export interface GeometryContract {
  part: CADPart;
  surfaces: NurbsSurface[];
}

export interface MeshContract {
  mesh: FEAMesh;
  isAdaptive: boolean;
  dofsPerNode: number;
}

export interface BoundaryLoadContract {
  bcs: BoundaryCondition[];
  loads: LoadDefinition[];
}

export interface AnalysisContract {
  mesh: FEAMesh;
  bcs: BoundaryCondition[];
  loads: LoadDefinition[];
}

export interface ResultsContract {
  results: StructuralAnalysisResults;
  provenanceHash: string;
}

export interface DesignFeedbackContract {
  recommendation: string;
  suggestedParameterUpdates: Record<string, number>;
}
