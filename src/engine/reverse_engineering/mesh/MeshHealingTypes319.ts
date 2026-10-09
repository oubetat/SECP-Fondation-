/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-319 — Mesh Healing Engine Types & Interfaces
 * 
 * DATATYPES:
 * - Defect Classification & Severity
 * - Explicit Repair Policies & Operations
 * - Mesh Healing Session & HealedMeshDataset
 * - Pre/Post Deviation & Topology Change Reports
 * - Evidence & Provenance Traceability Chain
 */

import { Vertex318, Triangle318, HalfEdge318, ScanMeshDataset, MeshTopologyMetrics } from './ScanMeshTypes318';

export type DefectType = 
  | 'DUPLICATE_VERTICES'
  | 'DUPLICATE_TRIANGLES'
  | 'DEGENERATE_TRIANGLE'
  | 'OPEN_BOUNDARY_LOOP'
  | 'SMALL_SCAN_HOLE'
  | 'LARGE_PHYSICAL_HOLE'
  | 'NON_MANIFOLD_EDGE'
  | 'INVERTED_NORMAL'
  | 'SELF_INTERSECTION';

export type DefectSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type HealingMode = 'CONSERVATIVE' | 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' | 'DISABLED';

export type RepairOperationType = 
  | 'MERGE_DUPLICATE_VERTICES'
  | 'REMOVE_DUPLICATE_TRIANGLES'
  | 'REMOVE_DEGENERATE_TRIANGLES'
  | 'REORIENT_INVERTED_NORMALS'
  | 'STITCH_BOUNDARY_GAP'
  | 'FILL_SMALL_HOLE'
  | 'RESOLVE_NON_MANIFOLD_EDGE';

export interface MeshDefect {
  defectId: string;
  type: DefectType;
  severity: DefectSeverity;
  description: string;
  location: { x: number; y: number; z: number };
  affectedVertexIndices: number[];
  affectedTriangleIndices: number[];
  metricValue?: number; // e.g. gap size in mm or face area in mm2
  status: 'DETECTED' | 'PROPOSED' | 'REPAIRED' | 'IGNORED' | 'UNREPAIRABLE';
}

export interface HealingPolicy {
  mode: HealingMode;
  mergeVerticesToleranceMm: number; // e.g., 0.02 mm
  maxAutoFillHoleAreaMm2: number; // e.g., 25.0 mm2 (protects large physical holes)
  protectPhysicalHoles: boolean;
  allowNormalReorientation: boolean;
  cleanupDegenerateTriangles: boolean;
  maxAllowedHealingDeviationMm: number; // Maximum allowed RMSE increase
}

export interface RepairProposal {
  proposalId: string;
  defectId: string;
  operationType: RepairOperationType;
  parameters: Record<string, any>;
  expectedEffect: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface TopologyChangeReport {
  verticesBefore: number;
  verticesAfter: number;
  verticesDelta: number;
  trianglesBefore: number;
  trianglesAfter: number;
  trianglesDelta: number;
  halfEdgesBefore: number;
  halfEdgesAfter: number;
  nonManifoldEdgesBefore: number;
  nonManifoldEdgesAfter: number;
  boundaryEdgesBefore: number;
  boundaryEdgesAfter: number;
  degenerateFacesRemoved: number;
  duplicateVerticesMerged: number;
  invertedNormalsFlipped: number;
  holesFilledCount: number;
  topologyChanged: boolean;
}

export interface HealingDeviationReport {
  referenceCloudId: string;
  preHealingRmseMm: number;
  postHealingRmseMm: number;
  maxDisplacementMm: number;
  meanDisplacementMm: number;
  preHealingMaxDevMm: number;
  postHealingMaxDevMm: number;
  outOfToleranceCount: number;
  toleranceMm: number;
  deviationIncreased: boolean;
}

export interface HealingProvenance {
  healedMeshId: string;
  parentMeshId: string;
  registrationId: string;
  policy: HealingPolicy;
  executedOperations: RepairOperationType[];
  timestamp: string;
  executionTimeMs: number;
  healedMeshHash: string;
  topologyHash: string;
}

export interface HealedMeshDataset {
  healedMeshId: string;
  parentMeshId: string;
  registrationId: string;
  vertices: Vertex318[];
  triangles: Triangle318[];
  halfEdges: HalfEdge318[];
  defectsDetected: MeshDefect[];
  defectsRepaired: MeshDefect[];
  topologyMetrics: MeshTopologyMetrics;
  topologyChangeReport: TopologyChangeReport;
  deviationReport: HealingDeviationReport;
  provenance: HealingProvenance;
  bounds: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
    diagonalMm: number;
  };
  units: 'mm' | 'm' | 'in';
  globalCoordinateFrame: string;
  status: 'ANALYZED' | 'PROPOSED' | 'APPLIED' | 'VALIDATED' | 'COMMITTED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}
