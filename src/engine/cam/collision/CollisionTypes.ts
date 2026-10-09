/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — CAM Collision Checking Engine Types & Contracts
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisMachineDefinition } from '../fiveaxis/FiveAxisTypes';

export type CollisionState = 
  | 'NOT_CHECKED'
  | 'CHECKING'
  | 'CLEAR'
  | 'WARNING'
  | 'COLLISION'
  | 'GOUGE'
  | 'INVALID';

export type CollisionType = 
  | 'TOOL_COLLISION'
  | 'HOLDER_COLLISION'
  | 'SPINDLE_COLLISION'
  | 'FIXTURE_COLLISION'
  | 'MACHINE_COLLISION'
  | 'GOUGE'
  | 'STOCK_CONTACT'
  | 'CLEARANCE_VIOLATION'
  | 'NO_COLLISION';

export type CollisionSeverity = 
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export type CollisionIncidentSeverity = CollisionSeverity | string;
export type CollisionIncidentType = CollisionType | string;
export type CollisionSeverityState = CollisionSeverity | string;

export type DetectionMode = 
  | 'EXACT'
  | 'TOLERANCE_BASED'
  | 'MESH_APPROXIMATION'
  | 'BOUNDS_ONLY';

export type CapabilityClassification = 
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'ABSENT';

export type CollisionGeometryType = 
  | 'TOOL_CUTTER'
  | 'TOOL_SHANK'
  | 'HOLDER'
  | 'SPINDLE'
  | 'PART_BREP'
  | 'STOCK'
  | 'FIXTURE'
  | 'MACHINE_COMPONENT';

export interface AABB3D {
  min: Vector3D;
  max: Vector3D;
}

export interface Triangle3D {
  id?: string;
  v0: Vector3D;
  v1: Vector3D;
  v2: Vector3D;
  normal: Vector3D;
  faceId?: string;
}

export interface CollisionMesh {
  id: string;
  name: string;
  triangles: Triangle3D[];
  aabb: AABB3D;
}

export interface ToolGeometry {
  toolId: string;
  toolType: 'ENDMILL' | 'BALL_ENDMILL' | 'BULLNOSE_TOROIDAL' | 'DRILL' | 'CHAMFER';
  cutterDiameterMm: number;
  cornerRadiusMm?: number;
  fluteLengthMm: number;
  shoulderLengthMm: number;
  shankDiameterMm: number;
  totalLengthMm: number;
  stickoutMm: number; // Active extension from holder
}

export interface HolderGeometry {
  holderId: string;
  holderType: 'CYLINDRICAL' | 'TAPERED' | 'STEPPED' | 'CUSTOM';
  gaugeLengthMm: number;
  lowerDiameterMm: number;
  upperDiameterMm: number;
  holderLowerDiameterMm?: number;
  holderUpperDiameterMm?: number;
  holderGaugeLengthMm?: number;
  coneAngleDeg?: number;
  collarDiameterMm: number;
  profileSteps?: { diameterMm: number; lengthMm: number }[];
  [key: string]: any;
}

export interface SpindleHeadGeometry {
  spindleId: string;
  outerDiameterMm: number;
  noseLengthMm: number;
  housingWidthMm: number;
  housingLengthMm: number;
  gaugePivotOffsetMm: Vector3D;
}

export interface FixtureGeometry {
  fixtureId: string;
  fixtureType: 'VISE_JAWS' | 'CHUCK' | 'CLAMP_STEP' | 'MODULAR_PLATE' | 'CUSTOM';
  name: string;
  aabb: AABB3D;
  mesh?: CollisionMesh;
  keepOutZoneMarginMm: number;
  isKeepOutZoneActive: boolean;
}

export interface ProtectedSurfaceDef {
  surfaceId: string;
  faceId: string;
  surfaceName: string;
  isMachinable: boolean;
  requiredClearanceMm: number;
  allowableOvercutMm: number; // Usually 0 or strictly negative
}

export interface ProtectedGeometryModel {
  partId: string;
  protectedSurfaces: ProtectedSurfaceDef[];
  globalPartAllowanceMm: number;
  defaultFinishToleranceMm: number;
}

export interface CollisionTolerance {
  geometryToleranceMm: number; // e.g. 0.005 mm
  contactToleranceMm: number;  // e.g. 0.010 mm
  numericalToleranceMm: number;// e.g. 1e-5 mm
  clearanceThresholdWarningMm: number; // e.g. 2.0 mm
  clearanceThresholdCriticalMm: number; // e.g. 0.5 mm
}

export interface CollisionPairRule {
  bodyA: CollisionGeometryType;
  bodyB: CollisionGeometryType;
  checkEnabled: boolean;
  allowCuttingContact: boolean;
  minClearanceMm: number;
}

export interface CollisionMatrixConfig {
  rules: CollisionPairRule[];
}

export interface ToolPose {
  tcp: Vector3D;
  toolOrientation: Vector3D; // Unit vector [I, J, K]
  spindleRpm?: number;
  feedMmMin?: number;
  motionType?: 'LINEAR' | 'RAPID' | 'ARC' | 'INDEXED_MOVE';
  machineAxes?: {
    X: number;
    Y: number;
    Z: number;
    A: number;
    B: number;
    C: number;
  };
}

