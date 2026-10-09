import { SparseMatrix } from "../sparse/SparseMatrix";

export type SolverName = 
  | 'ConjugateGradient'
  | 'PreconditionedConjugateGradient'
  | 'GMRES'
  | 'SparseCholesky'
  | 'SparseLDLt'
  | 'SparseLU';

export type ConvergenceState = 
  | 'CONVERGING'
  | 'CONVERGED'
  | 'STAGNATED'
  | 'DIVERGING'
  | 'BREAKDOWN'
  | 'MAX_ITERATIONS_REACHED';

export interface IterationEntry {
  iteration: number;
  residualNorm: number;
  relativeResidual: number;
  stepNorm: number;
  convergenceState: ConvergenceState;
}

export interface SolverTolerance {
  atol: number; // Absolute tolerance (e.g. 1e-10)
  rtol: number; // Relative tolerance (e.g. 1e-8)
}

export interface SolverDiagnostics {
  isSymmetric: boolean;
  symmetryMaxDiff: number;
  isPositiveDefinite: boolean;
  isSingular: boolean;
  zeroPivotCount: number;
  conditionEstimate: number;
  matrixNorm: number;
  rhsNorm: number;
  fillInRatio?: number;
  factorNNZ?: number;
  originalNNZ?: number;
  breakdownOccurred: boolean;
  breakdownReason?: string;
}

export interface SolverValidationResult {
  isSymmetric: boolean;
  symmetryMaxDiff: number;
  isPositiveDefinite: boolean;
  isSingular: boolean;
  zeroPivots: number[];
  conditionEstimate: number;
  suitableSolvers: SolverName[];
  recommendedSolver: SolverName;
  failureReason?: string;
}

export interface LinearSolverResult {
  solution: Float64Array;
  converged: boolean;
  iterations: number;
  initialResidual: number;
  finalResidual: number;
  relativeResidual: number;
  absoluteResidual: number;
  tolerance: SolverTolerance;
  solverName: SolverName | string;
  executionTimeMs: number;
  failureReason?: string;
  diagnostics: SolverDiagnostics;
  convergenceHistory: IterationEntry[];
  memoryProfile?: {
    originalNNZ: number;
    factorNNZ?: number;
    fillInRatio?: number;
    memoryBytes: number;
  };
  reactions?: Array<{
    nodeId: number | string;
    Rx: number;
    Ry: number;
    Rz: number;
  }>;
}

export interface LinearSolverOptions {
  tolerance?: Partial<SolverTolerance>;
  maxIterations?: number;
  restartDimension?: number; // for GMRES(m)
  preconditionerType?: 'NONE' | 'JACOBI' | 'INCOMPLETE_CHOLESKY';
  verbose?: boolean;
}

export interface LinearSolver {
  readonly name: SolverName;
  solve(A: SparseMatrix, b: Float64Array, options?: LinearSolverOptions): LinearSolverResult;
  validateSystem(A: SparseMatrix, b: Float64Array): SolverValidationResult;
  getDiagnostics(): SolverDiagnostics | null;
  getConvergenceHistory(): IterationEntry[];
  getResidual(): number;
}
