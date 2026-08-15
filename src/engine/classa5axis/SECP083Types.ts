/**
 * PATCH-SECP-083: Advanced Class-A Surfacing & 5-Axis Simultaneous CAM Types
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface NurbsSurfacePatch {
  id: string;
  degreeU: number;
  degreeV: number;
  knotVectorU: number[];
  knotVectorV: number[];
  controlPoints: Vector3D[][]; // [U][V]
  weights?: number[][];        // [U][V]
}

export interface SurfaceDerivatives {
  point: Vector3D;
  dS_du: Vector3D;
  dS_dv: Vector3D;
  d2S_du2: Vector3D;
  d2S_dudv: Vector3D;
  d2S_dv2: Vector3D;
  normal: Vector3D;
}

export interface CurvatureMetrics {
  principalCurvature1: number; // k1
  principalCurvature2: number; // k2
  gaussianCurvature: number;   // K = k1 * k2
  meanCurvature: number;       // H = (k1 + k2) / 2
  minRadiusMm: number;
  isInflectionPoint: boolean;
}

export interface ContinuityTolerance {
  g0ToleranceMm: number;    // Position gap <= 0.001 mm
  g1ToleranceDeg: number;   // Tangent angle <= 0.1 deg
  g2ToleranceCurv: number;  // Curvature diff <= 0.01 mm^-1
  g3ToleranceDeriv: number; // Curvature derivative <= 0.001
}

export interface ContinuityEvaluationResult {
  patchAId: string;
  patchBId: string;
  isG0Satisfied: boolean;
  maxG0PositionErrorMm: number;
  isG1Satisfied: boolean;
  maxG1TangentErrorDeg: number;
  isG2Satisfied: boolean;
  maxG2CurvatureError: number;
  isG3Satisfied: boolean;
  maxG3DerivativeError: number;
  highestContinuityAchieved: 'G0' | 'G1' | 'G2' | 'G3' | 'DISCONTINUOUS';
}

export interface ZebraStripeAnalysisResult {
  stripeCount: number;
  reflectionSmoothness: number; // 0..1
  discontinuityCount: number;
  wavinessScore: number;
  isClassACompliant: boolean;
  defectLog: string[];
}

export interface TrimLoop {
  id: string;
  isOuterLoop: boolean;
  points2D: { u: number; v: number }[];
  isClosed: boolean;
  isSelfIntersecting: boolean;
  orientation: 'CW' | 'CCW';
}

export interface TrimmedSurfacePatch {
  id: string;
  baseSurface: NurbsSurfacePatch;
  trimLoops: TrimLoop[];
  isValidDomain: boolean;
}

export interface SurfaceIntersectionResult {
  surfaceAId: string;
  surfaceBId: string;
  intersectionCurves: Vector3D[][];
  maxPointResidualMm: number;
  isContinuous: boolean;
  hasSelfIntersection: boolean;
  passed: boolean;
}

export interface ToolAssembly {
  toolId: string;
  type: 'BALL_END' | 'FLAT_END' | 'TAPERED';
  diameterMm: number;
  cornerRadiusMm: number;
  fluteLengthMm: number;
  overallLengthMm: number;
  shankDiameterMm: number;
  holderDiameterMm: number;
  holderLengthMm: number;
  gaugeLengthMm: number;
}

export interface FiveAxisCutterPoint {
  pointIndex: number;
  position: Vector3D;
  toolVector: Vector3D; // (I, J, K) unit length
  feedRateMmMin: number;
  spindleRpm: number;
  moveType: 'RAPID' | 'APPROACH' | 'CUTTING' | 'RETRACT';
  leadAngleDeg: number;
  tiltAngleDeg: number;
  stepoverMm?: number;
  scallopHeightMm?: number;
}

export interface FiveAxisToolpath {
  toolpathId: string;
  tool: ToolAssembly;
  points: FiveAxisCutterPoint[];
  totalLengthMm: number;
  estimatedMachiningTimeSec: number;
  maxOrientationChangeDegPerMm: number;
}

export interface GougeAndCollisionReport {
  totalPointsChecked: number;
  gougeCount: number;
  holderCollisionCount: number;
  shankCollisionCount: number;
  fixtureCollisionCount: number;
  machineCollisionCount: number;
  excessiveEngagementCount: number;
  minimumClearanceMm: number;
  passed: boolean;
  details: string;
}

export interface MachineKinematicLimits {
  xMinMm: number; xMaxMm: number;
  yMinMm: number; yMaxMm: number;
  zMinMm: number; zMaxMm: number;
  aMinDeg: number; aMaxDeg: number;
  bMinDeg: number; bMaxDeg: number;
  cMinDeg: number; cMaxDeg: number;
  maxFeedMmMin: number;
  maxRotaryVelocityDegSec: number;
}

export interface KinematicFeasibilityReport {
  totalPointsChecked: number;
  axisLimitViolations: number;
  rotarySingularityCount: number;
  orientationFlipCount: number;
  maxAngularVelocityDegSec: number;
  passed: boolean;
  details: string;
}
