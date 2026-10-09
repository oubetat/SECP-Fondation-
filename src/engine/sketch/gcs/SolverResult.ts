/**
 * SECP CAD Kernel — GCS Solver Result
 * Phase 2 (PATCH-025)
 */

import { SketchModel } from '../SketchModel';
import { DOFReport } from './DegreeOfFreedomAnalyzer';

export type SolverTerminationReason =
  | 'CONVERGED'
  | 'MAX_ITERATIONS'
  | 'SINGULAR_SYSTEM'
  | 'INCONSISTENT_CONSTRAINTS'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_CONSTRAINT'
  | 'NUMERICAL_FAILURE';

export type SolverStatus =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'OVER_CONSTRAINED'
  | 'INCONSISTENT'
  | 'INVALID'
  | 'UNSUPPORTED'
  | 'UNPROVEN';

export interface SolverDiagnostic {
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly code: string;
  readonly constraintId?: string;
  readonly message: string;
}

export interface SolverResult {
  readonly status: SolverStatus;
  readonly solvedSketch: SketchModel;
  readonly iterations: number;
  readonly initialResidualNorm: number;
  readonly finalResidualNorm: number;
  readonly maximumResidual: number;
  readonly residuals: readonly number[];
  readonly dof: DOFReport;
  readonly diagnostics: readonly SolverDiagnostic[];
  readonly terminationReason: SolverTerminationReason;
  readonly deterministicFingerprint?: string;
}
