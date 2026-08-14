/**
 * PATCH-SECP-049 — Manufacturing Intelligence & Process Semantics Contracts
 */

import { DesignIntent } from '../intent/DesignIntentTypes';

export enum ManufacturingFeatureType {
  HOLE = 'HOLE',
  POCKET = 'POCKET',
  SLOT = 'SLOT',
  BOSS = 'BOSS',
  FILLET = 'FILLET',
  CHAMFER = 'CHAMFER',
  THIN_WALL = 'THIN_WALL',
  PATTERN = 'PATTERN',
  TURNED_PROFILE = 'TURNED_PROFILE',
  THREAD = 'THREAD',
  UNDERCUT = 'UNDERCUT'
}

export enum ProcessType {
  MILLING_3AXIS = 'MILLING_3AXIS',
  MILLING_5AXIS = 'MILLING_5AXIS',
  TURNING = 'TURNING',
  DRILLING = 'DRILLING',
  GRINDING = 'GRINDING',
  SHEET_METAL_BENDING = 'SHEET_METAL_BENDING',
  ADDITIVE_SLS_SLM = 'ADDITIVE_SLS_SLM',
  CASTING_MOLDING = 'CASTING_MOLDING'
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface GeometricParams {
  depth?: number;
  diameter?: number;
  width?: number;
  length?: number;
  height?: number;
  cornerRadius?: number;
  wallThickness?: number;
  draftAngleDeg?: number;
  aspectRatio?: number;
  accessVector?: Vector3D;
  hasSharpInternalCorner?: boolean;
  isObstructed?: boolean;
}

export interface RecognizedManufacturingFeature {
  mfgFeatureId: string;
  type: ManufacturingFeatureType;
  sourceFeatureIds: string[];
  geometricParams: GeometricParams;
  confidence: number;
  suitableProcesses: ProcessType[];
  primaryAccessDirection: Vector3D;
}

export enum RuleSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

export interface ManufacturabilityRule {
  ruleId: string;
  name: string;
  processType: ProcessType;
  description: string;
  severity: RuleSeverity;
  evaluator: (
    mfgFeature: RecognizedManufacturingFeature,
    context?: any
  ) => ManufacturabilityViolation | null;
}

export interface ManufacturabilityViolation {
  ruleId: string;
  ruleName: string;
  mfgFeatureId: string;
  processType: ProcessType;
  severity: RuleSeverity;
  description: string;
  measuredValue: number;
  requiredValue: number;
  remediationSuggestion: string;
}

export interface ManufacturingOperation {
  operationId: string;
  processType: ProcessType;
  mfgFeatureId: string;
  toolType: string;
  toolDiameterMm: number;
  requiredReachMm: number;
  setupOrientation: Vector3D;
  estimatedTimeSec: number;
}

export interface ManufacturingProcessPlan {
  planId: string;
  targetProcess: ProcessType;
  operations: ManufacturingOperation[];
  setupDirections: Vector3D[];
  isFeasible: boolean;
  totalEstimatedTimeSec: number;
}

export interface ManufacturingIntent {
  intentId: string;
  sourceDesignIntentId: string;
  targetProcess: ProcessType;
  requiredToleranceMm: number;
  requiredSurfaceFinishRa: number;
  processConstraints: string[];
}

export interface MultiTierValidationResult {
  patch: 'SECP-049';
  timestamp: string;
  
  // Multi-tier validity spectrum
  geometricValidity: boolean;        // Tier 1: OCCT B-Rep Valid
  designIntentSatisfied: boolean;    // Tier 2: SECP-048 Intent Met
  manufacturabilityValid: boolean;   // Tier 3: SECP-049 Process Feasible

  overallStatus: 'PASS' | 'GEOMETRIC_FAIL' | 'INTENT_VIOLATED' | 'MANUFACTURABILITY_FAIL';
  
  recognizedFeatures: RecognizedManufacturingFeature[];
  violations: ManufacturabilityViolation[];
  processPlan: ManufacturingProcessPlan;
  mfgIntents: ManufacturingIntent[];
  provenanceHash: string;
}
