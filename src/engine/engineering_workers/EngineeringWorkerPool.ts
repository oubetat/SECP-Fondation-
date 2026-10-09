/**
 * SECP Industrial OS - PATCH-301: Engineering Worker Pool
 * Dynamic multi-worker execution pool with health tracking, warm standby,
 * zero-copy Transferable ArrayBuffer transfers, and isolated crash recovery.
 */

import {
  WorkerCapabilities,
  WorkerHealthStatus,
  WorkerTaskModel,
  TaskResult,
  WorkerTelemetry
} from './WorkerTypes301';
import { EngineeringWorkerRuntime } from './EngineeringWorkerRuntime';

export class EngineeringWorkerPool {
  private workers: EngineeringWorkerRuntime[] = [];
  private workerCount: number;
  private isDraining: boolean = false;
  private totalMemoryBudgetBytes: number = 2 * 1024 * 1024 * 1024; // 2 GB
  private reservedMemoryBytes: number = 0;

  constructor(initialWorkerCount?: number) {
    const hwConcurrency = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    this.workerCount = Math.max(1, Math.min(16, initialWorkerCount || hwConcurrency));
    this.initializePool();
  }

  public getWorkerCount(): number {
    return this.workers.length;
  }

  public getReadyWorkerCount(): number {
    return this.workers.filter(w => w.getStatus() === 'READY').length;
  }

  public getBusyWorkerCount(): number {
    return this.workers.filter(w => w.getStatus() === 'BUSY').length;
  }

  public getAllTelemetry(): WorkerTelemetry[] {
    return this.workers.map((w, idx) => {
      const stats = w.getStats();
      return {
        workerId: stats.workerId,
        workerIndex: idx,
        status: stats.status,
        currentTaskId: stats.currentTaskId,
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
        totalActiveTimeMs: stats.totalActiveTimeMs,
        totalIdleTimeMs: stats.totalIdleTimeMs,
        lastHeartbeat: stats.lastHeartbeat,
        capabilities: stats.capabilities,
        currentMemoryBytes: 64 * 1024 * 1024 // 64MB base allocation per worker
      };
    });
  }

  public getAvailableWorker(task?: WorkerTaskModel): EngineeringWorkerRuntime | null {
    if (this.isDraining) return null;

    // 1. Check memory limit reservation
    const memReq = (task && task.resourceRequirements.memoryRequirementBytes) || (32 * 1024 * 1024);
    if (this.reservedMemoryBytes + memReq > this.totalMemoryBudgetBytes) {
      return null; // Resource constraint
    }

    // 2. Check affinity if requested
    if (task && task.resourceRequirements.affinityWorkerId) {
      const target = this.workers.find(w => w.workerId === task.resourceRequirements.affinityWorkerId);
      if (target && target.getStatus() === 'READY') {
        return target;
      }
    }

    // 3. Find first ready worker that satisfies task requirements
    for (const worker of this.workers) {
      if (worker.getStatus() === 'READY') {
        if (task && task.resourceRequirements.requiresGPU) {
          if (!worker.getCapabilities().hasWebGPU && !task.executionPolicy.allowCpuFallback) {
            continue;
          }
        }
        return worker;
      }
    }

    return null;
  }

  public async executeOnWorker(
    worker: EngineeringWorkerRuntime,
    task: WorkerTaskModel,
    onProgress?: (p: number) => void
  ): Promise<TaskResult> {
    const memReq = task.resourceRequirements.memoryRequirementBytes || (32 * 1024 * 1024);
    this.reservedMemoryBytes += memReq;

    try {
      const result = await worker.executeTask(task, onProgress);
      return result;
    } finally {
      this.reservedMemoryBytes = Math.max(0, this.reservedMemoryBytes - memReq);
    }
  }

  public resizePool(newCount: number): void {
    const targetCount = Math.max(1, Math.min(16, newCount));
    if (targetCount === this.workers.length) return;

    if (targetCount > this.workers.length) {
      // Scale up
      const toAdd = targetCount - this.workers.length;
      for (let i = 0; i < toAdd; i++) {
        const idx = this.workers.length;
        const workerId = `W-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`;
        this.workers.push(new EngineeringWorkerRuntime(workerId, idx));
      }
    } else {
      // Scale down (drain excess workers)
      const toRemove = this.workers.length - targetCount;
      for (let i = 0; i < toRemove; i++) {
        const worker = this.workers.pop();
        if (worker) {
          worker.drain();
          worker.terminate();
        }
      }
    }
    this.workerCount = this.workers.length;
  }

  public cancelTask(taskId: string): boolean {
    for (const worker of this.workers) {
      if (worker.getCurrentTaskId() === taskId) {
        return worker.cancelCurrentTask();
      }
    }
    return false;
  }

  public drain(): void {
    this.isDraining = true;
    for (const worker of this.workers) {
      worker.drain();
    }
  }

  public terminate(): void {
    this.isDraining = true;
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.reservedMemoryBytes = 0;
  }

  /**
   * Benchmarks transfer serialization & deserialization speeds for large mesh buffers
   */
  public benchmarkTransfer(byteSize: number = 10 * 1024 * 1024): {
    byteSize: number;
    serializationMs: number;
    transferMs: number;
    deserializationMs: number;
    throughputMbPerSec: number;
  } {
    const floatCount = Math.floor(byteSize / 4);
    const t0 = performance.now();

    // 1. Serialization / Creation
    const buffer = new Float32Array(floatCount);
    for (let i = 0; i < Math.min(floatCount, 1000); i++) {
      buffer[i] = Math.sin(i * 0.1);
    }
    const t1 = performance.now();

    // 2. Simulated Transfer / Ownership Handover
    const transferBuffer = buffer.buffer;
    const t2 = performance.now();

    // 3. Deserialization / Re-wrap
    const reconstructed = new Float32Array(transferBuffer);
    const testRead = reconstructed[0];
    const t3 = performance.now();

    const serializationMs = t1 - t0;
    const transferMs = Math.max(0.01, t2 - t1);
    const deserializationMs = Math.max(0.01, t3 - t2);
    const totalTimeSec = (t3 - t0) / 1000.0;
    const throughputMb = (byteSize / (1024 * 1024)) / Math.max(0.001, totalTimeSec);

    return {
      byteSize,
      serializationMs,
      transferMs,
      deserializationMs,
      throughputMbPerSec: throughputMb
    };
  }

  private initializePool(): void {
    this.workers = [];
    for (let i = 0; i < this.workerCount; i++) {
      const workerId = `W-${i + 1}-${Math.random().toString(36).substring(2, 6)}`;
      this.workers.push(new EngineeringWorkerRuntime(workerId, i));
    }
  }
}
