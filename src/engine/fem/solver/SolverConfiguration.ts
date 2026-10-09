import { OrderingStrategy, SolverType } from './types';

export class SolverConfiguration {
  readonly solverType: SolverType;
  readonly residualTolerance: number;
  readonly constraintTolerance: number;
  readonly energyTolerance: number;
  readonly orderingStrategy: OrderingStrategy;
  readonly deterministicMode: boolean;
  readonly maxDOFs: number;
  readonly maxNNZ: number;

  constructor(options?: {
    solverType?: SolverType;
    residualTolerance?: number;
    constraintTolerance?: number;
    energyTolerance?: number;
    orderingStrategy?: OrderingStrategy;
    deterministicMode?: boolean;
    maxDOFs?: number;
    maxNNZ?: number;
  }) {
    this.solverType = options?.solverType ?? 'SPARSE_CHOLESKY';
    this.residualTolerance = options?.residualTolerance ?? 1e-8;
    this.constraintTolerance = options?.constraintTolerance ?? 1e-10;
    this.energyTolerance = options?.energyTolerance ?? 1e-6;
    this.orderingStrategy = options?.orderingStrategy ?? 'NATURAL';
    this.deterministicMode = options?.deterministicMode ?? true;
    this.maxDOFs = options?.maxDOFs ?? 100000;
    this.maxNNZ = options?.maxNNZ ?? 2000000;
  }

  static default(): SolverConfiguration {
    return new SolverConfiguration();
  }
}
