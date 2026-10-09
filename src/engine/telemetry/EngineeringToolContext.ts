/**
 * SECP Engineering OS — Canonical Tool Context Definition
 * Phase 1 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Unifies all 185 Workbench Tools & Patch Tabs as Consumers of a Single Source of Truth.
 * - Provides zero-trust, deterministic, dynamic engineering metrics.
 * - Eliminates hardcoded, fake, or local status values across all UI tools.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';

export interface GeometryMetrics {
  bodies: number;
  solids: number;
  faces: number;
  edges: number;
  vertices: number;
  volume: number; // Primary volume in cm³
  volumeCm3: number; // Volume in cm³
  volumeMm3: number; // Volume in mm³
  surfaceArea: number; // Primary surface area in cm²
  surfaceAreaCm2: number; // Surface area in cm²
  surfaceAreaMm2: number; // Surface area in mm²
  mass: number; // kg
  density: number; // g/cm³
  materialName: string;
  boundingWidth: number; // mm
  boundingHeight: number; // mm
  boundingDepth: number; // mm
  geometryHash: string;
}

export interface SketchMetrics {
  totalSketches: number;
  entitiesCount: number;
  constraintsCount: number;
  fullyConstrained: boolean;
  dof: number;
  dimensionsCount: number;
  residual: number; // solver error mm
  activeSketchId?: string;
  revision: number;
}

export interface AssemblyMetrics {
  componentsCount: number;
  jointsCount: number;
  dof: number;
  interferencesCount: number;
  brokenReferencesCount: number;
  revision: number;
}

export interface FemDomainMetrics {
  meshElements: number;
  nodes: number;
  loadCases: number;
  solverStatus: 'UP_TO_DATE' | 'STALE' | 'NOT_SOLVED';
  sourceRevision: number;
  solvedRevision: number;
  maxVonMisesMPa?: number;
  maxDisplacementMm?: number;
}

export interface CfdDomainMetrics {
  meshCells: number;
  nodes: number;
  boundaryConditionsCount: number;
  solverStatus: 'UP_TO_DATE' | 'STALE' | 'NOT_SOLVED';
  sourceRevision: number;
  solvedRevision: number;
  maxVelocityMs?: number;
  maxPressurePa?: number;
}

export interface CamDomainMetrics {
  operationsCount: number;
  estimatedCycleTimeSeconds: number;
  materialRemovalVolumeCm3: number;
  status: 'UP_TO_DATE' | 'STALE' | 'NOT_GENERATED';
  sourceRevision: number;
  toolpathRevision: number;
  gcodeBlockCount: number;
}

export interface DrawingDomainMetrics {
  viewsCount: number;
  dimensionsCount: number;
  status: 'UP_TO_DATE' | 'STALE' | 'NOT_GENERATED';
  sourceRevision: number;
  drawingRevision: number;
}

export interface BomDomainMetrics {
  lineItemsCount: number;
  totalPartQuantity: number;
  status: 'UP_TO_DATE' | 'STALE';
  sourceRevision: number;
  bomRevision: number;
}

export interface DependencyState {
  nodeId: string;
  nodeType: 'FEATURE' | 'SKETCH' | 'ASSEMBLY' | 'FEM' | 'CFD' | 'CAM' | 'DRAWING' | 'BOM';
  name: string;
  status: 'VALID' | 'STALE' | 'INVALID' | 'MODIFIED';
  upstreamIds: string[];
  downstreamIds: string[];
  revision: number;
}

export interface DerivedArtifactState {
  artifactId: string;
  artifactType: 'BREP' | 'MESH' | 'DRAWING_SVG' | 'BOM_JSON' | 'GCODE_NC' | 'FEA_RESULTS' | 'CFD_RESULTS' | 'STEP_TDP';
  name: string;
  hash: string;
  generatingDocumentHash: string;
  generatingRevision: number;
  isStale: boolean;
  timestamp: string;
}

export interface EngineeringEvidence {
  recordId: string;
  revision: number;
  documentHash: string;
  merkleRoot: string;
  signature: string;
  timestamp: string;
  provenanceIssuer: string;
  certified: boolean;
}

export interface EngineeringInvalidation {
  domain: 'GEOMETRY' | 'ASSEMBLY' | 'FEM' | 'CFD' | 'CAM' | 'DRAWING' | 'BOM';
  reason: string;
  triggerFeatureId?: string;
  sourceRevision: number;
  targetRevision: number;
}

export interface EngineeringToolContext {
  projectId: string;
  documentId: string;

  revision: number;
  documentHash: string;

  canonicalDocument: EngineeringDocument;

  // Domain Views derived from Single Source of Truth
  geometry: GeometryMetrics;
  sketch: SketchMetrics;
  assembly: AssemblyMetrics;
  fem: FemDomainMetrics;
  cfd: CfdDomainMetrics;
  cam: CamDomainMetrics;
  drawing: DrawingDomainMetrics;
  bom: BomDomainMetrics;

  // Graph and Lifecycle Truth
  dependencies: DependencyState[];
  artifacts: DerivedArtifactState[];
  evidence: EngineeringEvidence[];
  invalidations: EngineeringInvalidation[];

  // Custom Domain Metrics Extension
  domainMetrics: Record<string, number | string | boolean>;

  authority: {
    source: 'CANONICAL';
    revision: number;
    evalTimeMs: number;
    isClean: boolean;
  };
}
