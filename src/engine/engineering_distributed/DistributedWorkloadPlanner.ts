/**
 * SECP Industrial OS - PATCH-303 Distributed Workload Planner
 * Handles Workload Decomposition, DAG Dependency Building, Cycle Detection & Partitioning
 */

import {
  AggregationStrategy,
  DistributedTask,
  JobId,
  PartitionStrategy,
  PriorityLevel,
  SchedulingPolicy,
  TaskId,
  WorkloadType,
} from './DistributedComputeTypes303';

export interface WorkloadDecompositionInput {
  jobId: JobId;
  workloadType: WorkloadType;
  partitionStrategy: PartitionStrategy;
  aggregationStrategy: AggregationStrategy;
  totalElementsOrCells: number;
  partitionCount: number;
  chunkSize: number;
  parametersPayload?: Record<string, any>;
  priority?: PriorityLevel;
}

export class DistributedWorkloadPlanner {
  /**
   * Plan and decompose an engineering workload into a DAG of tasks
   */
  public decomposeWorkload(input: WorkloadDecompositionInput): DistributedTask[] {
    const {
      jobId,
      workloadType,
      partitionStrategy,
      totalElementsOrCells,
      partitionCount,
      chunkSize,
      parametersPayload = {},
    } = input;

    // Determine optimal partition count based on chunk size
    const effectivePartitions = Math.max(
      1,
      Math.min(partitionCount, Math.ceil(totalElementsOrCells / Math.max(1, chunkSize)))
    );

    const tasks: DistributedTask[] = [];

    switch (workloadType) {
      case 'CFD_SOLVE':
        this.decomposeCfdWorkload(jobId, effectivePartitions, totalElementsOrCells, parametersPayload, tasks);
        break;
      case 'FEM_SOLVE':
        this.decomposeFemWorkload(jobId, effectivePartitions, totalElementsOrCells, parametersPayload, tasks);
        break;
      case 'MESH_PARTITION':
        this.decomposeMeshWorkload(jobId, effectivePartitions, totalElementsOrCells, parametersPayload, tasks);
        break;
      case 'DESIGN_SPACE_SWEEP':
        this.decomposeDesignSpaceSweep(jobId, effectivePartitions, parametersPayload, tasks);
        break;
      case 'CAM_TOOLPATH_BATCH':
        this.decomposeCamToolpathBatch(jobId, effectivePartitions, parametersPayload, tasks);
        break;
      case 'MIXED_PHYSICS':
      default:
        this.decomposeGenericWorkload(jobId, effectivePartitions, totalElementsOrCells, parametersPayload, tasks);
        break;
    }

    // Validate DAG cycle-freeness
    if (this.detectCycle(tasks)) {
      throw new Error(`Invalid Workload DAG generated for Job ${jobId}: Cycle detected in task dependencies.`);
    }

    return tasks;
  }

