export interface ScalingMetrics {
  workerCounts: number[];
  runtimesSeconds: number[];
  speedups: number[];
  efficiencies: number[];
  scalingType: 'STRONG' | 'WEAK';
}

export class ScalingAnalyzer {
  public static computeStrongScaling(workerCounts: number[], runtimesSeconds: number[]): ScalingMetrics {
    const t1 = runtimesSeconds[0];
    const speedups = runtimesSeconds.map(t => t1 / t);
    const efficiencies = speedups.map((s, idx) => s / workerCounts[idx]);

    return {
      workerCounts,
      runtimesSeconds,
      speedups,
      efficiencies,
      scalingType: 'STRONG'
    };
  }

  public static computeWeakScaling(
    workerCounts: number[],
    runtimesSeconds: number[]
  ): ScalingMetrics {
    const t1 = runtimesSeconds[0];
    const speedups = runtimesSeconds.map(t => t1 / t);
    const efficiencies = runtimesSeconds.map(t => t1 / t); // Weak scaling efficiency is T1 / Tn

    return {
      workerCounts,
      runtimesSeconds,
      speedups,
      efficiencies,
      scalingType: 'WEAK'
    };
  }
}
