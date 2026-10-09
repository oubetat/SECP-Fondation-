/**
 * SECP CAD Kernel — Topology Healing Contract Types
 * Phase 2 (PATCH-020)
 */

export type HealingStatus =
  | 'UNCHANGED_VALID'
  | 'REPAIRED_VALID'
  | 'PARTIALLY_REPAIRED'
  | 'REPAIR_FAILED'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED'
  | 'UNPROVEN';

export type HealingSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type HealingRepairability = 'SAFE' | 'CONDITIONAL' | 'UNSAFE' | 'UNSUPPORTED';

export type HealingDefectType =
  // VERTEX DEFECTS
  | 'DUPLICATE_VERTEX'
  | 'NEAR_DUPLICATE_VERTEX'
  | 'ORPHAN_VERTEX'
  | 'INVALID_VERTEX_REFERENCE'

  // EDGE DEFECTS
  | 'ZERO_LENGTH_EDGE'
  | 'INVALID_EDGE_CURVE'
  | 'EDGE_ENDPOINT_MISMATCH'
  | 'DUPLICATE_EDGE'
  | 'ORPHAN_EDGE'
  | 'PARAMETER_DOMAIN_ERROR'

  // WIRE DEFECTS
  | 'OPEN_WIRE'
  | 'SELF_INTERSECTING_WIRE'
  | 'DUPLICATE_WIRE_EDGE'
  | 'INVALID_EDGE_ORDER'
  | 'GAP_IN_WIRE'
  | 'GAP_EXCEEDS_TOLERANCE'

  // FACE DEFECTS
  | 'INVALID_FACE_BOUNDARY'
  | 'FACE_GAP'
  | 'FACE_OVERLAP'
  | 'DEGENERATE_FACE'
  | 'INVALID_PCURVE'
  | 'SURFACE_PARAMETER_ERROR'
  | 'SELF_INTERSECTING_FACE'

  // SHELL DEFECTS
  | 'OPEN_SHELL'
  | 'NON_MANIFOLD_SHELL'
  | 'DUPLICATE_FACE'
  | 'FACE_ORIENTATION_CONFLICT'
  | 'FREE_EDGE'
  | 'INVALID_ADJACENCY'

  // SOLID DEFECTS
  | 'OPEN_SOLID'
  | 'INVALID_SHELL_ORIENTATION'
  | 'MULTIPLE_EXTERNAL_SHELLS'
  | 'INVALID_CONTAINMENT'
  | 'SELF_INTERSECTION'

  // GEOMETRIC DEFECTS
  | 'GEOMETRY_TOPOLOGY_MISMATCH'
  | 'TOLERANCE_VIOLATION'
  | 'CURVE_SURFACE_MISMATCH'
  | 'PARAMETRIC_INCONSISTENCY';

export interface HealingDefect {
  defectId: string;
  defectType: HealingDefectType;
  severity: HealingSeverity;
  entityIds: string[];
  measuredValue?: number;
  allowedTolerance?: number;
  description: string;
  repairability: HealingRepairability;
}

export interface HealingRepair {
  repairId: string;
  defectId: string;
  action: string;
  targetEntityIds: string[];
  sourceEntityIds?: string[];
  parameters?: Record<string, any>;
  distance?: number;
  tolerance?: number;
  justification: string;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';
}

export interface HealingRepairRejection {
  repairId: string;
  defectId: string;
  action: string;
  targetEntityIds: string[];
  reason: string;
  classification: 'UNSAFE' | 'EXCEEDS_TOLERANCE' | 'TOPOLOGY_DEGRADATION' | 'UNSUPPORTED';
}

export interface HealingValidationResult {
  isValid: boolean;
  remainingDefects: HealingDefect[];
  brepValidationStatus: 'VALID' | 'INVALID' | 'UNCHECKED';
  geometryPreserved: boolean;
  topologyPreserved: boolean;
  details: string;
}

export interface TolerancePolicyReference {
  policyName: string;
  linearTolerance: number;
  angularTolerance: number;
  coincidentalTolerance: number;
  model: string;
}

export interface HealingProvenance {
  origin: 'IMPORTED' | 'KERNEL_GENERATED' | 'BOOLEAN_OUTPUT' | 'UNKNOWN';
  parentShapeId: string;
  healingEngineVersion: string;
  timestamp: string;
  historyChainHash?: string;
}

export interface BeforeAfterComparison {
  before: {
    topologyHash: string;
    geometryHash: string;
    entityCounts: Record<string, number>;
    defectCount: number;
    validationStatus: string;
  };
  after: {
    topologyHash: string;
    geometryHash: string;
    entityCounts: Record<string, number>;
    defectCount: number;
    validationStatus: string;
  };
  changes: {
    entitiesModified: string[];
    entitiesAdded: string[];
    entitiesRemoved: string[];
    justificationSummary: string[];
  };
}

export interface HealingResult {
  inputShapeId: string;
  outputShapeId?: string;
  status: HealingStatus;
  defectsDetected: HealingDefect[];
  repairsApplied: HealingRepair[];
  repairsRejected: HealingRepairRejection[];
  validation: HealingValidationResult;
  tolerancePolicy: TolerancePolicyReference;
  provenance: HealingProvenance;
  beforeAfterComparison?: BeforeAfterComparison;
  determinismHash: string;
}

export interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  details: string;
  evidenceId?: string;
}

export interface HardAcceptanceGate020Report {
  gateId: 'HAG-020';
  patchId: 'PATCH-020';
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  checks: GateCheck[];
  defectsDetected: number;
  repairsApplied: number;
  repairsRejected: number;
  validation: HealingValidationResult;
  beforeAfterComparison?: BeforeAfterComparison;
  determinismHash: string;
  evidenceIds: string[];
  failures: string[];
  unproven: string[];
  timestamp: string;
}
