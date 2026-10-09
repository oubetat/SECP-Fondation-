/**
 * PATCH-SECP-068: Compute Worker Registry Engine
 * Manages identity, health, and trust status of compute nodes.
 */

import { ComputeWorker, WorkerStatus } from './EngineeringComputeTypes';

export class ComputeWorkerRegistryEngine {
  private static workers: Map<string, ComputeWorker> = new Map();

  public static registerWorker(worker: ComputeWorker): void {
    this.workers.set(worker.workerId, worker);
  }

  public static getWorker(workerId: string): ComputeWorker | undefined {
    return this.workers.get(workerId);
  }

  public static updateStatus(workerId: string, status: WorkerStatus): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = status;
      worker.lastHeartbeat = new Date().toISOString();
    }
  }

  public static listAvailableWorkers(requiredCapabilities: string[]): ComputeWorker[] {
    return Array.from(this.workers.values()).filter(w => 
      (w.status === 'ACTIVE' || w.status === 'IDLE') &&
      requiredCapabilities.every(cap => w.capabilities.includes(cap))
    );
  }
}
