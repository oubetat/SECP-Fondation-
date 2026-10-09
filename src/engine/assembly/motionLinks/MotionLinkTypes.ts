/**
 * PATCH-SECP-228 — Motion Links Engineering Types
 * 
 * Formal definitions for physical multi-body kinematic Motion Links:
 *  - 10 Motion Link Types (Gear Ratio, Belt/Pulley, Rack & Pinion, Screw/Nut,
 *    Linear Coupling, Angular Coupling, Cam/Follower, Crank/Slider,
 *    Differential Motion, Custom Parametric Function)
 *  - Driver / Follower formal role assignment
 *  - Direction, Ratio, Transfer Functions, Offsets, Phase
 *  - Kinematic Limits (Position, Velocity, Acceleration, Jerk)
 *  - Geometric Compatibility & Center Distance Validation
 *  - Dependency Graph Nodes & Edges (Topological Sorting, Cycle Detection)
 *  - Multi-Driver Conflict Resolution & Over-constraint Diagnostics
 *  - Units & Dimension Enforcement
 *  - Dynamic Clearance Envelope & Continuous Collision Detection
 *  - PLM / Provenance, Revisions, Cascading Invalidation (PATCH-190 integration)
 *  - Determinism & Cryptographic Evidence Ledger
 */

import { Vector3D } from '../../cadKernel';
import { MechanicalJoint, ComponentKinematicState } from '../joints/MechanicalJointTypes';

export type MotionLinkType =
  | 'GEAR'
  | 'GEAR_RATIO'
  | 'BELT_PULLEY'
  | 'RACK_PINION'
  | 'SCREW_NUT'
  | 'LINEAR_COUPLING'
  | 'ANGULAR_COUPLING'
  | 'CAM_FOLLOWER'
  | 'CRANK_SLIDER'
  | 'DIFFERENTIAL_MOTION'
  | 'CUSTOM_PARAMETRIC';

export type MotionLinkStateStatus =
  | 'VALID'
  | 'LIMIT_VIOLATION'
  | 'CONFLICT'
  | 'GEOMETRY_MISMATCH'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALIDATED'
  | 'SOLVER_DIVERGENCE';

export type MotionDirection = 'SAME' | 'OPPOSITE' | 'USER_DEFINED';

export type MotionUnit =
  | 'DEG'
  | 'RAD'
  | 'MM'
  | 'M'
  | 'RPM'
  | 'RAD_PER_SEC'
  | 'DEG_PER_SEC'
  | 'MM_PER_SEC'
  | 'M_PER_SEC'
  | 'DEG_PER_SEC2'
  | 'RAD_PER_SEC2'
  | 'MM_PER_SEC2'
  | 'NEWTON'
  | 'NEWTON_METER';

export type BeltType = 'OPEN' | 'CROSSED' | 'TIMING_TOOTHED' | 'V_BELT' | 'FLAT_BELT';

export type CamMotionLaw =
  | 'SIMPLE_HARMONIC'
  | 'CYCLOIDAL'
  | 'MODIFIED_TRAPEZOIDAL'
  | 'POLYNOMIAL_345'
  | 'POLYNOMIAL_4567'
  | 'UNIFORM_VELOCITY';

export type CamFollowerType = 'TRANSLATING_ROLLER' | 'TRANSLATING_FLAT_FACED' | 'OSCILLATING_ROLLER' | 'KNIFE_EDGE';

/**
 * Kinematic Limits for a Motion Link
 */
export interface MotionLinkLimits {
  enabled: boolean;
  minFollowerPosition?: number;       // deg or mm
  maxFollowerPosition?: number;       // deg or mm
  maxFollowerVelocity?: number;       // deg/s, rpm, or mm/s
  maxFollowerAcceleration?: number;   // deg/s^2, rad/s^2, or mm/s^2
  maxFollowerJerk?: number;           // deg/s^3 or mm/s^3
}

/**
 * Gear Pair Specification
 */
