import { Matrix } from "../core/MathUtils";

export type ContactFormulation = 'MASTER_SLAVE' | 'SYMMETRIC';
export type EnforcementMethod = 'PENALTY' | 'AUGMENTED_LAGRANGIAN' | 'LAGRANGE_MULTIPLIER';
export type NormalBehavior = 'FRICTIONLESS_UNILATERAL' | 'BILATERAL' | 'TIED';
export type TangentialBehavior = 'FRICTIONLESS' | 'FRICTIONAL_COULOMB' | 'TIED';

export type ContactStatus =
  | 'UNKNOWN'
  | 'OPEN'
  | 'NEAR_CONTACT'
  | 'CONTACTING'
  | 'ACTIVE'
  | 'SEPARATING'
  | 'SLIDING'
  | 'STICKING'
  | 'PENETRATING'
  | 'FAILED';

export type ContactStateMode =
  | 'OPEN'
  | 'CONTACT'
  | 'STICK'
  | 'SLIP'
  | 'SEPARATING'
  | 'PENETRATING';

export type ContactFailureType =
  | 'NONE'
  | 'CONTACT_GEOMETRY_FAILURE'
  | 'CONTACT_SEARCH_FAILURE'
  | 'PROJECTION_FAILURE'
  | 'INVALID_CONTACT_PAIR'
  | 'INVALID_PARAMETER'
  | 'PENETRATION_FAILURE'
  | 'COMPLEMENTARITY_FAILURE'
  | 'CONTACT_TANGENT_FAILURE'
  | 'CONTACT_CONVERGENCE_FAILURE'
  | 'CONTACT_ENERGY_FAILURE'
  | 'CONTACT_EQUILIBRIUM_FAILURE'
  | 'CONTACT_STATE_FAILURE'
  | 'FRICTION_FAILURE'
  | 'NUMERICAL_FAILURE';

export type ContactVerdict =
  | 'OPEN'
  | 'ACTIVE'
  | 'SEPARATED'
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'PENETRATION_FAILURE'
  | 'GEOMETRY_FAILURE'
  | 'NUMERICAL_FAILURE'
  | 'PHYSICS_FAILURE'
  | 'CONTACT_FAILURE'
  | 'VERIFIED';

export interface ContactParameters {
  penaltyStiffness: number;       // k_p > 0
  searchTolerance: number;        // Geometric distance search threshold
  penetrationTolerance: number;   // Max acceptable penetration |g_n|
  augmentationMaxIter?: number;   // Augmented Lagrangian iterations
  frictionCoefficient?: number;   // mu (0 for frictionless)
  pinningTolerance?: number;
  initialClearance?: number;
}

export interface ContactSurfaceData {
  surfaceId: string;
  bodyId: string;
  nodeIds?: string[];
  faceIds?: string[];
  elementIds?: string[];
  role: 'MASTER' | 'SLAVE' | 'NEUTRAL';
  normalConvention: 'OUTWARD' | 'INWARD';
}

export interface ContactPairData {
  pairId: string;
  slaveSurfaceId: string;
  masterSurfaceId: string;
  formulation: ContactFormulation;
  enforcement: EnforcementMethod;
  normalBehavior: NormalBehavior;
  tangentialBehavior: TangentialBehavior;
  parameters: ContactParameters;
}

export interface ClosestPointResult {
  sourcePointId: string;
  targetFacetId: string;
  sourceCoords: number[];
  targetCoords: number[];
  parametricCoords: number[];     // [xi, eta] or [xi]
  distance: number;               // Unsigned distance
  gap: number;                    // Signed gap g_n (g_n > 0 open, g_n < 0 penetration)
  normal: number[];               // Unit normal vector (master outward)
  projectionStatus: 'SUCCESS' | 'OUT_OF_BOUNDS' | 'DEGENERATE' | 'FAILED';
  residualNorm: number;
}

export interface ContactPointState {
  pointId: string;
  pairId: string;
  gap: number;
  normal: number[];
  tangent: number[];
  contactPressure: number;         // lambda_n >= 0
  tangentialTraction: number[];    // t_t
  penetration: number;            // max(0, -gap)
  status: ContactStatus;
  stateMode: ContactStateMode;
  lagrangeMultiplier: number;
  contactWork: number;
  iteration: number;
  step: number;
  relativeSlip?: number[];
  stateHash?: string;
}

export interface ContactTractionResult {
  normalPressure: number;
  tangentialTraction: number[];
  status: ContactStatus;
  stateMode: ContactStateMode;
  penetration: number;
  contactEnergyIncrement: number;
}

export interface ContactElementEvaluation {
  contactForce: number[];           // Global force vector contribution
  contactTangent: Matrix;           // Global tangent matrix contribution
  status: ContactStatus;
  stateMode: ContactStateMode;
  gap: number;
  normalPressure: number;
  penetration: number;
  tangentialTraction?: number[];
}

export interface ContactDiagnosticRecord {
  pairId: string;
  iteration: number;
  step: number;
  activeCount: number;
  stickCount: number;
  slipCount: number;
  maxPenetration: number;
  gapResidual: number;
  forceResidual: number;
  complementarityResidual: number;
  frictionResidual: number;
  searchCandidatesCount: number;
  narrowPhaseEvaluations: number;
  searchTimeMs: number;
}

export interface ContactConvergenceResult {
  converged: boolean;
  gapResidual: number;
  forceResidual: number;
  complementarityResidual: number;
  frictionResidual: number;
  maxPenetration: number;
  violations: string[];
}


export interface ContactAuditResult {
  isValid: boolean;
  maxComplementarityViolation: number;  // max(|g_n * lambda_n|)
  totalNormalForceSlave: number[];
  totalNormalForceMaster: number[];
  actionReactionError: number;          // |F_slave + F_master|
  pressureIntegralResultant: number;    // integral p dA
  nodalForceResultant: number;          // sum f_contact
  pressureIntegralError: number;
  totalContactWork: number;
  spuriousTangentialDissipation: number;
  errors: string[];
}
