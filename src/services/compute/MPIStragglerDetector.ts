import { MPIStragglerMetrics, MPIProcessTopology } from '../../engine/engineering_hpc/mpi_types';

export interface StragglerDetectorConfig {
  performanceStragglerThreshold: number; // workload-qualified multiplier (e.g. 1.25x average)
}

export class MPIStragglerDetector {
  public static detectStragglers(
    topology: MPIProcessTopology[],
    config: StragglerDetectorConfig,
    injectedStragglerRank?: number
  ): MPIStragglerMetrics[] {
    const metrics: MPIStragglerMetrics[] = [];
    
    // Establish a baseline for standard execution/communication times
    const baselineExecTime = 50.0; // ms
    const baselineCommTime = 5.0; // ms
    const baselineColWait = 10.0; // ms
    const baselineSyncWait = 2.0; // ms
    const baselineMemoryBytes = 1024 * 1024 * 512; // 512MB
    const baselineNetVariance = 0.1; // ms

    // First, construct the metric sets for all ranks
    for (const rankInfo of topology) {
      let execTime = baselineExecTime;
      let commTime = baselineCommTime;
      let colWait = baselineColWait;
      let syncWait = baselineSyncWait;
      let netVariance = baselineNetVariance;
      let memPressure = baselineMemoryBytes;

      // Simulate some slight natural jitter
      const jitter = (Math.sin(rankInfo.rank) + 1.0) * 0.5 * 2.0; // 0 to 2ms
      execTime += jitter;
      commTime += jitter * 0.2;

      // Inject a straggler if requested to test detection
      if (injectedStragglerRank !== undefined && rankInfo.rank === injectedStragglerRank) {
        // Slow down this rank significantly (e.g., thermal throttling or network variance)
        execTime *= 1.8;
        commTime *= 2.5;
        colWait *= 2.0;
        syncWait *= 3.0;
        memPressure += 1024 * 1024 * 128; // Extra 128MB memory pressure
        netVariance = 4.5; // High variance
      }

      metrics.push({
        rank: rankInfo.rank,
        nodeId: rankInfo.nodeId,
        executionLatencyMs: execTime,
        communicationLatencyMs: commTime,
        collectiveWaitMs: colWait,
        synchronizationWaitMs: syncWait,
        memoryPressureBytes: memPressure,
        networkLatencyVarianceMs: netVariance,
        isStraggler: false
      });
    }

    // Compute average execution and communication latencies to determine threshold bounds
    const totalExec = metrics.reduce((sum, m) => sum + m.executionLatencyMs, 0);
    const avgExec = totalExec / metrics.length;

    const threshold = avgExec * config.performanceStragglerThreshold;

    // Apply the workload-qualified threshold to tag stragglers
    for (const m of metrics) {
      if (m.executionLatencyMs > threshold) {
        m.isStraggler = true;
      }
    }

    return metrics;
  }
}
