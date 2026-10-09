/**
 * SECP Industrial OS - PATCH-301: Engineering Worker Scheduler
 * High-performance task scheduler with DAG resolution, concurrency tracking,
 * deterministic multi-physics reduction, and scaling benchmark engines.
 */

import {
  WorkerTaskModel,
  TaskResult,
  SchedulerPolicy,
  ConcurrencyProof,
  ConcurrencyOverlapInterval,
  ScalingBenchmarkPoint,
  ParallelismStatusSeparation,
  TaskPriority
} from './WorkerTypes301';
import { EngineeringTaskQueue } from './EngineeringTaskQueue';
import { EngineeringWorkerPool } from './EngineeringWorkerPool';
import {
  CFDResidualResult,
  FEMElementResult,
  MeshPartitionResult,
  CAMToolpathChunkResult,
  ParameterSweepResult
} from './WorkerDomainCompute';

export class EngineeringWorkerScheduler {
  private queue: EngineeringTaskQueue;
  private pool: EngineeringWorkerPool;
  private policy: SchedulerPolicy = 'PRIORITY';
  private executionHistory: ConcurrencyOverlapInterval[] = [];
  private taskResults: Map<string, TaskResult> = new Map();
  private isProcessing: boolean = false;
  private activeDispatches: Promise<any>[] = [];

  constructor(workerCount?: number, maxQueueLength?: number) {
    this.queue = new EngineeringTaskQueue(maxQueueLength || 300);
    this.pool = new EngineeringWorkerPool(workerCount || 4);
  }

  public getPool(): EngineeringWorkerPool {
    return this.pool;
  }

  public getQueue(): EngineeringTaskQueue {
    return this.queue;
  }

  public setPolicy(p: SchedulerPolicy): void {
    this.policy = p;
  }

  public getPolicy(): SchedulerPolicy {
    return this.policy;
  }

  public submitTask(task: WorkerTaskModel): void {
    this.queue.enqueue(task);
    this.scheduleNext();
  }