export interface CollisionIncident {
  incidentId: string;
  segmentIndex: number;
  timestampSec?: number;
  normalizedPathTime: number; // 0.0 to 1.0
  type: CollisionType;
  severity: CollisionSeverity;
  state: CollisionState;
  detectionMode: DetectionMode;
  
  bodyA: CollisionGeometryType;
  bodyB: CollisionGeometryType;
  bodyAName: string;
  bodyBName: string;

  contactPointWCS: Vector3D;
  contactNormal: Vector3D;
  penetrationDepthMm: number;
  clearanceDistanceMm: number;
  requiredClearanceMm: number;

  toolPose: ToolPose;
  targetSurfaceId?: string;
  faceId?: string;
  
  description: string;
  correctiveRecommendation?: string;
}

export interface CollisionTimelineEntry {
  timeSec: number;
  normalizedTime: number;
  segmentIndex: number;
  state: CollisionState;
  type: CollisionType;
  severity: CollisionSeverity;
  clearanceMm: number;
  penetrationMm: number;
  message: string;
}

export interface CollisionReport {
  jobId: string;
  setupId: string;
  operationName: string;
  toolId: string;
  machineId?: string;
  overallState: CollisionState;
  isPathValid: boolean;
  isPathRejected: boolean;
  
  totalSegmentsChecked: number;
  totalIncidentsCount: number;
  toolCollisionCount: number;
  holderCollisionCount: number;
  spindleCollisionCount: number;
  fixtureCollisionCount: number;
  machineCollisionCount: number;
  gougeCount: number;
  clearanceViolationCount: number;
  
  minOverallClearanceMm: number;
  maxPenetrationDepthMm: number;

  incidents: CollisionIncident[];
  timeline: CollisionTimelineEntry[];
  detectionMode: DetectionMode;
  tolerances: CollisionTolerance;
  checkedBodies: CollisionGeometryType[];
  coverageStatus: CapabilityClassification;
}

export interface CollisionEvidencePackage {
  evidenceId: string;
  timestamp: string;
  partHash: string;
  bRepHash: string;
  toolHash: string;
  holderHash: string;
  fixtureHash: string;
  machineHash: string;
  toolpathHash: string;
  collisionModelHash: string;

  tolerances: CollisionTolerance;
  detectionMode: DetectionMode;
  overallState: CollisionState;
  gatePassed: boolean;
  classification: CapabilityClassification;
  
  minClearanceMm: number;
  maxPenetrationMm: number;
  incidentsCount: number;

  provenanceSignature: string;
  engineVersion: string;
}

export interface CollisionAvoidanceRecommendation {
  incidentId: string;
  segmentIndex: number;
  collisionType: CollisionType;
  severity: CollisionSeverity;
  primaryAction: 'EXTEND_TOOL_STICKOUT' | 'MODIFY_ORIENTATION' | 'RETRACT_CLEARANCE_PLANE' | 'SWITCH_IK_BRANCH' | 'REGENERATE_TOOLPATH';
  details: string;
  suggestedValue?: number; // e.g. recommended stickout length in mm or tilt angle
}

export type IndustrialOSEventType =
  | 'COLLISION_CHECK_STARTED'
  | 'COLLISION_MODEL_INITIALIZED'
  | 'BROAD_PHASE_STARTED'
  | 'BROAD_PHASE_COMPLETED'
  | 'NARROW_PHASE_STARTED'
  | 'NARROW_PHASE_COMPLETED'
  | 'TOOL_COLLISION_DETECTED'
  | 'HOLDER_COLLISION_DETECTED'
  | 'SPINDLE_COLLISION_DETECTED'
  | 'FIXTURE_COLLISION_DETECTED'
  | 'MACHINE_COLLISION_DETECTED'
  | 'GOUGE_DETECTED'
  | 'CLEARANCE_WARNING'
  | 'CLEARANCE_VIOLATION'
  | 'COLLISION_CHECK_COMPLETED'
  | 'COLLISION_PATH_REJECTED'
  | 'COLLISION_EVIDENCE_GENERATED';

export interface IndustrialOSEvent {
  eventId: string;
  eventType: IndustrialOSEventType;
  timestamp: string;
  details: Record<string, any>;
}

export interface BenchmarkCollisionCase {
  id: 'BENCHMARK_A' | 'BENCHMARK_B' | 'BENCHMARK_C' | 'BENCHMARK_D' | 'BENCHMARK_E' | 'BENCHMARK_F' | 'BENCHMARK_G';
  name: string;
  description: string;
  axisMode: '3_AXIS' | '4_AXIS' | '5_AXIS';
  expectedState: CollisionState;
  expectedCollisionType: CollisionType;
  tool: ToolGeometry;
  holder: HolderGeometry;
  fixture?: FixtureGeometry;
  protectedModel?: ProtectedGeometryModel;
  machine?: FiveAxisMachineDefinition;
  toolpathNodes: ToolPose[];
}
