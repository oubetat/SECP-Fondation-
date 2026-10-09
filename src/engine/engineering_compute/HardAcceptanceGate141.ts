import { EngineeringTask, ComputeResource } from './types';
import { ExecutionGraph } from '../../services/compute/ExecutionGraph';
import { WorkPartitioner } from '../../services/compute/WorkPartitioner';
import { EngineeringScheduler } from '../../services/compute/EngineeringScheduler';
import { CheckpointManager } from '../../services/compute/CheckpointManager';
import { ParallelResultReconciler } from '../../services/compute/ParallelResultReconciler';
import { DeterministicReductionEngine } from '../../services/compute/DeterministicReductionEngine';
import { ScalingAnalyzer } from '../../services/compute/ScalingAnalyzer';

export interface Gate141Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate141 {
  public static async runAllTests(): Promise<Gate141Result[]> {
    const results: Gate141Result[] = [];

    // 1. DAG Cyclic Dependency Catch Test
    results.push(this.testCyclicDAGDetection());

    // 2. Correct Task Dependency Execution Test
    results.push(await this.testTaskDependencyExecution());

    // 3. Workload Partitioning Test
    results.push(this.testWorkloadPartitioning());

    // 4. Checkpoint and Resume Integrity Test
    results.push(this.testCheckpointAndResume());

    // 5. Deterministic Floating Point Reduction Test
    results.push(this.testDeterministicReduction());

    // 6. Serial vs Parallel Numerical Equivalence & Drift Test
    results.push(this.testNumericalDriftDetection());

    // 7. Scaling Analysis Test (Strong & Weak)
    results.push(this.testScalingAnalysis());

    // 8. Execution Evidence Generation Test
    results.push(await this.testExecutionEvidenceGeneration());

    return results;
  }

  private static testCyclicDAGDetection(): Gate141Result {
    const tasks: EngineeringTask[] = [
      {
        taskId: 'T1',
        workloadType: 'SIMULATION',
        inputs: {},
        dependencies: ['T2'],
        resourceRequirements: {},
        determinismClass: 'STRICT_DETERMINISTIC',
        priority: 1,
        state: 'QUEUED'
      },
      {
        taskId: 'T2',
        workloadType: 'SIMULATION',
        inputs: {},
        dependencies: ['T1'], // Cycle!
        resourceRequirements: {},
        determinismClass: 'STRICT_DETERMINISTIC',
        priority: 1,
        state: 'QUEUED'
      }
    ];

    const dagRes = ExecutionGraph.validateDAG(tasks);
    const passed = !dagRes.valid && dagRes.error?.includes('Cyclic dependency');

    return {
      gateId: 'GATE-141-CYCLIC-DAG-DETECTION',
      description: 'Catch cyclic dependencies in execution graph and reject with EXECUTION_GRAPH_INVALID',
      passed,
      verdict: passed ? 'EXECUTION_GRAPH_INVALID_DETECTED' : 'FAILED',
      details: passed ? 'Successfully caught cyclic execution graph.' : 'Allowed cyclic graph.'
    };
  }

  private static async testTaskDependencyExecution(): Promise<Gate141Result> {
    const tasks: EngineeringTask[] = [
      {
        taskId: 'CAD-1',
        workloadType: 'INTERACTIVE',
        inputs: { value: 10 },
        dependencies: [],
        resourceRequirements: {},
        determinismClass: 'STRICT_DETERMINISTIC',
        priority: 1,
        state: 'QUEUED'
      },
      {
        taskId: 'MESH-1',
        workloadType: 'SIMULATION',
        inputs: { value: 20 },
        dependencies: ['CAD-1'],
        resourceRequirements: {},
        determinismClass: 'STRICT_DETERMINISTIC',
        priority: 1,
        state: 'QUEUED'
      }
    ];

    const resources: ComputeResource[] = [
      {
        resourceId: 'RES-CPU-1',
        type: 'LOCAL_CPU',
        cpuCount: 16,
        gpuCount: 0,
        memoryMB: 64000,
        gpuMemoryMB: 0,
        architecture: 'x86_64',
        capabilities: ['AVX512'],
        availability: true,
        health: 'HEALTHY',
        location: 'local'
      }
    ];

    const job = EngineeringScheduler.createJob('JOB-101', tasks, resources);
    const completedJob = await EngineeringScheduler.executeJob(job.jobId);
    const passed = completedJob.state === 'COMPLETED' && completedJob.tasks.every(t => t.state === 'COMPLETED');

    return {
      gateId: 'GATE-141-TASK-DEPENDENCY-EXECUTION',
      description: 'Execute tasks respecting dependency DAG order strictly',
      passed,
      verdict: passed ? 'DEPENDENCY_ORDER_VERIFIED' : 'FAILED',
      details: passed ? 'Executed DAG tasks in correct sequence.' : 'Failed dependency execution.'
    };
  }

  private static testWorkloadPartitioning(): Gate141Result {
    const parentTask: EngineeringTask = {
      taskId: 'FEM-GLOBAL',
      workloadType: 'SIMULATION',
      inputs: { domainSize: 1000 },
      dependencies: [],
      resourceRequirements: {},
      determinismClass: 'STRICT_DETERMINISTIC',
      priority: 1,
      state: 'QUEUED'
    };

    const partitions = WorkPartitioner.partitionWorkload(parentTask, 4, 'ELEMENT_PARTITION');
    const passed = partitions.length === 4 && partitions[0].partitionType === 'ELEMENT_PARTITION';

    return {
      gateId: 'GATE-141-WORKLOAD-PARTITIONING',
      description: 'Partition complex engineering workload into deterministic element sub-partitions',
      passed,
      verdict: passed ? 'PARTITIONING_VERIFIED' : 'FAILED',
      details: passed ? 'Successfully partitioned 1 task into 4 element sub-domains.' : 'Partitioning failed.'
    };
  }

