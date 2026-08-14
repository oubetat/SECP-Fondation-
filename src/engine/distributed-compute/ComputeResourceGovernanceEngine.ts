/**
 * PATCH-SECP-068: Compute Resource Governance Engine
 * Enforces resource budgets and prevents worker over-consumption.
 */

import { EngineeringJob, ComputeWorker } from './EngineeringComputeTypes';

export class ComputeResourceGovernanceEngine {
  public static checkBudgetViolation(
    job: EngineeringJob,
    actualCpu: number,
    actualMem: number
  ): boolean {
    const cpuLimit = job.executionPolicy.resourceLimits.cpuCores;
    const memLimit = job.executionPolicy.resourceLimits.memoryMb;

    return actualCpu > cpuLimit || actualMem > memLimit;
  }
}
