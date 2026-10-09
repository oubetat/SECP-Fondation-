import { PerformanceStats } from './types';

export class SolverMonitor {
  private assemblyTimeMs: number = 0;
  private factorizationTimeMs: number = 0;
  private solveTimeMs: number = 0;
  private recoveryTimeMs: number = 0;
  private verificationTimeMs: number = 0;
  private totalTimeMs: number = 0;

  private matrixMemoryBytes: number = 0;
  private factorizationMemoryBytes: number = 0;
  private solutionMemoryBytes: number = 0;
  private originalNNZ: number = 0;
  private factorNNZ: number = 0;

  recordAssembly(timeMs: number, nnz: number, matrixBytes: number): void {
    this.assemblyTimeMs = timeMs;
    this.originalNNZ = nnz;
    this.matrixMemoryBytes = matrixBytes;
  }

  recordFactorization(timeMs: number, factorNNZ: number, factorBytes: number): void {
    this.factorizationTimeMs = timeMs;
    this.factorNNZ = factorNNZ;
    this.factorizationMemoryBytes = factorBytes;
  }

  recordSolve(timeMs: number, totalDOFs: number): void {
    this.solveTimeMs = timeMs;
    this.solutionMemoryBytes = totalDOFs * 8 * 2; // displacement + reaction vectors
  }

  recordRecovery(timeMs: number): void {
    this.recoveryTimeMs = timeMs;
  }

  recordVerification(timeMs: number): void {
    this.verificationTimeMs = timeMs;
  }

  recordTotal(timeMs: number): void {
    this.totalTimeMs = timeMs;
  }

  getStats(): PerformanceStats {
    const fillInRatio = this.originalNNZ > 0 ? this.factorNNZ / this.originalNNZ : 1.0;
    const peakMemoryBytes = this.matrixMemoryBytes + this.factorizationMemoryBytes + this.solutionMemoryBytes;

    return {
      assemblyTimeMs: this.assemblyTimeMs,
      factorizationTimeMs: this.factorizationTimeMs,
      solveTimeMs: this.solveTimeMs,
      recoveryTimeMs: this.recoveryTimeMs,
      verificationTimeMs: this.verificationTimeMs,
      totalTimeMs: this.totalTimeMs,
      matrixMemoryBytes: this.matrixMemoryBytes,
      factorizationMemoryBytes: this.factorizationMemoryBytes,
      solutionMemoryBytes: this.solutionMemoryBytes,
      peakMemoryBytes,
      originalNNZ: this.originalNNZ,
      factorNNZ: this.factorNNZ,
      fillInRatio
    };
  }
}
