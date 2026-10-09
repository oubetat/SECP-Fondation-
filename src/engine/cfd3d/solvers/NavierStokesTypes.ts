/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-243 — Navier-Stokes Solver Types
 */

import { Vector3 } from '../mesh/CfdGeneralMeshTypes';

export interface NavierStokesIterationResult {
  iteration: number;
  residuals: {
    u: number;
    v: number;
    w: number;
    p: number;
    continuity: number;
  };
  maxVelocityChange: number;
  converged: boolean;
  diverged: boolean;
}

export interface NavierStokesConfig {
  density: number;
  viscosity: number;
  maxIterations: number;
  convergenceThreshold: number;
  underRelaxationU: number;
  underRelaxationP: number;
  gravity?: Vector3;
}

export enum SolverStatus {
  INITIALIZING = 'INITIALIZING',
  ITERATING = 'ITERATING',
  CONVERGED = 'CONVERGED',
  DIVERGED = 'DIVERGED',
  FAILED = 'FAILED'
}