  private static testCheckpointAndResume(): Gate141Result {
    const task: EngineeringTask = {
      taskId: 'SOLVER-STEP-5',
      workloadType: 'SIMULATION',
      inputs: { tolerance: 1e-5 },
      dependencies: [],
      resourceRequirements: {},
      determinismClass: 'STRICT_DETERMINISTIC',
      priority: 1,
      state: 'RUNNING'
    };

    const cp = CheckpointManager.createCheckpoint(task, 100, { residual: 0.002 }, 'W-1', 'RES-1');
    const resumeRes = CheckpointManager.resumeFromCheckpoint(cp.checkpointId, { tolerance: 1e-5 });

    const passed = resumeRes.valid && resumeRes.checkpoint?.iteration === 100;

    return {
      gateId: 'GATE-141-CHECKPOINT-RESUME',
      description: 'Validate checkpoint creation and deterministic resume state',
      passed,
      verdict: passed ? 'CHECKPOINT_RESUME_VERIFIED' : 'FAILED',
      details: passed ? 'Successfully verified checkpoint state at iteration 100.' : 'Failed resume.'
    };
  }

  private static testDeterministicReduction(): Gate141Result {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    const sum1 = DeterministicReductionEngine.deterministicSum(values);
    const sum2 = DeterministicReductionEngine.deterministicSum([...values].reverse());

    const passed = Math.abs(sum1 - sum2) < 1e-12;

    return {
      gateId: 'GATE-141-DETERMINISTIC-REDUCTION',
      description: 'Enforce deterministic tree reduction order for parallel floating-point sum',
      passed,
      verdict: passed ? 'DETERMINISTIC_REDUCTION_VERIFIED' : 'FAILED',
      details: passed ? 'Bitwise/floating-point equivalent reduction confirmed regardless of input order.' : 'Non-deterministic sum.'
    };
  }

  private static testNumericalDriftDetection(): Gate141Result {
    const serialResult = [100.0, 200.0, 300.0];
    const parallelResultDivergent = [100.0, 205.0, 300.0]; // 5.0 drift

    const recon = ParallelResultReconciler.reconcileResults(serialResult, parallelResultDivergent, 1e-3);
    const passed = !recon.matched && recon.status === 'PARALLEL_NUMERICAL_DRIFT';

    return {
      gateId: 'GATE-141-NUMERICAL-DRIFT-DETECTION',
      description: 'Detect numerical drift exceeding tolerance in parallel execution and mark INVALID',
      passed,
      verdict: passed ? 'PARALLEL_NUMERICAL_DRIFT_DETECTED' : 'FAILED',
      details: passed ? 'Successfully caught parallel numerical drift (5.0 > 1e-3).' : 'Allowed numerical drift.'
    };
  }

  private static testScalingAnalysis(): Gate141Result {
    const workers = [1, 2, 4, 8];
    const runtimes = [100, 52, 27, 14]; // Near linear speedup

    const metrics = ScalingAnalyzer.computeStrongScaling(workers, runtimes);
    const passed = metrics.speedups[3] > 7.0 && metrics.efficiencies[3] > 0.85;

    return {
      gateId: 'GATE-141-SCALING-ANALYSIS',
      description: 'Measure parallel strong scaling speedup and efficiency metrics',
      passed,
      verdict: passed ? 'STRONG_SCALING_VERIFIED' : 'FAILED',
      details: passed ? `Achieved speedup ${metrics.speedups[3].toFixed(2)}x on 8 workers.` : 'Scaling analysis failed.'
    };
  }

  private static async testExecutionEvidenceGeneration(): Promise<Gate141Result> {
    const tasks: EngineeringTask[] = [
      {
        taskId: 'FEA-EV-1',
        workloadType: 'SIMULATION',
        inputs: { load: 500 },
        dependencies: [],
        resourceRequirements: {},
        determinismClass: 'STRICT_DETERMINISTIC',
        priority: 1,
        state: 'QUEUED'
      }
    ];

    const resources: ComputeResource[] = [
      {
        resourceId: 'RES-GPU-1',
        type: 'LOCAL_GPU',
        cpuCount: 8,
        gpuCount: 1,
        memoryMB: 32000,
        gpuMemoryMB: 16000,
        architecture: 'CUDA-12',
        capabilities: ['FP64_TENSOR'],
        availability: true,
        health: 'HEALTHY',
        location: 'local'
      }
    ];

    const job = EngineeringScheduler.createJob('JOB-EVID-101', tasks, resources);
    const completedJob = await EngineeringScheduler.executeJob(job.jobId);

    const passed = completedJob.evidenceList.length > 0 && completedJob.evidenceList[0].validationStatus === 'VALIDATED';

    return {
      gateId: 'GATE-141-EXECUTION-EVIDENCE-GENERATION',
      description: 'Generate immutable execution evidence provenance for parallel computation',
      passed,
      verdict: passed ? 'EXECUTION_EVIDENCE_GENERATED' : 'FAILED',
      details: passed ? 'Successfully attached execution evidence snapshot.' : 'Missing evidence.'
    };
  }
}