  /**
   * CFD Workload Decomposition: Partition domain cells, run flux sweeps, boundary exchange, and final field assembly
   */
  private decomposeCfdWorkload(
    jobId: JobId,
    partitions: number,
    totalCells: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const cellsPerPartition = Math.ceil(totalCells / partitions);
    const subDomainTaskIds: TaskId[] = [];

    // Stage 1: Partitioned Sub-Domain CFD Navier-Stokes / SIMPLE Solves
    for (let p = 0; p < partitions; p++) {
      const taskId: TaskId = `${jobId}_CFD_PART_${p}`;
      subDomainTaskIds.push(taskId);

      const cellStart = p * cellsPerPartition;
      const cellEnd = Math.min(totalCells, (p + 1) * cellsPerPartition);

      tasks.push({
        taskId,
        jobId,
        partitionId: p,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_CFD_${p}_${cellStart}_${cellEnd}`),
        requiredCapabilities: ['CFD_KERNEL_FVM', 'WASM_SIMD128'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: {
          partitionIndex: p,
          cellStart,
          cellEnd,
          cellCount: cellEnd - cellStart,
          viscosity: payload.viscosity || 1.81e-5,
          density: payload.density || 1.225,
          inletVelocity: payload.inletVelocity || [10.0, 0.0, 0.0],
        },
      });
    }

    // Stage 2: Boundary Exchange & Interface Flux Balancing Task (depends on all sub-domains)
    const boundaryTaskId: TaskId = `${jobId}_CFD_BOUNDARY_EXCHANGE`;
    tasks.push({
      taskId: boundaryTaskId,
      jobId,
      partitionId: partitions,
      dependencies: subDomainTaskIds,
      inputHash: this.computeHash(`${jobId}_CFD_BOUNDARY`),
      requiredCapabilities: ['CFD_KERNEL_BOUNDARY'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        partitionCount: partitions,
        boundaryExchangeMode: 'CONSERVATIVE_INTERFACE_FLUX',
      },
    });

    // Stage 3: Field Aggregation Task
    const aggregateTaskId: TaskId = `${jobId}_CFD_AGGREGATE`;
    tasks.push({
      taskId: aggregateTaskId,
      jobId,
      partitionId: partitions + 1,
      dependencies: [boundaryTaskId],
      inputHash: this.computeHash(`${jobId}_CFD_AGGREGATE`),
      requiredCapabilities: ['RESULT_AGGREGATION'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        totalCells,
        assemblyMode: 'FIELD_ASSEMBLY',
      },
    });
  }

  /**
   * FEM Workload Decomposition: Partition element group stiffness matrices, solve local displacements, assemble global system
   */
  private decomposeFemWorkload(
    jobId: JobId,
    partitions: number,
    totalElements: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const elementsPerPartition = Math.ceil(totalElements / partitions);
    const femPartTaskIds: TaskId[] = [];

    for (let p = 0; p < partitions; p++) {
      const taskId: TaskId = `${jobId}_FEM_PART_${p}`;
      femPartTaskIds.push(taskId);

      const elemStart = p * elementsPerPartition;
      const elemEnd = Math.min(totalElements, (p + 1) * elementsPerPartition);

      tasks.push({
        taskId,
        jobId,
        partitionId: p,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_FEM_${p}_${elemStart}_${elemEnd}`),
        requiredCapabilities: ['FEM_KERNEL_QUAD4', 'GPU_LINEAR_ALGEBRA'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: {
          partitionIndex: p,
          elemStart,
          elemEnd,
          elementCount: elemEnd - elemStart,
          youngsModulusPa: payload.youngsModulusPa || 210e9,
          poissonsRatio: payload.poissonsRatio || 0.3,
          thicknessM: payload.thicknessM || 0.005,
        },
      });
    }

    // Assembly Task
    const assemblyTaskId: TaskId = `${jobId}_FEM_GLOBAL_ASSEMBLY`;
    tasks.push({
      taskId: assemblyTaskId,
      jobId,
      partitionId: partitions,
      dependencies: femPartTaskIds,
      inputHash: this.computeHash(`${jobId}_FEM_ASSEMBLY`),
      requiredCapabilities: ['FEM_GLOBAL_SOLVER'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        totalElements,
        assemblyMode: 'STIFFNESS_REDUCTION',
      },
    });
  }

  /**
   * Mesh Workload Decomposition
   */
  private decomposeMeshWorkload(
    jobId: JobId,
    partitions: number,
    totalElements: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const perPart = Math.ceil(totalElements / partitions);
    const meshTaskIds: TaskId[] = [];

    for (let p = 0; p < partitions; p++) {
      const taskId: TaskId = `${jobId}_MESH_PART_${p}`;
      meshTaskIds.push(taskId);

      tasks.push({
        taskId,
        jobId,
        partitionId: p,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_MESH_${p}`),
        requiredCapabilities: ['MESH_QUALITY_KERNEL'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: {
          partitionIndex: p,
          elementRange: [p * perPart, Math.min(totalElements, (p + 1) * perPart)],
          meshQualityTarget: payload.targetAspect || 1.15,
        },
      });
    }

    // Aggregation
    tasks.push({
      taskId: `${jobId}_MESH_QUALITY_REPORT`,
      jobId,
      partitionId: partitions,
      dependencies: meshTaskIds,
      inputHash: this.computeHash(`${jobId}_MESH_REPORT`),
      requiredCapabilities: ['RESULT_AGGREGATION'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        totalElements,
      },
    });
  }

  /**
   * Design Space Exploration Sweep (PATCH-275 Integration)
   */
  private decomposeDesignSpaceSweep(
    jobId: JobId,
    partitions: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const candidates = payload.candidates || Array.from({ length: partitions }, (_, i) => ({ candidateId: i + 1 }));
    const sweepTaskIds: TaskId[] = [];

    candidates.forEach((cand: any, idx: number) => {
      const taskId: TaskId = `${jobId}_DESIGN_CAND_${idx}`;
      sweepTaskIds.push(taskId);

      tasks.push({
        taskId,
        jobId,
        partitionId: idx,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_DESIGN_${idx}_${JSON.stringify(cand)}`),
        requiredCapabilities: ['DESIGN_EVALUATOR'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: {
          candidateIndex: idx,
          candidateConfig: cand,
        },
      });
    });

