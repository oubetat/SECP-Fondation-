import { HaloStrategy, MPIHaloAggregationMetrics } from '../../engine/engineering_hpc/mpi_types';

export class MPIHaloAggregationManager {
  /**
   * Benchmarks different halo strategies for a given boundary size.
   * Direct strategy sends raw ghost cells across separate non-blocking requests.
   * Packed strategy aggregates boundary cells into contiguous buffers, minimizing requests but incurring copy costs.
   * Packed aggregated merges boundaries for multiple neighbors into a single transit buffer where topology allows.
   */
  public static benchmarkStrategies(
    boundaryElementsCount: number,
    neighborCount: number,
    elementSizeBytes: number = 64
  ): MPIHaloAggregationMetrics[] {
    const results: MPIHaloAggregationMetrics[] = [];
    const totalBytes = boundaryElementsCount * elementSizeBytes;
    
    // 1. Direct Strategy (Separate calls per neighbor, no packing cost, high message overhead)
    const directPacking = 0.0;
    const directUnpacking = 0.0;
    const directLatency = 1.8 * neighborCount; // higher latency penalty due to many small messages
    const directExchangeTime = directPacking + directUnpacking + directLatency + (totalBytes / (1024 * 1024 * 1024)) * 3.0; // slow for small message overhead
    results.push({
      strategy: 'DIRECT',
      messageCount: neighborCount * 2, // send + recv per neighbor
      bytes: totalBytes,
      latencyMs: directLatency,
      packingTimeMs: directPacking,
      unpackingTimeMs: directUnpacking,
      totalExchangeTimeMs: directExchangeTime
    });

    // 2. Packed Strategy (One packed buffer per neighbor, copy cost, low message overhead)
    const packedPacking = (boundaryElementsCount * 0.000001) * neighborCount; // SIMD copy cost
    const packedUnpacking = (boundaryElementsCount * 0.0000008) * neighborCount;
    const packedLatency = 0.15 * neighborCount; // reduced message overhead
    const packedExchangeTime = packedPacking + packedUnpacking + packedLatency + (totalBytes / (1024 * 1024 * 1024)) * 1.0;
    results.push({
      strategy: 'PACKED',
      messageCount: neighborCount,
      bytes: totalBytes,
      latencyMs: packedLatency,
      packingTimeMs: packedPacking,
      unpackingTimeMs: packedUnpacking,
      totalExchangeTimeMs: packedExchangeTime
    });

    // 3. Packed Aggregated Strategy (Fully merged transit buffer, low message rate, optimized network path)
    const aggregatedPacking = (boundaryElementsCount * 0.0000007) * neighborCount; // highly optimized parallel packing
    const aggregatedUnpacking = (boundaryElementsCount * 0.0000005) * neighborCount;
    const aggregatedLatency = 0.08; // flat latency for consolidated transport
    const aggregatedExchangeTime = aggregatedPacking + aggregatedUnpacking + aggregatedLatency + (totalBytes / (1024 * 1024 * 1024)) * 0.5;
    results.push({
      strategy: 'PACKED_AGGREGATED',
      messageCount: 2, // consolidated send and receive
      bytes: totalBytes,
      latencyMs: aggregatedLatency,
      packingTimeMs: aggregatedPacking,
      unpackingTimeMs: aggregatedUnpacking,
      totalExchangeTimeMs: aggregatedExchangeTime
    });

    return results;
  }

  public static selectOptimalStrategy(metrics: MPIHaloAggregationMetrics[]): MPIHaloAggregationMetrics {
    // Return the strategy with the lowest totalExchangeTimeMs
    return metrics.reduce((min, cur) => cur.totalExchangeTimeMs < min.totalExchangeTimeMs ? cur : min, metrics[0]);
  }
}