  public async submitAndAwaitTask(task: WorkerTaskModel): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const res = this.taskResults.get(task.taskId);
        if (res) {
          if (res.status === 'COMPLETED') resolve(res);
          else if (res.status === 'CANCELLED') reject(new Error(`Task ${task.taskId} was cancelled.`));
          else reject(new Error(`Task ${task.taskId} failed: ${res.errors?.[0]?.message || 'Unknown error'}`));
        } else {
          setTimeout(checkCompletion, 10);
        }
      };

      try {
        this.queue.enqueue(task);
        this.scheduleNext();
        checkCompletion();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async runBatch(tasks: WorkerTaskModel[]): Promise<TaskResult[]> {
    for (const t of tasks) {
      this.queue.enqueue(t);
    }
    await this.processQueueUntilEmpty();

    const results: TaskResult[] = [];
    for (const t of tasks) {
      const res = this.taskResults.get(t.taskId);
      if (res) results.push(res);
    }
    return results;
  }

  public async processQueueUntilEmpty(): Promise<void> {
    while (this.queue.getLength() > 0 || this.pool.getBusyWorkerCount() > 0) {
      this.scheduleNext();
      await new Promise(r => setTimeout(r, 10));
    }
  }

  private scheduleNext(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.getLength() > 0) {
        const availableWorker = this.pool.getAvailableWorker();
        if (!availableWorker) break;

        const task = this.queue.dequeue(this.policy);
        if (!task) break;

        const dispatchPromise = (async () => {
          const tStart = performance.now();
          try {
            const result = await this.pool.executeOnWorker(availableWorker, task);
            const tEnd = performance.now();

            this.executionHistory.push({
              taskId: task.taskId,
              workerId: availableWorker.workerId,
              start: tStart,
              end: tEnd,
              durationMs: tEnd - tStart
            });

            this.taskResults.set(task.taskId, result);

            if (result.status === 'COMPLETED') {
              this.queue.notifyTaskCompleted(task.taskId);
            } else if (result.status === 'FAILED') {
              this.queue.notifyTaskFailed(task.taskId);
            } else if (result.status === 'CANCELLED') {
              this.queue.notifyTaskCancelled(task.taskId);
            }
          } catch (err: any) {
            this.queue.notifyTaskFailed(task.taskId);
          } finally {
            // Trigger further scheduling as worker is now free
            setTimeout(() => this.scheduleNext(), 0);
          }
        })();

        this.activeDispatches.push(dispatchPromise);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public getConcurrencyProof(): ConcurrencyProof {
    const history = [...this.executionHistory];
    if (history.length < 2) {
      return {
        measuredConcurrency: history.length,
        requestedConcurrency: this.pool.getWorkerCount(),
        overlapDetected: false,
        overlappingIntervals: history,
        activeWorkersCount: this.pool.getWorkerCount(),
        isRealParallelism: false
      };
    }

    // Detect overlapping intervals: (StartA <= EndB) and (StartB <= EndA) on different workers
    let maxOverlap = 1;
    let overlapFound = false;

    for (let i = 0; i < history.length; i++) {
      let currentOverlap = 1;
      for (let j = 0; j < history.length; j++) {
        if (i === j) continue;
        const a = history[i];
        const b = history[j];

        if (a.workerId !== b.workerId) {
          // Check overlap
          if (a.start < b.end && b.start < a.end) {
            overlapFound = true;
            currentOverlap++;
          }
        }
      }
      if (currentOverlap > maxOverlap) {
        maxOverlap = currentOverlap;
      }
    }

    return {
      measuredConcurrency: Math.min(this.pool.getWorkerCount(), maxOverlap),
      requestedConcurrency: this.pool.getWorkerCount(),
      overlapDetected: overlapFound,
      overlappingIntervals: history.slice(-20),
      activeWorkersCount: this.pool.getWorkerCount(),
      isRealParallelism: overlapFound && maxOverlap >= 2
    };
  }

  public clearHistory(): void {
    this.executionHistory = [];
    this.taskResults.clear();
  }

  // ==========================================
  // DETERMINISTIC MULTI-PHYSICS REDUCTIONS
  // ==========================================

  public static reduceCFDResults(results: CFDResidualResult[]): {
    totalCells: number;
    globalMaxResidualU: number;
    globalMaxResidualV: number;
    globalMaxResidualW: number;
    globalMaxResidualP: number;
    globalL2NormResidual: number;
    mergedPressureField: Float64Array;
  } {
    // Sort results by cellOffset for deterministic aggregation regardless of completion order
    const sorted = [...results].sort((a, b) => a.cellOffset - b.cellOffset);

    let totalCells = 0;
    for (const r of sorted) totalCells += r.cellCount;

    const mergedP = new Float64Array(totalCells);
    let maxRu = 0, maxRv = 0, maxRw = 0, maxRp = 0, sumSq = 0;

    for (const r of sorted) {
      mergedP.set(r.updatedPressure, r.cellOffset);
      if (r.maxResidualU > maxRu) maxRu = r.maxResidualU;
      if (r.maxResidualV > maxRv) maxRv = r.maxResidualV;
      if (r.maxResidualW > maxRw) maxRw = r.maxResidualW;
      if (r.maxResidualP > maxRp) maxRp = r.maxResidualP;
      sumSq += (r.l2NormResidual * r.l2NormResidual) * r.cellCount;
    }

    return {
      totalCells,
      globalMaxResidualU: maxRu,
      globalMaxResidualV: maxRv,
      globalMaxResidualW: maxRw,
      globalMaxResidualP: maxRp,
      globalL2NormResidual: Math.sqrt(sumSq / Math.max(1, totalCells)),
      mergedPressureField: mergedP
    };
  }

  public static reduceFEMResults(results: FEMElementResult[]): {
    totalElements: number;
    globalMaxVonMisesStress: number;
    mergedStresses: Float64Array;
    mergedStrains: Float64Array;
  } {
    const sorted = [...results].sort((a, b) => a.elementOffset - b.elementOffset);
    let totalElem = 0;
    for (const r of sorted) totalElem += r.elementCount;

    const stresses = new Float64Array(totalElem);
    const strains = new Float64Array(totalElem);
    let maxStress = 0;

    for (const r of sorted) {
      stresses.set(r.elementStresses, r.elementOffset);
      strains.set(r.elementStrains, r.elementOffset);
      if (r.maxVonMisesStress > maxStress) maxStress = r.maxVonMisesStress;
    }

    return {
      totalElements: totalElem,
      globalMaxVonMisesStress: maxStress,
      mergedStresses: stresses,
      mergedStrains: strains
    };
  }

  public static reduceMeshResults(results: MeshPartitionResult[]): {
    totalVertices: number;
    totalTriangles: number;
    mergedVertices: Float32Array;
    mergedTriangles: Int32Array;
    mergedNormals: Float32Array;
    globalAvgAspectRatio: number;
    globalWorstSkewness: number;
  } {
    const sorted = [...results].sort((a, b) => a.patchId - b.patchId);
    let totalVerts = 0;
    let totalTris = 0;

    for (const r of sorted) {
      totalVerts += r.vertexCount;
      totalTris += r.triangleCount;
    }

    const mergedV = new Float32Array(totalVerts * 3);
    const mergedT = new Int32Array(totalTris * 3);
    const mergedN = new Float32Array(totalVerts * 3);

    let vertOffset = 0;
    let triOffset = 0;
    let sumAspect = 0;
    let worstSkew = 0;

    for (const r of sorted) {
      mergedV.set(r.vertices, vertOffset * 3);
      mergedN.set(r.normals, vertOffset * 3);

      // Shift triangle vertex indices by vertOffset
      for (let t = 0; t < r.triangleCount * 3; t++) {
        mergedT[triOffset * 3 + t] = r.triangles[t] + vertOffset;
      }

      sumAspect += r.avgAspectRatio * r.triangleCount;
      if (r.worstSkewness > worstSkew) worstSkew = r.worstSkewness;

      vertOffset += r.vertexCount;
      triOffset += r.triangleCount;
    }

    return {
      totalVertices: totalVerts,
      totalTriangles: totalTris,
      mergedVertices: mergedV,
      mergedTriangles: mergedT,
      mergedNormals: mergedN,
      globalAvgAspectRatio: sumAspect / Math.max(1, totalTris),
      globalWorstSkewness: worstSkew
    };
  }

  public static reduceCAMResults(results: CAMToolpathChunkResult[]): {
    totalPoints: number;
    totalMachiningTimeSec: number;
    totalDistanceMm: number;
    anyCollisionDetected: boolean;
    maxGougeDepthMm: number;
  } {
    const sorted = [...results].sort((a, b) => a.chunkIndex - b.chunkIndex);
    let totalPts = 0;
    let totalTime = 0;
    let totalDist = 0;
    let collision = false;
    let maxGouge = 0;

    for (const r of sorted) {
      totalPts += r.pointCount;
      totalTime += r.machiningTimeSeconds;
      totalDist += r.totalDistanceMm;
      if (r.collisionDetected) collision = true;
      if (r.maxGougeDepthMm > maxGouge) maxGouge = r.maxGougeDepthMm;
    }

    return {
      totalPoints: totalPts,
      totalMachiningTimeSec: totalTime,
      totalDistanceMm: totalDist,
      anyCollisionDetected: collision,
      maxGougeDepthMm: maxGouge
    };
  }

  // ==========================================
  // SCALING BENCHMARK HARNESS (1, 2, 4, 8)
  // ==========================================

  public async runScalingBenchmark(iterationsPerTask: number = 80000, taskCount: number = 8): Promise<ScalingBenchmarkPoint[]> {
    const counts = [1, 2, 4, 8];
    const points: ScalingBenchmarkPoint[] = [];

    // Measure serial baseline (1 worker)
    this.pool.resizePool(1);
    this.clearHistory();

    const serialTasks = this.generateBenchmarkTasks(taskCount, iterationsPerTask);
    const t0 = performance.now();
    await this.runBatch(serialTasks);
    const serialTime = performance.now() - t0;

    points.push({
      workerCount: 1,
      executionTimeMs: serialTime,
      speedup: 1.0,
      efficiency: 1.0,
      throughputOpsPerSec: (taskCount * iterationsPerTask) / (serialTime / 1000)
    });

    // Measure for 2, 4, 8 workers
    for (const wc of [2, 4, 8]) {
      this.pool.resizePool(wc);
      this.clearHistory();

      const benchTasks = this.generateBenchmarkTasks(taskCount, iterationsPerTask);
      const tStart = performance.now();
      await this.runBatch(benchTasks);
      const parTime = performance.now() - tStart;

      const speedup = serialTime / Math.max(1, parTime);
      const efficiency = speedup / wc;

      points.push({
        workerCount: wc,
        executionTimeMs: parTime,
        speedup,
        efficiency,
        throughputOpsPerSec: (taskCount * iterationsPerTask) / (parTime / 1000)
      });
    }

    // Reset to default 4 workers
    this.pool.resizePool(4);
    return points;
  }

  private generateBenchmarkTasks(count: number, iterations: number): WorkerTaskModel[] {
    const tasks: WorkerTaskModel[] = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        taskId: `BENCH-${i + 1}-${Math.random().toString(36).substring(2, 6)}`,
        taskType: 'BENCHMARK',
        payload: { iterations },
        priority: 'NORMAL',
        dependencies: [],
        resourceRequirements: { estimatedCostOps: iterations },
        executionPolicy: { timeoutMs: 10000 },
        inputHash: `0xbench${i}`,
        createdAt: Date.now()
      });
    }
    return tasks;
  }
}
