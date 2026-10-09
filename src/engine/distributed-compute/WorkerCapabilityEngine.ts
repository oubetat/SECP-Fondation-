/**
 * PATCH-SECP-068: Worker Capability Engine
 * Validates compatibility between jobs and workers.
 */

import { EngineeringJob, ComputeWorker } from './EngineeringComputeTypes';

export class WorkerCapabilityEngine {
  public static isCompatible(job: EngineeringJob, worker: ComputeWorker): boolean {
    // 1. Check Capabilities
    const hasCaps = job.requiredCapabilities.every(cap => worker.capabilities.includes(cap));
    if (!hasCaps) return false;

    // 2. Check Resources
    const hasCpu = worker.availableResources.cpuCores >= job.executionPolicy.resourceLimits.cpuCores;
    const hasMem = worker.availableResources.memoryMb >= job.executionPolicy.resourceLimits.memoryMb;
    
    return hasCpu && hasMem;
  }
}
