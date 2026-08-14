/**
 * SECP-056 Production Manufacturing Intelligence & Process Planning Contracts
 */

import { Vector3D, ProcessType, GeometricParams, ManufacturabilityViolation } from './ManufacturingTypes';

export type ProductionFeatureType =
  | 'HOLE'
  | 'COUNTERBORE'
  | 'COUNTERSINK'
  | 'POCKET'
  | 'SLOT'
  | 'STEP'
  | 'BOSS'
  | 'FACE'
  | 'GROOVE'
  | 'CHAMFER'
  | 'FILLET'
  | 'THREAD'
  | 'PATTERN'
  | 'UNDERCUT';

export interface FeatureDimensions {
  depthMm?: number;
  diameterMm?: number;
  widthMm?: number;
  lengthMm?: number;
  cornerRadiusMm?: number;
  wallThicknessMm?: number;
  angleDeg?: number;
  counterboreDiameterMm?: number;
  counterboreDepthMm?: number;
  countersinkAngleDeg?: number;
}

export interface FeatureTolerances {
  dimensionalToleranceMm: number;
  surfaceFinishRaUm: number;
  geometricToleranceType?: 'FLATNESS' | 'CYLINDRICITY' | 'PARALLELISM' | 'PERPENDICULARITY' | 'POSITION';
}

export interface FeatureAccessibility {
  isAccessible3Axis: boolean;
  isAccessible5Axis: boolean;
  minimumToolReachMm: number;
  primaryAccessVector: Vector3D;
}

export interface FeatureToolRequirements {
  toolType: 'END_MILL' | 'BALL_MILL' | 'DRILL' | 'COUNTERBORE_DRILL' | 'COUNTERSINK_BIT' | 'THREAD_MILL' | 'CHAMFER_MILL' | 'TAP';
  minToolDiameterMm: number;
  maxToolDiameterMm: number;
  minToolReachMm: number;
  flutesRequired?: number;
}

export interface ProductionManufacturingFeature {
  featureId: string;
  type: ProductionFeatureType;
  sourceFeatureIds: string[];
  persistentTopologyIds: string[]; // From SECP-052 Persistent B-Rep Topology
  geometry: GeometricParams;
  dimensions: FeatureDimensions;
  tolerances: FeatureTolerances;
  accessibility: FeatureAccessibility;
  toolRequirements: FeatureToolRequirements;
  processCandidates: ProcessType[];
  provenance: string;
}

export interface ManufacturingFeatureGraph {
  nodes: ProductionManufacturingFeature[];
  adjacencyMap: Record<string, string[]>;
  accessibilityGraph: Record<string, { isAccessible3Axis: boolean; isAccessible5Axis: boolean }>;
  graphRevision: number;
  isInvalidated: boolean;
}

export interface ManufacturingMachineCapability {
  machineId: string;
  name: string;
  axisCount: 3 | 5;
  maxWorkpieceDimensionsMm: Vector3D;
  spindleMaxRpm: number;
  positionalAccuracyMm: number;
  supportedProcesses: ProcessType[];
}

export interface ManufacturingToolCandidate {
  toolId: string;
  name: string;
  toolType: 'END_MILL' | 'BALL_MILL' | 'DRILL' | 'COUNTERBORE_DRILL' | 'COUNTERSINK_BIT' | 'THREAD_MILL' | 'CHAMFER_MILL' | 'TAP';
  diameterMm: number;
  reachMm: number;
  fluteCount: number;
  material: 'CARBIDE' | 'HSS' | 'COBALT';
}

export type DFMDecisionStatus =
  | 'GEOMETRICALLY_VALID'
  | 'ENGINEERING_VALID'
  | 'MANUFACTURABLE'
  | 'PRODUCTION_READY'
  | 'UNMANUFACTURABLE';

export interface ManufacturingSetupPlan {
  setupCount: number;
  orientations: Vector3D[];
  primaryFixtureType: 'VISE' | 'CHUCK' | 'VACUUM_TABLE' | '5AXIS_TRUNNION';
}

export interface ManufacturingAssessment {
  status: DFMDecisionStatus;
  process: ProcessType;
  machine: ManufacturingMachineCapability;
  tool: ManufacturingToolCandidate;
  setup: ManufacturingSetupPlan;
  accessibility: {
    is3AxisFeasible: boolean;
    is5AxisFeasible: boolean;
    constrainedFeaturesCount: number;
  };
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: ManufacturabilityViolation[];
  warnings: string[];
  estimatedComplexity: number; // Scale 1 - 100
  provenance: ManufacturingProvenanceRecord;
}

export interface ManufacturingProvenanceRecord {
  systemVersion: string;
  timestamp: string;
  featureGraphHash: string;
  processPlanHash: string;
  dfmHash: string;
  resultHash: string;
  signature: string; // sha256-secp-056-*
}