export interface GearLinkParameters {
  teethDriver: number;              // N1 (e.g. 20)
  teethFollower: number;            // N2 (e.g. 40)
  pitchDiameterDriverMm: number;    // d1
  pitchDiameterFollowerMm: number;  // d2
  moduleMm: number;                 // m
  pressureAngleDeg: number;         // 20 deg
  helixAngleDeg?: number;           // 0 for spur
  centerDistanceMm: number;         // Nominal C = (d1 + d2) / 2
  allowedCenterDistanceToleranceMm: number; // e.g. 0.5mm
  isInternalMesh?: boolean;         // true for planetary ring gear
}

/**
 * Belt and Pulley Specification
 */
export interface BeltPulleyParameters {
  pulleyDiameterDriverMm: number;    // D1
  pulleyDiameterFollowerMm: number;  // D2
  beltType: BeltType;                // Open or Crossed
  centerDistanceMm: number;          // C
  calculatedBeltLengthMm: number;    // L
  minCenterDistanceMm: number;
  maxCenterDistanceMm: number;
}

/**
 * Rack and Pinion Specification
 */
export interface RackPinionParameters {
  pinionPitchRadiusMm: number;       // r (mm)
  moduleMm: number;                  // m
  pressureAngleDeg: number;          // 20 deg
  rackAxis: Vector3D;                // Translation vector (e.g. [1,0,0])
  linearDisplacementPerRevMm: number;// 2 * pi * r
}

/**
 * Screw and Nut Specification
 */
export interface ScrewNutParameters {
  pitchMm: number;                   // Pitch P (mm)
  leadMm: number;                    // Lead L = nStarts * P (mm)
  numStarts: number;                 // 1, 2, 4...
  hand: 'RIGHT_HAND' | 'LEFT_HAND';  // Direction
  meanDiameterMm: number;            // dm
}

/**
 * Cam and Follower Specification
 */
export interface CamFollowerParameters {
  baseRadiusMm: number;              // r0 (e.g. 30mm)
  rollerRadiusMm?: number;           // rr (e.g. 8mm)
  totalLiftMm: number;               // h (e.g. 20mm)
  motionLaw: CamMotionLaw;           // Harmonic, Cycloidal, etc.
  followerType: CamFollowerType;     // Translating roller, etc.
  followerOffsetMm?: number;         // Eccentricity e
  dwellAngle1Deg: number;            // e.g. 60 deg dwell
  riseAngleDeg: number;              // e.g. 120 deg rise
  dwellAngle2Deg: number;            // e.g. 60 deg top dwell
  returnAngleDeg: number;            // e.g. 120 deg return
}

/**
 * Crank and Slider Specification
 */
export interface CrankSliderParameters {
  crankRadiusMm: number;             // r (e.g. 50mm)
  connectingRodLengthMm: number;     // l (e.g. 150mm)
  eccentricityOffsetMm: number;      // e (e.g. 0mm for inline)
  sliderAxis: Vector3D;              // e.g. [1,0,0]
  fullStrokeMm: number;              // 2 * r
}

/**
 * Differential Motion Specification (2 inputs -> 1 output)
 */
export interface DifferentialParameters {
  secondaryDriverComponentId: string;
  secondaryDriverJointId: string;
  ratioDriver1: number;              // a (e.g. 0.5)
  ratioDriver2: number;              // b (e.g. 0.5)
}

/**
 * Parametric Transfer Function
 */
export interface CustomParametricParameters {
  expressionString: string;          // e.g. "2.5 * x + 0.1 * x^2"
  coefficients: number[];            // [c0, c1, c2, c3]
  domainMin: number;
  domainMax: number;
  inputUnit: MotionUnit;
  outputUnit: MotionUnit;
}

/**
 * Complete Engineering Motion Link Object
 */
export interface MotionLink {
  id: string;
  name: string;
  type: MotionLinkType;
  description?: string;

  // Connected Mechanical Hierarchy
  driverComponentId: string;
  followerComponentId: string;
  driverJointId: string;
  followerJointId: string;
  
