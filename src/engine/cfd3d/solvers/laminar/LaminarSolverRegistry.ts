/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Registry
 */

import { LaminarSolver } from './LaminarSolver';

export class LaminarSolverRegistry {
  private static instance: LaminarSolverRegistry;
  private readonly solvers = new Map<string, typeof LaminarSolver>();

  private constructor() {
    this.solvers.set('v1.0.0-laminar', LaminarSolver);
  }

  public static getInstance(): LaminarSolverRegistry {
    if (!LaminarSolverRegistry.instance) {
      LaminarSolverRegistry.instance = new LaminarSolverRegistry();
    }
    return LaminarSolverRegistry.instance;
  }

  public getSolver(version: string): typeof LaminarSolver | undefined {
    return this.solvers.get(version);
  }
}
