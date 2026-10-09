/**
 * SECP CAD Kernel — Surface Healing Types & Defect Taxonomy
 * PATCH-205: Phase 18 — Professional Modeling
 */

import { Point, Vector, Curve } from '../../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../../cad-kernel/geometry/BRepGeometry';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';

export type DefectCategory = 'GEOMETRIC' | 'TOPOLOGICAL' | 'PARAMETRIC';

export type GeometricDefectType =
  | 'GAP'
  | 'OVERLAP'
  | 'DISCONTINUITY'
  | 'DEGENERATE_REGION'
  | 'SELF_INTERSECTION'
  | 'INVALID_PARAMETERIZATION'
  | 'CURVATURE_SPIKE'
  | 'SURFACE_SINGULARITY';

export type TopologicalDefectType =
  | 'OPEN_WIRE'
  | 'BROKEN_EDGE'
  | 'MISSING_EDGE'
  | 'DUPLICATE_EDGE'
  | 'INVALID_LOOP'
  | 'INVALID_SHELL'
  | 'DUPLICATE_SURFACE';

export type ParametricDefectType =
  | 'INVALID_KNOT_VECTOR'
  | 'DUPLICATE_KNOT'
  | 'INVALID_DEGREE'
  | 'INVALID_WEIGHT'
  | 'PARAMETER_DOMAIN_ERROR';

export type DefectType = GeometricDefectType | TopologicalDefectType | ParametricDefectType;

export type DefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'WARNING';

export type DefectStatus = 'VALID' | 'WARNING' | 'REPAIRABLE' | 'UNREPAIRABLE';

export type GapClassification = 'MICRO_GAP' | 'SMALL_GAP' | 'LARGE_GAP' | 'INVALID_GAP';

export type HealingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type EngineeringVerdict =
  | 'HEALED_AND_VALIDATED'
  | 'REPAIRED_REQUIRES_REVIEW'
  | 'UNREPAIRABLE'
  | 'INVALID';

export interface DefectReport {
  defectId: string;
  defectType: DefectType;
  category: DefectCategory;
  severity: DefectSeverity;
  status: DefectStatus;
  location: Point;
  affectedGeometry: string;
  tolerance: number;
  measuredDeviation: number;
  recommendedRepair: string;
  confidence: HealingConfidence;
  details?: string;
}

export interface DeviationAnalysis {
  maxDeviation: number;
  meanDeviation: number;
  rmsDeviation: number;
  samplePointsCount: number;
  preservesDesignIntent: boolean;
}

export interface HealingOptions {
  tolerance?: number; // default 1e-4
  maxAutoHealGap?: number; // default 0.1 mm
  continuityLevel?: 'G0' | 'G1' | 'G2';
  allowGlobalReconstruction?: boolean;
  autoCommit?: boolean;
}

export interface SurfaceHealingEvidence {
  evidenceId: string;
  originalGeometryHash: string;
  repairedGeometryHash: string;
  originalTopologyHash: string;
  repairedTopologyHash: string;
  defectsDetected: number;
  repairsApplied: number;
  tolerance: number;
  maxDeviation: number;
  meanDeviation: number;
  continuityResult: string;
  validationResult: EngineeringVerdict;
  kernelVersion: string;
  timestamp: string;
}

export type SurfaceHealingEventType =
  | 'SURFACE_DEFECT_DETECTED'
  | 'SURFACE_HEALING_STARTED'
  | 'SURFACE_HEALING_COMPLETED'
  | 'SURFACE_HEALING_FAILED'
  | 'SURFACE_HEALING_REVIEW_REQUIRED'
  | 'SURFACE_HEALING_ACCEPTED'
  | 'SURFACE_HEALING_REJECTED'
  | 'SURFACE_HEALING_INVALIDATED'
  | 'SURFACE_HEALING_ROLLED_BACK';

export interface SurfaceHealingEvent {
  eventId: string;
  type: SurfaceHealingEventType;
  featureId: string;
  timestamp: string;
  revision: number;
  inputHash: string;
  outputHash: string;
  repairStrategy: string;
  tolerance: number;
  deviation: number;
  evidenceReference: string;
  payload?: any;
}

export interface HealingResult {
  healingId: string;
  verdict: EngineeringVerdict;
  surface?: BRepNURBSSurface;
  surfaceData?: NURBSSurfaceData;
  defects: DefectReport[];
  appliedRepairs: string[];
  deviation: DeviationAnalysis;
  evidence: SurfaceHealingEvidence;
  confidence: HealingConfidence;
}