    // Pareto Optimal Front Aggregator Task
    tasks.push({
      taskId: `${jobId}_PARETO_OPTIMAL_FRONT`,
      jobId,
      partitionId: candidates.length,
      dependencies: sweepTaskIds,
      inputHash: this.computeHash(`${jobId}_PARETO`),
      requiredCapabilities: ['PARETO_AGGREGATOR'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        objectiveWeights: payload.objectiveWeights || [0.5, 0.5],
      },
    });
  }

  /**
   * CAM Toolpath Batching
   */
  private decomposeCamToolpathBatch(
    jobId: JobId,
    partitions: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const toolpaths = payload.toolpaths || Array.from({ length: partitions }, (_, i) => ({ toolpathId: i + 1 }));
    const batchTaskIds: TaskId[] = [];

    toolpaths.forEach((tp: any, idx: number) => {
      const taskId: TaskId = `${jobId}_CAM_TP_${idx}`;
      batchTaskIds.push(taskId);

      tasks.push({
        taskId,
        jobId,
        partitionId: idx,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_CAM_${idx}`),
        requiredCapabilities: ['CAM_FEEDRATE_KERNEL'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: {
          toolpathIndex: idx,
          toolpathData: tp,
        },
      });
    });

    // G-Code Verification & Verification Gate
    tasks.push({
      taskId: `${jobId}_CAM_GCODE_VERIFY`,
      jobId,
      partitionId: toolpaths.length,
      dependencies: batchTaskIds,
      inputHash: this.computeHash(`${jobId}_CAM_VERIFY`),
      requiredCapabilities: ['GCODE_VERIFIER'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: {
        safetyGateEnforced: true,
      },
    });
  }

  private decomposeGenericWorkload(
    jobId: JobId,
    partitions: number,
    totalCount: number,
    payload: Record<string, any>,
    tasks: DistributedTask[]
  ): void {
    const genericTaskIds: TaskId[] = [];
    for (let p = 0; p < partitions; p++) {
      const taskId = `${jobId}_TASK_${p}`;
      genericTaskIds.push(taskId);
      tasks.push({
        taskId,
        jobId,
        partitionId: p,
        dependencies: [],
        inputHash: this.computeHash(`${jobId}_GENERIC_${p}`),
        requiredCapabilities: ['GENERIC_COMPUTE'],
        status: 'PENDING',
        retryCount: 0,
        maxRetries: 3,
        progress: 0,
        inputPayload: { partitionIndex: p, payload },
      });
    }

    tasks.push({
      taskId: `${jobId}_GENERIC_REDUCE`,
      jobId,
      partitionId: partitions,
      dependencies: genericTaskIds,
      inputHash: this.computeHash(`${jobId}_GENERIC_REDUCE`),
      requiredCapabilities: ['RESULT_AGGREGATION'],
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
      inputPayload: { reduceMode: 'CONCATENATE' },
    });
  }

  /**
   * Kahn's Algorithm Cycle Detection for Task DAG
   */
  public detectCycle(tasks: DistributedTask[]): boolean {
    const inDegree: Map<TaskId, number> = new Map();
    const adjList: Map<TaskId, TaskId[]> = new Map();

    tasks.forEach((t) => {
      inDegree.set(t.taskId, 0);
      adjList.set(t.taskId, []);
    });

    tasks.forEach((t) => {
      t.dependencies.forEach((depId) => {
        if (adjList.has(depId)) {
          adjList.get(depId)!.push(t.taskId);
          inDegree.set(t.taskId, (inDegree.get(t.taskId) || 0) + 1);
        }
      });
    });

    const queue: TaskId[] = [];
    inDegree.forEach((deg, taskId) => {
      if (deg === 0) queue.push(taskId);
    });

    let visitedCount = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      visitedCount++;

      const neighbors = adjList.get(current) || [];
      neighbors.forEach((nbr) => {
        const currentInDeg = (inDegree.get(nbr) || 0) - 1;
        inDegree.set(nbr, currentInDeg);
        if (currentInDeg === 0) {
          queue.push(nbr);
        }
      });
    }

    return visitedCount !== tasks.length;
  }

  private computeHash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `sha256_${hash.toString(16).padStart(8, '0')}`;
  }
}
