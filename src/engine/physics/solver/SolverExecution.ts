/**
 * SECP Industrial OS v2 — Solver Execution Contract
 * PATCH-048: Solver Contract
 */

import { NumericalConfiguration } from "./SolverTypes";

export type ExecutionStatus = 
  | "CREATED" 
  | "VALIDATING" 
  | "RUNNING" 
  | "COMPLETED" 
  | "FAILED" 
  | "CANCELLED" 
  | "INVALID";

export interface ExecutionClock {
  startTime: number;
  endTime?: number;
  timeUnit: string;
}

export interface SolverExecution {
  executionId: string;
  solverId: string;
  solverVersion: string;
  problemId: string;
  inputIdentity: string;
  meshIdentity?: string;
  materialIdentity?: string;
  boundaryConditionIdentity?: string;
  initialConditionIdentity?: string;
  executionClock: ExecutionClock;
  executionMode: "SYNC" | "ASYNC" | "BATCH";
  numericalConfiguration?: NumericalConfiguration;
  startedAt: string;
  completedAt?: string;
  status: ExecutionStatus;
  resultIdentity?: string;
}
