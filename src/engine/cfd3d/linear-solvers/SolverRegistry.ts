/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Solver Registry
 */

import { LinearSolver } from './LinearSolver';

export interface SolverCapabilities {
  readonly id: string;
  readonly version: string;
  readonly symmetricOnly: boolean;
  readonly supportsPreconditioning: boolean;
  readonly description: string;
}

export class SolverRegistry {
  private static instance: SolverRegistry | null = null;
  private readonly solvers = new Map<string, LinearSolver>();

  public static getInstance(): SolverRegistry {
    if (!SolverRegistry.instance) {
      SolverRegistry.instance = new SolverRegistry();
    }
    return SolverRegistry.instance;
  }

  public register(solver: LinearSolver): void {
    if (!solver || !solver.id) {
      throw new Error('Cannot register invalid or nameless LinearSolver');
    }
    if (this.solvers.has(solver.id)) {
      throw new Error(`Duplicate LinearSolver registration attempted for ID: ${solver.id}`);
    }
    this.solvers.set(solver.id, solver);
  }

  public get(id: string): LinearSolver {
    const solver = this.solvers.get(id);
    if (!solver) {
      throw new Error(`LinearSolver not registered in SolverRegistry: ${id}`);
    }
    return solver;
  }

  public list(): string[] {
    return Array.from(this.solvers.keys());
  }

  public capabilities(id: string): SolverCapabilities {
    const solver = this.get(id);
    const symmetricOnly = id.includes('conjugate-gradient');
    const supportsPreconditioning = id.includes('cg') || id.includes('bicgstab');
    
    return {
      id: solver.id,
      version: solver.version,
      symmetricOnly,
      supportsPreconditioning,
      description: `SECP Industrial OS v2 Linear Solver: ${solver.id} v${solver.version}`
    };
  }

  public clear(): void {
    this.solvers.clear();
  }
}
