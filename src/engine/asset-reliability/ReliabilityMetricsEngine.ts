import { ReliabilityMetrics, FailureEvent } from './AssetReliabilityTypes';

export class ReliabilityMetricsEngine {
  public static calculateMetrics(
    totalRuntimeHours: number,
    failures: FailureEvent[]
  ): ReliabilityMetrics {
    const failureCount = failures.length;
    const mtbf = failureCount > 0 ? totalRuntimeHours / failureCount : totalRuntimeHours;
    
    return {
      mtbf,
      mttr: failureCount > 0 ? 2.5 : 0.0, // Default MTTR in hours
      availability: totalRuntimeHours > 0 ? ((totalRuntimeHours - (failureCount * 2.5)) / totalRuntimeHours) * 100 : 100,
      totalRuntimeHours,
      failureCount
    };
  }
}
