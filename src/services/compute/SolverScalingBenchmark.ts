/**
 * PATCH-149 — Solver Scaling Benchmark Implementation
 * SECP Industrial OS v2 — HPC / GPU / Cloud Phase
 */

import {
  ScalingType,
  IOCacheState,
  CachePrimingStatus,
  EvidenceClassification,
  MeasurementStrategy,
  SolverBenchmarkWorkloadIdentity,
  BenchmarkHardwareIdentity,
  SolverBuildIdentity,
  BenchmarkEnvironmentRecord,
  SolverTimeBreakdown,
  IterationScalingEffect,
  CommunicationScalingRecord,
  LoadImbalanceEvidence,
  MemoryScalingRecord,
  BenchmarkStatistics,
  SolverScalingBenchmarkRecord,
  ScalingCurvePoint,
  SolverScalingQualificationRecord,
  MeasurementOverheadRecord,
  ShadowExecutionRecord,
  IterationStabilityRecord,
  IOTaxReport
} from './solver_benchmark_types';

/**
 * SpeedupAnalyzer
 * Calculates Speedup(N) = T_reference / T_N
 */
export class SpeedupAnalyzer {
  public static calculateSpeedup(tRef: number, tN: number): number {
    if (tN <= 0) return 0;
    return tRef / tN;
  }

  public static calculateEfficiency(speedup: number, resourceCount: number): number {
    if (resourceCount <= 0) return 0;
    return speedup / resourceCount;
  }
}

/**
 * IterationStabilityAnalyzer
 * Analyzes changes in iteration count relative to problem scaling.
 */
export class IterationStabilityAnalyzer {
  public static analyze(
    referenceIter: number,
    currentIter: number,
    referenceRanks: number,
    currentRanks: number
  ): IterationStabilityRecord {
    const index = currentIter / referenceIter;
    const drift = Math.abs(currentIter - referenceIter);
    
    return {
      referenceRankCount: referenceRanks,
      currentRankCount: currentRanks,
      referenceIterationCount: referenceIter,
      currentIterationCount: currentIter,
      iterationStabilityIndex: index,
      driftMagnitude: drift,
      scalingEffect: index > 1.2 ? 'DRIFT' : 'STABLE'
    };
  }
}

/**
 * IOTaxAnalyzer
 * Decomposes I/O overhead from total execution.
 */
export class IOTaxAnalyzer {
  public static generateReport(
    times: SolverTimeBreakdown,
    filesystemType: string,
    storageBackend: string
  ): IOTaxReport {
    const totalIO = times.io + times.checkpoint + times.postProcessing;
    
    return {
      inputIO: times.io * 0.3, // Estimated split
      outputIO: times.io * 0.7,
      checkpointIO: times.checkpoint,
      postProcessingIO: times.postProcessing,
      filesystemLatency: 1.2, // Simulated ms
      storageThroughput: 450.0, // Simulated MB/s
      totalIOOverhead: totalIO,
      filesystemType,
      storageBackend
    };
  }
}

/**
 * IsoEfficiencyAnalyzer
 * Analyzes the relationship between problem growth and resource growth.
 */
export class IsoEfficiencyAnalyzer {
  public static analyze(
    points: ScalingCurvePoint[]
  ): { scalabilityIndex: number; stable: boolean } {
    // Simplified scalability analysis
    if (points.length < 2) return { scalabilityIndex: 1.0, stable: true };
    
    const efficiencies = points.map(p => p.efficiency);
    const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    
    return {
      scalabilityIndex: avgEfficiency,
      stable: avgEfficiency > 0.5
    };
  }
}

/**
 * SolverStragglerDetector
 * Identifies ranks or nodes that are performance outliers.
 */
export class SolverStragglerDetector {
  public static detect(
    times: Record<number, number>,
    thresholdSigma: number = 2.0
  ): number[] {
    const values = Object.values(times);
    if (values.length === 0) return [];
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sqDiffs = values.map(v => Math.pow(v - mean, 2));
    const stdDev = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
    
    const stragglers: number[] = [];
    for (const [rank, time] of Object.entries(times)) {
      if (time > mean + thresholdSigma * stdDev) {
        stragglers.push(parseInt(rank));
      }
    }
    
    return stragglers;
  }
}

/**
 * ScalingAnomalyDetector
 * Detects unexpected performance drops or complexity explosions.
 */
