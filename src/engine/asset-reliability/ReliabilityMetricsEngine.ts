/**
 * PATCH-SECP-065: Reliability Metrics Engine
 * Calculates MTBF, MTTR, and availability based on runtime and failure data.
 */

import { ReliabilityMetrics, FailureEvent } from './AssetReliabilityTypes';

export class ReliabilityMetricsEngine {
  public static calculateMetrics(totalRuntimeHours: number, failures: FailureEvent[]): ReliabilityMetrics {
    const failureCount = failures.length;
    
    // Mean Time Between Failures (MTBF)
    const mtbf = failureCount === 0 ? totalRuntimeHours : totalRuntimeHours / failureCount;
    
    // Simple MTTR estimation for this simulation
    const mttr = failureCount === 0 ? 0 : 4.5; // Average 4.5 hours per repair

    // Availability = MTBF / (MTBF + MTTR)
    const availability = mtbf === 0 ? 0 : (mtbf / (mtbf + mttr)) * 100;

    return {
      mtbf,
      mttr,
      availability: Math.min(100, availability),
      totalRuntimeHours,
      failureCount
    }
  }
}
