export type ReductionPolicy = 'STRICT_DETERMINISTIC' | 'NUMERICALLY_REPRODUCIBLE' | 'STANDARD_MPI_REDUCTION';

export interface WorkloadToleranceConfig {
  numericalTolerance: number;       // Workload-qualified numerical threshold (e.g. 1e-11)
  conservationTolerance: number;    // Workload-qualified physical conservation threshold (e.g. 1e-12)
}

export class MPIDeterministicReductionManager {
  /**
   * Executes a compensated summation (Kahan Summation) to minimize floating point accumulation errors.
   */
  public static kahanSum(values: number[]): number {
    let sum = 0.0;
    let c = 0.0; // Running compensation for lost low-order bits
    
    for (const x of values) {
      const y = x - c;
      const t = sum + y;
      c = (t - sum) - y;
      sum = t;
    }
    
    return sum;
  }

  /**
   * Performs a deterministic reduction tree.
   * Standard MPI collectives (like MPI_Allreduce) are non-deterministic for floating-point values
   * because rank arrival orders or dynamic tree shapes change the associativity of summation.
   * This method enforces a static binary reduction tree sorted by Rank to guarantee bitwise reproducibility.
   */
  public static executeDeterministicReduction(
    rankValues: { [rank: number]: number },
    policy: ReductionPolicy
  ): number {
    const sortedRanks = Object.keys(rankValues).map(Number).sort((a, b) => a - b);
    const values = sortedRanks.map(r => rankValues[r]);

    if (policy === 'STRICT_DETERMINISTIC') {
      // Step-by-step rigid binary tree reduction
      let currentLevel = [...values];
      while (currentLevel.length > 1) {
        const nextLevel: number[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
          if (i + 1 < currentLevel.length) {
            // Apply Kahan compensated addition for each pair to remain numerically reproducible
            nextLevel.push(this.kahanSum([currentLevel[i], currentLevel[i + 1]]));
          } else {
            nextLevel.push(currentLevel[i]);
          }
        }
        currentLevel = nextLevel;
      }
      return currentLevel[0] || 0.0;
    } else if (policy === 'NUMERICALLY_REPRODUCIBLE') {
      // Sort and apply Kahan Summation sequentially
      return this.kahanSum(values);
    } else {
      // Standard linear fold (associativity matches rank summation sequence, potentially non-deterministic)
      return values.reduce((sum, v) => sum + v, 0.0);
    }
  }

  /**
   * Validates global physical conservation (e.g., Mass, Momentum, Energy).
   * Verifies that the global conservation error is less than the workload-qualified conservation tolerance.
   */
  public static validateGlobalConservation(
    initialState: { mass: number; energy: number },
    finalState: { mass: number; energy: number },
    tolerances: WorkloadToleranceConfig
  ): { passed: boolean; massError: number; energyError: number; tolerance: number } {
    const massError = Math.abs(finalState.mass - initialState.mass) / (initialState.mass || 1.0);
    const energyError = Math.abs(finalState.energy - initialState.energy) / (initialState.energy || 1.0);
    
    const passed = massError <= tolerances.conservationTolerance && energyError <= tolerances.conservationTolerance;
    
    return {
      passed,
      massError,
      energyError,
      tolerance: tolerances.conservationTolerance
    };
  }
}