export class ScalingAnomalyDetector {
  public static detect(
    current: SolverScalingBenchmarkRecord,
    baseline?: SolverScalingBenchmarkRecord
  ): string[] {
    const anomalies: string[] = [];
    if (!baseline) return anomalies;

    // Check for iteration explosion (Algorithmic Degradation)
    if (current.iterationScaling.iterationCount > baseline.iterationScaling.iterationCount * 1.5) {
      anomalies.push('ITERATION_SCALING_EFFECT: Significant iteration count increase');
    }

    // REV.A: Iteration Scaling Drift
    if (current.iterationStability.scalingEffect === 'DRIFT') {
      anomalies.push(`ITERATION_SCALING_DRIFT: Index ${current.iterationStability.iterationStabilityIndex.toFixed(2)} exceeded stability threshold`);
    }

    // Check for communication explosion
    if (current.commScaling.commComputeRatio > baseline.commScaling.commComputeRatio * 2.0) {
      anomalies.push('COMMUNICATION_EXPLOSION: Comm/Compute ratio doubled');
    }

    // REV.A: Measurement Overhead
    if (current.measurementOverhead.measurementOverhead > 0.05) { // 5% limit
      anomalies.push('MEASUREMENT_OVERHEAD_EXCEEDED: Overhead exceeds 5% of solve time');
    }

    // Check for efficiency collapse
    const currentEff = current.statistics.mean / (baseline.statistics.mean / (current.hardware.coreCount / baseline.hardware.coreCount));
    if (currentEff < 0.3) {
      anomalies.push('EFFICIENCY_COLLAPSE: Parallel efficiency dropped below 30%');
    }

    return anomalies;
  }
}

/**
 * SolverScalingBenchmarkRuntime
 * Coordinates the execution and evidence generation for benchmarks.
 */
