import { AssemblyComponentPose } from './AssemblyConstraintModel';

export type SolverConvergenceStatus =
  | 'CONVERGED'
  | 'CONVERGED_WITH_REMAINING_DOF'
  | 'NOT_CONVERGED'
  | 'SINGULAR'
  | 'DIVERGED'
  | 'CONFLICT'
  | 'REDUNDANT'
  | 'INVALID'
  | 'UNPROVEN';

export interface AssemblySolverConvergenceReport {
  iterations: number;
  initialResidual: number;
  finalResidual: number;
  maximumResidual: number;
  tolerance: number;
  conditionEstimate?: number;
  activeConstraints: string[];
  failedConstraints: string[];
}

export interface AssemblySolveResult {
  status: SolverConvergenceStatus;
  solvedPoses: Record<string, AssemblyComponentPose>;
  convergence: AssemblySolverConvergenceReport;
  residualDiagnostics: Array<{
    constraintId: string;
    residual: number;
    tolerance: number;
    satisfied: boolean;
    diagnostic?: string;
  }>;
  totalAssemblyDOF: number;
  solvedTimestamp: string;
}
