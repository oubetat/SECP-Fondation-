/**
 * SECP Industrial OS - PATCH-302: WasmWorkerBridge
 * Integrates WebAssembly Native Compute with PATCH-301 Worker Parallelism Pool.
 * Enables fault-isolated, multi-threaded parallel execution of WASM kernels across worker threads.
 */

import { EngineeringWorkerScheduler } from '../engineering_workers/EngineeringWorkerScheduler';
import { WorkerTaskModel } from '../engineering_workers/WorkerTypes301';
import { WasmComputeRuntime } from './WasmComputeRuntime';
import { WasmDomain, WasmExecutionMode, WasmTaskModel } from './WasmTypes302';

export class WasmWorkerBridge {
  private scheduler: EngineeringWorkerScheduler;
  private runtime: WasmComputeRuntime;

  constructor(scheduler?: EngineeringWorkerScheduler) {
    this.scheduler = scheduler || new EngineeringWorkerScheduler(4, 500);
    this.runtime = WasmComputeRuntime.getInstance();
  }

  public getScheduler(): EngineeringWorkerScheduler {
    return this.scheduler;
  }

  /**
   * Dispatches a batch of WASM tasks across the Worker Parallelism Pool
   */
  public async executeWasmTasksParallel(
    tasks: Array<{ domain: WasmDomain; payload: any; taskId: string }>
  ): Promise<any[]> {
    const workerTasks: WorkerTaskModel[] = tasks.map(t => ({
      taskId: t.taskId,
      taskType: t.domain === 'CFD' ? 'CFD' : t.domain === 'FEM' ? 'FEM' : t.domain === 'MESH' ? 'MESH' : 'NUMERICAL_INTEGRATION',
      payload: t.payload,
      priority: 'HIGH',
      dependencies: [],
      resourceRequirements: { estimatedCostOps: 10000 },
      executionPolicy: { deterministicReduction: true },
      inputHash: `0xwasm_${t.taskId}`,
      createdAt: Date.now()
    }));

    const results = await this.scheduler.runBatch(workerTasks);
    return results.map(r => r.result);
  }

  /**
   * Runs a scaling benchmark of WASM tasks over 1, 2, 4, 8 workers
   */
  public async runWasmScalingBenchmark(
    tasksCount: number = 16
  ): Promise<Array<{ workers: number; durationMs: number; speedup: number; efficiency: number }>> {
    const workerCounts = [1, 2, 4, 8];
    const results: Array<{ workers: number; durationMs: number; speedup: number; efficiency: number }> = [];
    let baseTime = 0;

    for (const count of workerCounts) {
      this.scheduler.getPool().resizePool(count);

      const tasks: Array<{ domain: WasmDomain; payload: any; taskId: string }> = [];
      for (let i = 0; i < tasksCount; i++) {
        tasks.push({
          taskId: `WASM_WORKER_TASK_${i + 1}`,
          domain: 'LINALG',
          payload: {
            op: 'DOT',
            a: new Float64Array(10000).fill(1.5),
            b: new Float64Array(10000).fill(2.5)
          }
        });
      }

      const t0 = performance.now();
      await this.executeWasmTasksParallel(tasks);
      const durationMs = performance.now() - t0;

      if (count === 1) {
        baseTime = durationMs;
      }

      const speedup = baseTime / Math.max(0.001, durationMs);
      const efficiency = speedup / count;

      results.push({
        workers: count,
        durationMs,
        speedup,
        efficiency
      });
    }

    return results;
  }
}
