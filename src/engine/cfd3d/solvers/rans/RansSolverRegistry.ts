/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Solver Registry
 */

import { RansSolver } from './RansSolver';

export class RansSolverRegistry {
  private static instance: RansSolverRegistry;
  private readonly solvers = new Map<string, typeof RansSolver>();

  private constructor() {
    this.solvers.set('v1.0.0-RANS-FOUNDATION', RansSolver);
  }

  public static getInstance(): RansSolverRegistry {
    if (!RansSolverRegistry.instance) {
      RansSolverRegistry.instance = new RansSolverRegistry();
    }
    return RansSolverRegistry.instance;
  }

  public getSolver(version: string): typeof RansSolver | undefined {
    return this.solvers.get(version);
  }
}
