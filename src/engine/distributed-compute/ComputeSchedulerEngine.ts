/**
 * PATCH-SECP-068: Compute Scheduler Engine
 * Handles deterministic assignment of jobs to optimal workers.
 */

import { EngineeringJob, ComputeWorker } from './EngineeringComputeTypes';
import { WorkerCapabilityEngine } from './WorkerCapabilityEngine';

export class ComputeSchedulerEngine {
  public static schedule(job: EngineeringJob, availableWorkers: ComputeWorker[]): string | null {
    // Deterministic selection: Pick worker with highest trust score that matches capabilities
    const compatible = availableWorkers
      .filter(w => WorkerCapabilityEngine.isCompatible(job, w))
      .sort((a, b) => b.trustScore - a.trustScore || a.workerId.localeCompare(b.workerId));

    return compatible.length > 0 ? compatible[0].workerId : null;
  }
}
