/**
 * PATCH-149 — Hard Acceptance Gate: Solver Scaling
 * SECP Industrial OS v2 — HPC / GPU / Cloud Phase
 */

import {
  SolverScalingBenchmarkRuntime,
  SolverScalingQualificationGate,
  SpeedupAnalyzer
} from '../../services/compute/SolverScalingBenchmark';
import {
  ScalingType,
  IOCacheState,
  CachePrimingStatus,
  MeasurementStrategy,
  SolverScalingBenchmarkRecord,
  SolverBenchmarkWorkloadIdentity,
  BenchmarkHardwareIdentity,
  SolverBuildIdentity,
  BenchmarkEnvironmentRecord,
  SolverScalingQualificationRecord
} from '../../services/compute/solver_benchmark_types';

export interface Gate149Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate149 {
  public static async runAllTests(): Promise<{ results: Gate149Result[]; qualification: SolverScalingQualificationRecord }> {
    const results: Gate149Result[] = [];
    const benchmarkRecords: SolverScalingBenchmarkRecord[] = [];

    // 1. Setup Identities
    const workload: SolverBenchmarkWorkloadIdentity = {
      solverFamily: 'Iterative-GMRES',
      problemType: 'Linear-Static-Elasticity',
      meshIdentity: 'CUBE-1M-HEX',
      dofCount: 1000000,
      elementCount: 333333,
      matrixStructure: 'CSR',
      sparsityHash: 'sparsity-001',
      rhsCharacteristics: 'POINT_LOADS',
      boundaryConditions: 'FIXED_BASE',
      materialModel: 'LINEAR_ISOTROPIC',
      nonlinearState: 'NONE',
      solverConfiguration: 'GMRES-ILU(0)',
      workloadHash: 'workload-ref-1m'
    };

    const hardware1: BenchmarkHardwareIdentity = {
      cpuModel: 'Xeon-Platinum-8280',
      coreCount: 1,
      threadCount: 1,
      memoryCapacity: 128,
      numaTopology: '1-NODE-1-SOCKET',
      interconnect: 'SHARED_MEMORY',
      networkAdapter: 'LOOPBACK',
      hardwareHash: 'hw-1core'
    };

    const hardware4: BenchmarkHardwareIdentity = {
      cpuModel: 'Xeon-Platinum-8280',
      coreCount: 4,
      threadCount: 4,
      memoryCapacity: 128,
      numaTopology: '1-NODE-1-SOCKET',
      interconnect: 'SHARED_MEMORY',
      networkAdapter: 'LOOPBACK',
      hardwareHash: 'hw-4core'
    };

    const solverBuild: SolverBuildIdentity = {
      sourceVersion: 'v2.1.0',
      commit: 'abc12345',
      compiler: 'gcc',
      compilerVersion: '11.2',
      optimizationFlags: ['-O3', '-mavx512f'],
      linker: 'ld',
      dependencies: { 'petsc': '3.16', 'slepc': '3.16' },
      buildMode: 'RELEASE',
      solverBuildHash: 'build-ref-release'
    };

    const environment: BenchmarkEnvironmentRecord = {
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-generic',
      runtime: 'Node.js v20.0',
      libraries: { 'blas': '3.10', 'lapack': '3.10' },
      drivers: { 'nvidia': '525.60' },
      containerImage: 'secp-hpc-v2:latest',
      environmentHash: 'env-hash-v2-reva'
    };

    // -------------------------------------------------------------------------
    // TEST 1: Strong Scaling (1 Core vs 4 Cores)
    // -------------------------------------------------------------------------
    const record1 = SolverScalingBenchmarkRuntime.generateBenchmarkRecord({
      scalingType: ScalingType.STRONG_SCALING,
      workload,
      hardware: hardware1,
      solverBuild,
      environment,
      timeBreakdown: {
        matrixAssembly: 10.0,
        preconditionerSetup: 5.0,
        solverIterations: 85.0,
        communication: 0,
        synchronization: 0,
        memoryMovement: 0,
        io: 2.0,
        checkpoint: 0,
        postProcessing: 1.0,
        totalRuntime: 103.0
      },
      iterationScaling: {
        iterationCount: 150,
        iterationTime: 0.56,
        convergenceHistory: [],
        residualEvolution: [],
        solverTerminationReason: 'CONVERGED_RELATIVE_TOLERANCE',
        algorithmicDegradation: false
      },
      commScaling: {
        mpiCommunicationTime: 0,
        collectiveTime: 0,
        pointToPointTime: 0,
        haloExchange: 0,
        reductionTime: 0,
        synchronizationTime: 0,
        commComputeRatio: 0
      },
      loadImbalance: {
        rankComputeTime: { 0: 103.0 },
        rankCommunicationTime: { 0: 0 },
        rankMemoryUsage: { 0: 4500 },
        rankIterationCount: { 0: 150 },
        imbalanceFactor: 1.0
      },
      memoryScaling: {
        peakMemory: 4500,
        residentMemory: 4200,
        solverMemory: 2000,
        matrixMemory: 1500,
        preconditionerMemory: 500,
        communicationBuffers: 0,
        memoryPerDOF: 0.0045,
        memoryPerNonzero: 0.12
      },
      numericalValidity: { finalResidual: 1.2e-8, convergenceEquivalenceHash: 'conv-001' },
      ioCacheState: IOCacheState.WARM,
      cachePriming: CachePrimingStatus.ENABLED,
      measurementOverhead: {
        measurementCost: 0.2,
        baselineSolveTime: 85.0,
        measurementCalls: 1000,
        measurementFrequency: '10ms',
        telemetryBytes: 50000,
        aggregationTime: 0.05,
        synchronizationCost: 0.02,
        strategy: MeasurementStrategy.FULL,
        instrumentationHash: 'inst-001'
      },
      shadowExecution: {
        enabled: false,
        shadowExecutionTime: 0,
        fullExecutionTime: 103.0,
        ioOverhead: 3.0,
        checkpointOverhead: 0,
        postProcessingOverhead: 1.0
      }
    });
    benchmarkRecords.push(record1);

    const record4 = SolverScalingBenchmarkRuntime.generateBenchmarkRecord({
      scalingType: ScalingType.STRONG_SCALING,
      workload,
      hardware: hardware4,
      solverBuild,
      environment,
      timeBreakdown: {
        matrixAssembly: 2.7,
        preconditionerSetup: 1.4,
        solverIterations: 23.0,
        communication: 1.5,
        synchronization: 0.5,
        memoryMovement: 0,
        io: 2.1,
        checkpoint: 0,
        postProcessing: 0.3,
        totalRuntime: 31.5
      },
      iterationScaling: {
        iterationCount: 150,
        iterationTime: 0.15,
        convergenceHistory: [],
        residualEvolution: [],
        solverTerminationReason: 'CONVERGED_RELATIVE_TOLERANCE',
        algorithmicDegradation: false
      },
      commScaling: {
        mpiCommunicationTime: 1.5,
        collectiveTime: 0.5,
        pointToPointTime: 1.0,
        haloExchange: 0.8,
        reductionTime: 0.2,
        synchronizationTime: 0.5,
        commComputeRatio: 0.05
      },
      loadImbalance: {
        rankComputeTime: { 0: 31.0, 1: 31.5, 2: 30.8, 3: 31.2 },
        rankCommunicationTime: { 0: 1.5, 1: 1.5, 2: 1.4, 3: 1.6 },
        rankMemoryUsage: { 0: 1200, 1: 1200, 2: 1200, 3: 1200 },
        rankIterationCount: { 0: 150, 1: 150, 2: 150, 3: 150 },
        imbalanceFactor: 1.02
      },
      memoryScaling: {
        peakMemory: 4800, // Aggregate
        residentMemory: 4600,
        solverMemory: 2100,
        matrixMemory: 1500,
        preconditionerMemory: 500,
        communicationBuffers: 200,
        memoryPerDOF: 0.0048,
        memoryPerNonzero: 0.13
      },
      numericalValidity: { finalResidual: 1.2e-8, convergenceEquivalenceHash: 'conv-001' },
      ioCacheState: IOCacheState.WARM,
      cachePriming: CachePrimingStatus.ENABLED,
      measurementOverhead: {
        measurementCost: 0.15,
        baselineSolveTime: 23.0,
        measurementCalls: 500,
        measurementFrequency: '10ms',
        telemetryBytes: 30000,
        aggregationTime: 0.04,
        synchronizationCost: 0.01,
        strategy: MeasurementStrategy.FULL,
        instrumentationHash: 'inst-001'
      },
      shadowExecution: {
        enabled: true,
        shadowExecutionTime: 28.5,
        fullExecutionTime: 31.5,
        ioOverhead: 2.1,
        checkpointOverhead: 0,
        postProcessingOverhead: 0.3
      },
      baseline: record1
    });
    benchmarkRecords.push(record4);

    const speedup = SpeedupAnalyzer.calculateSpeedup(record1.statistics.mean, record4.statistics.mean);
    const efficiency = SpeedupAnalyzer.calculateEfficiency(speedup, 4);

    results.push({
      gateId: '149-TEST-01-StrongScaling',
      description: 'Validate Strong Scaling Speedup and Efficiency calculations',
      passed: speedup > 3.0 && efficiency > 0.75,
      verdict: 'SCALING_MEASURED',
      details: `Speedup(4): ${speedup.toFixed(2)}, Efficiency(4): ${efficiency.toFixed(2)}`
    });

    // -------------------------------------------------------------------------
    // REV.A TEST: Measurement Overhead Accounting
    // -------------------------------------------------------------------------
    const overhead = record4.measurementOverhead.measurementOverhead;
    results.push({
      gateId: '149-TEST-05-MeasurementOverhead',
      description: 'Audit measurement instrumentation cost budget',
      passed: overhead < 0.05,
      verdict: 'OVERHEAD_QUALIFIED',
      details: `Measured Overhead: ${(overhead * 100).toFixed(2)}% (Limit: 5%)`
    });

    // -------------------------------------------------------------------------
    // REV.A TEST: Shadow Execution & I/O Tax
    // -------------------------------------------------------------------------
    const ioTax = record4.ioTaxReport.totalIOOverhead;
    const shadowTime = record4.shadowExecution.shadowExecutionTime;
    results.push({
      gateId: '149-TEST-06-ShadowExecution',
      description: 'Validate compute-only shadow execution vs full production flow',
      passed: shadowTime < record4.timeBreakdown.totalRuntime && ioTax > 0,
      verdict: 'IO_TAX_DECOMPOSED',
      details: `Full: ${record4.timeBreakdown.totalRuntime}s, Shadow: ${shadowTime}s, I/O Tax: ${ioTax}s`
    });

    // -------------------------------------------------------------------------
    // REV.A TEST: Iteration Stability Audit
    // -------------------------------------------------------------------------
    const iterIndex = record4.iterationStability.iterationStabilityIndex;
    results.push({
      gateId: '149-TEST-07-IterationStability',
      description: 'Audit solver iteration stability during scaling',
      passed: record4.iterationStability.scalingEffect === 'STABLE',
      verdict: 'ITERATIONS_STABLE',
      details: `Stability Index: ${iterIndex.toFixed(2)} (Stable <= 1.2)`
    });

    // -------------------------------------------------------------------------
    // FINAL QUALIFICATION
    // -------------------------------------------------------------------------
    const qualification = SolverScalingQualificationGate.qualify(benchmarkRecords);

    results.push({
      gateId: '149-TEST-04-Qualification',
      description: 'Final qualification gate for PATCH-149 REV.A — Operational Reality',
      passed: qualification.state === 'QUALIFIED',
      verdict: 'QUALIFIED_EVIDENCE',
      details: `State: ${qualification.state}, Checks Passed: ${Object.values(qualification.checks).filter(c => c).length}/22`
    });

    return { results, qualification };
  }
}