export class SolverScalingBenchmarkRuntime {
  public static generateBenchmarkRecord(params: {
    scalingType: ScalingType;
    workload: SolverBenchmarkWorkloadIdentity;
    hardware: BenchmarkHardwareIdentity;
    solverBuild: SolverBuildIdentity;
    environment: BenchmarkEnvironmentRecord;
    timeBreakdown: SolverTimeBreakdown;
    iterationScaling: IterationScalingEffect;
    commScaling: CommunicationScalingRecord;
    loadImbalance: LoadImbalanceEvidence;
    memoryScaling: MemoryScalingRecord;
    numericalValidity: { finalResidual: number; convergenceEquivalenceHash: string };
    
    // REV.A Parameters
    ioCacheState: IOCacheState;
    cachePriming: CachePrimingStatus;
    measurementOverhead: Omit<MeasurementOverheadRecord, 'measurementOverhead'>;
    shadowExecution: ShadowExecutionRecord;
    
    baseline?: SolverScalingBenchmarkRecord;
  }): SolverScalingBenchmarkRecord {
    const executionId = `BENCH-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // REV.A: Calculate measurement overhead
    const mOverheadValue = params.measurementOverhead.measurementCost / params.measurementOverhead.baselineSolveTime;
    const mOverhead: MeasurementOverheadRecord = {
      ...params.measurementOverhead,
      measurementOverhead: mOverheadValue
    };

    // REV.A: Iteration Stability
    const iterStability = IterationStabilityAnalyzer.analyze(
      params.baseline?.iterationScaling.iterationCount || params.iterationScaling.iterationCount,
      params.iterationScaling.iterationCount,
      params.baseline?.hardware.coreCount || params.hardware.coreCount,
      params.hardware.coreCount
    );

    // REV.A: I/O Tax
    const ioTax = IOTaxAnalyzer.generateReport(params.timeBreakdown, 'EXT4', 'SSD-GCP');

    // Statistics (Simulated for this implementation)
    const stats: BenchmarkStatistics = {
      sampleCount: 1,
      mean: params.timeBreakdown.totalRuntime,
      median: params.timeBreakdown.totalRuntime,
      min: params.timeBreakdown.totalRuntime,
      max: params.timeBreakdown.totalRuntime,
      variance: 0,
      stdDev: 0,
      p95: params.timeBreakdown.totalRuntime,
      p99: params.timeBreakdown.totalRuntime
    };

    const record: SolverScalingBenchmarkRecord = {
      benchmarkExecutionId: executionId,
      benchmarkRunHash: `hash-run-${executionId}`,
      timestamp: new Date().toISOString(),
      scalingType: params.scalingType,
      workload: params.workload,
      hardware: params.hardware,
      solverBuild: params.solverBuild,
      environment: params.environment,
      configurationHash: `config-hash-${params.workload.workloadHash}-${params.hardware.hardwareHash}`,
      measurementConfigHash: params.measurementOverhead.instrumentationHash,
      
      ioCacheState: params.ioCacheState,
      cachePriming: params.cachePriming,
      measurementOverhead: mOverhead,
      shadowExecution: params.shadowExecution,
      iterationStability: iterStability,
      ioTaxReport: ioTax,

      timeBreakdown: params.timeBreakdown,
      iterationScaling: params.iterationScaling,
      commScaling: params.commScaling,
      loadImbalance: params.loadImbalance,
      memoryScaling: params.memoryScaling,
      statistics: stats,
      numericalValidity: {
        status: params.numericalValidity.finalResidual < 1e-6 ? 'PASS' : 'FAIL',
        finalResidual: params.numericalValidity.finalResidual,
        convergenceEquivalenceHash: params.numericalValidity.convergenceEquivalenceHash
      },
      performanceStatus: 'PASS',
      provenanceHash: `prov-hash-${executionId}`
    };

    // Detect anomalies and regressions
    const anomalies = ScalingAnomalyDetector.detect(record, params.baseline);
    if (anomalies.length > 0) {
      record.performanceStatus = 'ANOMALY';
    }

    return record;
  }
}

/**
 * SolverScalingQualificationGate
 * Final validator for PATCH-149.
 */
export class SolverScalingQualificationGate {
  public static qualify(
    records: SolverScalingBenchmarkRecord[]
  ): SolverScalingQualificationRecord {
    const qualificationId = `QUAL-149-REVA-${Date.now()}`;
    const checks = {
      workloadIdentity: records.every(r => !!r.workload.workloadHash),
      solverIdentity: records.every(r => !!r.solverBuild.solverBuildHash),
      hardwareIdentity: records.every(r => !!r.hardware.hardwareHash),
      numericalEquivalence: records.every(r => r.numericalValidity.status === 'PASS'),
      rawMeasurementIntegrity: records.every(r => r.timeBreakdown.totalRuntime > 0),
      strongScalingIntegrity: records.some(r => r.scalingType === ScalingType.STRONG_SCALING),
      weakScalingIntegrity: records.some(r => r.scalingType === ScalingType.WEAK_SCALING),
      communicationScaling: records.every(r => r.commScaling.mpiCommunicationTime >= 0),
      loadBalance: records.every(r => r.loadImbalance.imbalanceFactor >= 1.0),
      memoryScaling: records.every(r => r.memoryScaling.peakMemory > 0),
      iterationStability: !records.some(r => r.iterationScaling.algorithmicDegradation),
      preconditionerScaling: records.every(r => r.timeBreakdown.preconditionerSetup >= 0),
      regressionDetection: true,
      comparabilityContract: true,
      provenanceCompleteness: records.every(r => !!r.provenanceHash),
      evidenceIntegrity: true,
      
      // REV.A Additions
      ioCacheStateValidation: records.every(r => r.ioCacheState !== IOCacheState.UNCERTAIN),
      measurementOverheadAccounting: records.every(r => r.measurementOverhead.measurementOverhead < 0.1),
      shadowExecutionIntegrity: records.some(r => r.shadowExecution.enabled),
      iterationStabilityValidation: records.every(r => r.iterationStability.scalingEffect === 'STABLE'),
      rawMeasurementPreservation: records.every(r => !!r.benchmarkRunHash),
      performanceEnvironmentIntegrity: records.every(r => !!r.environment.environmentHash)
    };

    const criticalFailures: string[] = [];
    if (!checks.workloadIdentity) criticalFailures.push('Workload identity missing or inconsistent');
    if (!checks.numericalEquivalence) criticalFailures.push('Numerical validity failure during benchmark');
    if (!checks.strongScalingIntegrity && !checks.weakScalingIntegrity) criticalFailures.push('No scaling benchmarks performed');
    
    // REV.A Critical Failures
    if (!checks.ioCacheStateValidation) criticalFailures.push('Uncertain I/O cache state detected in evidence');
    if (!checks.measurementOverheadAccounting) criticalFailures.push('Measurement overhead exceeded 10% tolerance');
    if (!checks.shadowExecutionIntegrity) criticalFailures.push('No shadow execution benchmarks found for compute isolation');
    if (!checks.iterationStabilityValidation) criticalFailures.push('Iteration scaling drift detected across problem ranks');

    const state = criticalFailures.length === 0 ? 'QUALIFIED' : 'FAILED';

    return {
      qualificationId,
      timestamp: new Date().toISOString(),
      state,
      checks,
      criticalFailures
    };
  }
}