  // Specific DOF identifiers on joints (e.g. "ROTATION_Z", "TRANSLATION_X")
  driverDofName: string;
  followerDofName: string;

  // Mathematical Parameters
  ratio: number;                     // Scalar ratio (e.g. -0.5 for 20T:40T gear)
  direction: MotionDirection;        // SAME or OPPOSITE
  offset: number;                    // Zero offset / Phase (mm or deg)
  
  // Specific Type Parameters
  gearParams?: GearLinkParameters;
  beltParams?: BeltPulleyParameters;
  rackPinionParams?: RackPinionParameters;
  screwNutParams?: ScrewNutParameters;
  camParams?: CamFollowerParameters;
  crankSliderParams?: CrankSliderParameters;
  differentialParams?: DifferentialParameters;
  customParams?: CustomParametricParameters;

  // Limits
  limits?: MotionLinkLimits;

  // Operational State & Diagnostics
  state: MotionLinkStateStatus;
  diagnosticMessage?: string;
  isSuppressed: boolean;

  // Instantaneous Kinematic Output on Follower
  evaluatedPosition: number;
  evaluatedVelocity: number;
  evaluatedAcceleration: number;

  // PLM / Provenance (PATCH-190 Integration)
  revision: number;
  driverRevision: number;
  followerRevision: number;
  driverJointRevision: number;
  followerJointRevision: number;
  solverVersion: string;
  createdAt: string;
  modifiedAt: string;
  evidenceHash: string;
}

/**
 * Motion Graph Topology Node & Edge
 */
export interface MotionGraphNode {
  componentId: string;
  componentName: string;
  isGrounded: boolean;
  drivenByLinkId?: string;
  drivesLinkIds: string[];
}

export interface MotionGraphEdge {
  linkId: string;
  sourceComponentId: string;
  targetComponentId: string;
  ratio: number;
  linkType: MotionLinkType;
  isValid: boolean;
}

export interface MotionDependencyGraph {
  nodes: Map<string, MotionGraphNode>;
  edges: MotionGraphEdge[];
  topologicalOrder: string[]; // Component IDs in execution order
  hasCircularDependency: boolean;
  circularPath?: string[];
  conflictingDofs: { dofId: string; driverLinkIds: string[] }[];
  overallTransmissionRatio: number;
}

/**
 * Dynamic Clearance & Collision Record during Motion Trajectory
 */
export interface MotionCollisionRecord {
  timeSeconds: number;
  componentAId: string;
  componentBId: string;
  componentAName: string;
  componentBName: string;
  minimumDistanceMm: number;
  isColliding: boolean;
  penetrationDepthMm: number;
  triggeringMotionLinkId?: string;
}

export interface MotionClearanceEnvelope {
  overallMinDistanceMm: number;
  timeOfMinDistanceSec: number;
  criticalPair: [string, string];
  hasClash: boolean;
  trajectoryPoints: { timeSec: number; minDistanceMm: number }[];
  collisionEvents: MotionCollisionRecord[];
}

/**
 * Motion Timeline State
 */
export interface MotionTimelineState {
  currentTimeSeconds: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  stepSeconds: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5x, 1.0x, 2.0x
  totalSteps: number;
  currentStepIndex: number;
}

/**
 * Benchmark Mechanism Identification
 */
export type BenchmarkMechanismId =
  | 'BENCH_GEAR_PAIR'
  | 'BENCH_GEAR_TRAIN_3STAGE'
  | 'BENCH_BELT_PULLEY_OPEN'
  | 'BENCH_BELT_PULLEY_CROSSED'
  | 'BENCH_RACK_PINION'
  | 'BENCH_LEAD_SCREW'
  | 'BENCH_CRANK_SLIDER'
  | 'BENCH_CAM_FOLLOWER'
  | 'BENCH_DIFFERENTIAL'
  | 'BENCH_MULTI_LINK_COMPOUND';
