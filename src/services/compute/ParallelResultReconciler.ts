export class ParallelResultReconciler {
  public static reconcileResults(
    serialResult: number[],
    parallelResult: number[],
    tolerance: number = 1e-6
  ): { matched: boolean; maxDrift: number; status: 'VALIDATED' | 'PARALLEL_NUMERICAL_DRIFT' } {
    if (serialResult.length !== parallelResult.length) {
      return { matched: false, maxDrift: Infinity, status: 'PARALLEL_NUMERICAL_DRIFT' };
    }

    let maxDrift = 0;
    for (let i = 0; i < serialResult.length; i++) {
      const diff = Math.abs(serialResult[i] - parallelResult[i]);
      if (diff > maxDrift) {
        maxDrift = diff;
      }
    }

    if (maxDrift > tolerance) {
      return { matched: false, maxDrift, status: 'PARALLEL_NUMERICAL_DRIFT' };
    }

    return { matched: true, maxDrift, status: 'VALIDATED' };
  }
}
