/**
 * SECP Industrial OS v3 — Nonlinear Structural Solver Types (PATCH-238)
 *
 * Comprehensive domain interfaces for:
 * - Material Yield Criteria & Hardening Models
 * - Return Mapping Algorithms (J2, Tresca, Drucker-Prager, Mohr-Coulomb)
 * - Integration Point Material State & State Tracking (Trial, Committed, Rollback)
 * - Incremental-Iterative Newton-Raphson / Modified Newton Solvers
 * - Adaptive Load Stepping & Rollback Management
 * - Tangent Stiffness & Internal Force Assembly
 * - Multi-criterion Convergence Checkers
 * - Line Search & Arc-Length Control Infrastructure
 * - Diagnostics, Benchmarks, Evidence, and Gate 238 Verification
 */

export type YieldCriterionType = 'VON_MISES' | 'TRESCA' | 'DRUCKER_PRAGER' | 'MOHR_COULOMB';

export type HardeningModelType =
  | 'PERFECT_PLASTICITY'
  | 'ISOTROPIC_LINEAR'
  | 'KINEMATIC_LINEAR'
  | 'COMBINED';

export type NonlinearKinematicsMode =
  | 'SMALL_DISPLACEMENT'
  | 'TOTAL_LAGRANGIAN'
  | 'UPDATED_LAGRANGIAN';

export type NonlinearSolverType = 'FULL_NEWTON' | 'MODIFIED_NEWTON' | 'ARC_LENGTH';

export type ConvergenceStatus = 'CONVERGED' | 'NOT_CONVERGED' | 'DIVERGING';

/**
 * State Variables at an Integration Point
 */
export interface MaterialPointState {
  integrationPointId: string;
  elementId: string;
  gaussPointIndex: number;
  strainVoigt: number[];              // Total strain [e11, e22, e33, g23, g13, g12]
  stressVoigt: number[];              // Stress tensor [s11, s22, s33, s23, s13, s12]
  plasticStrainVoigt: number[];       // Plastic strain tensor
  equivalentPlasticStrain: number;   // \bar{\varepsilon}_p
  backStressVoigt: number[];          // Back stress tensor \alpha (kinematic hardening)
  yieldState: 'ELASTIC' | 'PLASTIC' | 'TRANSITION';
  hardeningState: number;            // Current yield stress \sigma_y(\bar{\varepsilon}_p)
  plasticDissipation: number;        // Dissipated plastic work density
  historyVariables: Record<string, number>;
}

/**
 * Collection of states across all integration points in the domain
 */
export interface DomainMaterialStates {
  pointStates: Map<string, MaterialPointState>; // pointKey -> MaterialPointState
  maxEquivalentPlasticStrain: number;
  yieldedPointCount: number;
  totalPlasticDissipation: number;
}

/**
 * Options for Material Return Mapping Integration
 */
export interface ReturnMappingOptions {
  yieldCriterion: YieldCriterionType;
  hardeningModel: HardeningModelType;
  youngsModulus: number;               // E
  poissonsRatio: number;               // \nu
  initialYieldStress: number;          // \sigma_y0
  isotropicHardeningModulus: number;   // H_iso
  kinematicHardeningModulus: number;   // H_kin
  frictionAngleDegrees?: number;       // For Drucker-Prager / Mohr-Coulomb
  cohesion?: number;                   // For Drucker-Prager / Mohr-Coulomb
  dilatancyAngleDegrees?: number;
  tolerance: number;                   // Yield tolerance
  maxLocalIterations: number;
}

/**
 * Result of local return mapping algorithm at an integration point
 */
export interface ReturnMappingOutput {
  stressVoigt: number[];
  plasticStrainVoigt: number[];
  equivalentPlasticStrain: number;
  backStressVoigt: number[];
  yieldState: 'ELASTIC' | 'PLASTIC';
  currentYieldStress: number;
  plasticMultiplier: number;           // \Delta \gamma
  consistentTangent6x6: number[][];    // Algorithmic tangent D^{ep}
  isYielding: boolean;
  plasticDissipationIncrement: number;
}

/**
 * Load Step Controller Settings
 */
export interface LoadStepSettings {
  numLoadSteps: number;
  initialIncrement: number;            // \Delta \lambda_0
  minIncrement: number;                // \Delta \lambda_{min}
  maxIncrement: number;                // \Delta \lambda_{max}
  maxStepRetries: number;
  adaptiveSteppingEnabled: boolean;
  targetNewtonIterations: number;
}

/**
 * Convergence Tolerance Settings
 */
export interface NonlinearConvergenceTolerances {
  forceTolerance: number;              // \varepsilon_F
  displacementTolerance: number;       // \varepsilon_U
  energyTolerance: number;             // \varepsilon_E
  maxIterationsPerStep: number;
}

