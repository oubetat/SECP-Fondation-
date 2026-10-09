/**
 * SECP CAD Kernel — Boolean Types & Contracts
 * Phase 2 (PATCH-019)
 */
import { TopoShape } from '../topology/TopologyContracts';
import { GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { Surface, Curve, Point } from '../geometry/GeometryContracts';

export type BooleanOperation = 'UNION' | 'INTERSECTION' | 'DIFFERENCE';

export type BooleanStatus =
  | 'SUCCESS'
  | 'EMPTY_RESULT'
  | 'INVALID_INPUT'
  | 'DEGENERATE_INPUT'
  | 'NUMERICAL_FAILURE'
  | 'TOPOLOGY_FAILURE'
  | 'UNSUPPORTED'
  | 'UNPROVEN'
  | 'INVALID_RESULT';

export type ClassificationState = 'INSIDE' | 'OUTSIDE' | 'ON_BOUNDARY' | 'COINCIDENT' | 'COINCIDENT_SAME' | 'COINCIDENT_OPPOSITE' | 'AMBIGUOUS';

export interface BooleanDiagnostic {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  entityId?: string;
  entityType?: string;
  message: string;
  details?: Record<string, any>;
}

export interface BooleanValidationResult {
  status: 'VALID' | 'INVALID' | 'UNPROVEN' | 'INCONCLUSIVE';
  topologicalValidity: boolean;
  geometricValidity: boolean;
  orientationValidity: boolean;
  semanticValidity: boolean | 'UNPROVEN';
  manifoldStatus: 'MANIFOLD' | 'NON_MANIFOLD' | 'OPEN' | 'UNPROVEN';
  expectedVolume?: number;
  actualVolume?: number;
  volumeDelta?: number;
  diagnostics: BooleanDiagnostic[];
}

export interface BooleanEvidence {
  operation: BooleanOperation;
  inputIdentities: string[];
  inputHashes: string[];
  outputIdentity: string;
  outputHash: string; // Legacy aggregate hash
  geometryHash: string;
  topologyHash: string;
  featureHash?: string;
  meshHash?: string;
  solverInputHash?: string;
  solverOutputHash?: string;
  kernelVersion: string;
  tolerancePolicy: GeometricToleranceModel;
  diagnostics: BooleanDiagnostic[];
  validationResult: BooleanValidationResult;
  provenanceReferences: string[];
  canonicalHash: string;
}

export interface GeneratedTopologyCount {
  vertices: number;
  edges: number;
  faces: number;
  shells: number;
  solids: number;
}

export interface BooleanResult {
  operation: BooleanOperation;
  status: BooleanStatus;
  resultShape: TopoShape | null;
  inputShapeIds: string[];
  generatedTopology: GeneratedTopologyCount | null;
  tolerance: GeometricToleranceModel;
  diagnostics: BooleanDiagnostic[];
  validation: BooleanValidationResult;
  determinismHash: string;
  evidence?: BooleanEvidence;
}

export interface BooleanLineSegment {
  start: Point;
  end: Point;
}

export interface SurfaceIntersectionCurve {
  id: string;
  sourceSurfaceAId: string;
  sourceSurfaceBId: string;
  faceA?: any; // Compatibility alias
  faceB?: any; // Compatibility alias
  curve3d: Curve;
  points3d: Point[];
  segments?: BooleanLineSegment[]; // Compatibility alias
  isClosed?: boolean;
  parametersA?: { u: number; v: number }[];
  parametersB?: { u: number; v: number }[];
  intersectionType: 'PLANE_PLANE' | 'PLANE_ANALYTIC' | 'ANALYTIC_ANALYTIC' | 'NURBS_ANALYTIC' | 'NURBS_NURBS' | 'PLANE_SPHERE' | 'UNKNOWN';
  tolerance: number;
  provenance: string;
}

export interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'UNPROVEN';
  details: string;
}

export interface HardAcceptanceGate019Report {
  gateId: 'HAG-019';
  patchId: 'PATCH-019';
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN';
  checks: GateCheck[];
  failures: string[];
  unproven: string[];
  evidenceIds: string[];
  determinismHash: string;
  timestamp: string;
}
