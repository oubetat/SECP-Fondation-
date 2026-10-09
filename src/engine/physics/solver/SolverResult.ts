/**
 * SECP Industrial OS v2 — Solver Result Contract
 * PATCH-048: Solver Contract
 */

import { ExecutionStatus } from "./SolverExecution";

export enum ConvergenceStatus {
  CONVERGED = "CONVERGED",
  NOT_CONVERGED = "NOT_CONVERGED",
  DIVERGED = "DIVERGED",
  STAGNATED = "STAGNATED",
  NOT_ASSESSED = "NOT_ASSESSED",
  INVALID = "INVALID"
}

export interface ResidualHistoryEntry {
  iteration: number;
  residual: number;
  field?: string;
}

export interface FieldOutput {
  unit: string;
  location: "NODE" | "ELEMENT" | "FACE" | "GLOBAL";
  data: unknown;
}

export interface SolverResultProvenance {
  solverId: string;
  solverVersion: string;
  timestamp: string;
  revision: string;
}

export interface SolverResult {
  resultId: string;
  executionId: string;
  solverId: string;
  solverVersion: string;
  status: ExecutionStatus;
  convergenceStatus: ConvergenceStatus;
  fields: Record<string, FieldOutput>;
  residualHistory?: ResidualHistoryEntry[];
  conservationDiagnostics?: Record<string, number>;
  numericalDiagnostics?: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  provenance: SolverResultProvenance;
  evidenceStatus: "VERIFIED" | "UNPROVEN" | "INVALID";
}