/**
 * Single Newton-Raphson Iteration Diagnostic
 */
export interface NonlinearIterationDiagnostic {
  loadStep: number;
  iteration: number;
  loadFactor: number;                  // \lambda
  forceResidualNorm: number;          // ||R||
  relativeForceResidual: number;      // ||R|| / ||F_ext||
  displacementIncrementNorm: number;  // ||\Delta u||
  relativeDisplacementNorm: number;   // ||\Delta u|| / ||u||
  energyNorm: number;                 // |\Delta u^T R|
  tangentMatrixNNZ: number;           // Number of non-zeros in K_t
  linearSolverSelected: string;       // e.g., 'SparseCholesky', 'PCG', 'GMRES'
  linearSolverIterations: number;     // Linear solver iterations
  materialYieldingCount: number;     // Number of yielded integration points
  maxDisplacement: number;            // max |u|
  maxVonMisesStress: number;          // max \sigma_{eq}
  lineSearchStepAlpha: number;        // \eta line search parameter
  isConverged: boolean;
  statusMessage: string;
}

/**
 * Result of one load step execution
 */
export interface LoadStepResult {
  stepIndex: number;
  loadFactor: number;
  deltaLoadFactor: number;
  converged: boolean;
  iterationsCount: number;
  displacements: number[];
  reactionForces: number[];
  internalForces: number[];
  maxVonMisesStress: number;
  maxEquivalentPlasticStrain: number;
  yieldedPointCount: number;
  strainEnergy: number;
  plasticDissipation: number;
  diagnostics: NonlinearIterationDiagnostic[];
  retryCount: number;
  rollbackOccurred: boolean;
}

/**
 * Full Analysis Execution Result
 */
export interface NonlinearAnalysisResult {
  problemName: string;
  success: boolean;
  statusMessage: string;
  solverType: NonlinearSolverType;
  kinematicsMode: NonlinearKinematicsMode;
  totalLoadSteps: number;
  finalLoadFactor: number;
  totalNewtonIterations: number;
  totalLinearSolverIterations: number;
  finalDisplacements: number[];
  finalReactionForces: number[];
  finalMaxVonMisesStress: number;
  finalMaxEquivalentPlasticStrain: number;
  finalYieldedPointCount: number;
  loadStepResults: LoadStepResult[];
  loadDisplacementCurve: { loadFactor: number; displacement: number; reaction: number; maxPlasticStrain: number }[];
  totalRuntimeMs: number;
  cryptographicSignature: string;
}

/**
 * Evidence Package for Cryptographic Attestation
 */
export interface NonlinearEvidencePackage {
  patchId: string;
  problemDefinitionHash: string;
  meshHash: string;
  materialHash: string;
  loadHash: string;
  boundaryConditionHash: string;
  solverConfiguration: {
    solverType: NonlinearSolverType;
    kinematicsMode: NonlinearKinematicsMode;
    yieldCriterion: YieldCriterionType;
    hardeningModel: HardeningModelType;
    linearSolverUsed: string;
  };
  loadStepHistory: {
    stepIndex: number;
    loadFactor: number;
    converged: boolean;
    iterations: number;
    maxStress: number;
    maxPlasticStrain: number;
  }[];
  iterationHistorySummary: {
    totalNewtonIterations: number;
    avgNewtonIterationsPerStep: number;
    totalLinearIterations: number;
    rollbacksCount: number;
  };
  tangentStiffnessStatistics: {
    matrixDimension: number;
    nnzAverage: number;
    tangentUpdateOccurred: boolean;
    maxConditionNumberEstimate: number;
  };
  materialStateChanges: {
    initialYieldLoadFactor: number;
    finalYieldedPercentage: number;
    totalPlasticWorkDissipated: number;
  };
  convergenceStatus: 'CONVERGED' | 'NON_CONVERGED' | 'FAILED';
  finalResultSummary: {
    maxDisplacement: number;
    maxReactionForce: number;
    maxVonMises: number;
    maxPlasticStrain: number;
    equilibriumResidualNorm: number;
  };
  evidenceHash: string;
  generatedAt: string;
}

/**
 * Acceptance Gate 238 Result Interface
 */
export interface Gate238TestResult {
  testId: string;
  name: string;
  passed: boolean;
  verdict: 'PROVEN' | 'FAIL';
  details: string;
  metrics: Record<string, number | string | boolean>;
}

export interface HardGate238Result {
  patchId: 'PATCH-238';
  gateName: 'Nonlinear Structural Analysis Acceptance Gate';
  overallVerdict: 'PROVEN' | 'FAIL';
  totalTests: number;
  passedCount: number;
  failedCount: number;
  testResults: Gate238TestResult[];
  evidencePackage: NonlinearEvidencePackage;
  timestamp: string;
}
