export enum StructuralVerdict {
  VERIFIED = 'VERIFIED',
  NOT_VERIFIED = 'NOT_VERIFIED',
  PARTIALLY_VERIFIED = 'PARTIALLY_VERIFIED',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  EQUILIBRIUM_FAILURE = 'EQUILIBRIUM_FAILURE',
  REACTION_BALANCE_FAILURE = 'REACTION_BALANCE_FAILURE',
  BC_VERIFICATION_FAILURE = 'BC_VERIFICATION_FAILURE',
  LOAD_VERIFICATION_FAILURE = 'LOAD_VERIFICATION_FAILURE',
  STRESS_VERIFICATION_FAILURE = 'STRESS_VERIFICATION_FAILURE',
  STRAIN_VERIFICATION_FAILURE = 'STRAIN_VERIFICATION_FAILURE',
  ENERGY_VERIFICATION_FAILURE = 'ENERGY_VERIFICATION_FAILURE',
  RESIDUAL_FAILURE = 'RESIDUAL_FAILURE',
  MESH_VERIFICATION_FAILURE = 'MESH_VERIFICATION_FAILURE',
  MESH_CONVERGENCE_FAILURE = 'MESH_CONVERGENCE_FAILURE',
  REFERENCE_VALIDATION_FAILURE = 'REFERENCE_VALIDATION_FAILURE',
  MANUFACTURED_SOLUTION_FAILURE = 'MANUFACTURED_SOLUTION_FAILURE',
  INDEPENDENT_VERIFICATION_FAILURE = 'INDEPENDENT_VERIFICATION_FAILURE',
  PROVENANCE_FAILURE = 'PROVENANCE_FAILURE',
  DIMENSIONAL_INCONSISTENCY = 'DIMENSIONAL_INCONSISTENCY',
  INVALID_MODEL = 'INVALID_MODEL',
  NOT_SUPPORTED = 'NOT_SUPPORTED'
}

export enum VerificationStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  WARNING = 'WARNING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  INCONCLUSIVE = 'INCONCLUSIVE'
}

export enum AnalysisType {
  LINEAR_STATIC = 'LINEAR_STATIC',
  NONLINEAR_STATIC = 'NONLINEAR_STATIC',
  CONTACT = 'CONTACT',
  LARGE_DEFORMATION = 'LARGE_DEFORMATION',
  THERMAL = 'THERMAL',
  MODAL = 'MODAL',
  BUCKLING = 'BUCKLING',
  FATIGUE = 'FATIGUE'
}

export interface ResultProvenance {
  verificationId: string;
  analysisId: string;
  documentRevision?: number;
  manifestHash: string;
  modelHash: string;
  meshHash: string;
  materialHash: string;
  loadHash: string;
  boundaryConditionHash: string;
  solverHash: string;
  resultHash: string;
  analysisType: AnalysisType;
  timestamp: string;
}

export interface VerificationCheckResult {
  checkId: string;
  metric: string;
  measuredValue: number;
  expectedValue: number;
  tolerance: number;
  error: number;
  status: VerificationStatus;
  details?: string;
}

export interface VerificationTolerancePolicy {
  forceAbsTol: number;
  forceRelTol: number;
  momentAbsTol: number;
  energyRelTol: number;
  displacementRelTol: number;
  stressRelTol: number;
  residualAbsTol: number;
}

export interface StructuralVerificationEvidence {
  verificationId: string;
  analysisId: string;
  provenance: ResultProvenance;
  provenanceValid: boolean;
  forceBalanceError: number;
  momentBalanceError: number;
  reactionBalanceError: number;
  constraintResidualNorm: number;
  linearResidualNorm: number;
  energyError: number;
  stressRecoveryError: number;
  meshConvergenceError: number;
  analyticalReferenceError: number;
  manufacturedSolutionError: number;
  independentCheckSuccess: boolean;
  verdict: StructuralVerdict;
}

export interface HardAcceptanceGate087Check {
  id: string;
  description: string;
  passed: boolean;
  details?: string;
}

export interface HardAcceptanceGate087Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: HardAcceptanceGate087Check[];
  evidence?: StructuralVerificationEvidence;
  timestamp: string;
}
