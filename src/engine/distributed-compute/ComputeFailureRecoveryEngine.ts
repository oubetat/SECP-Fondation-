/**
 * PATCH-SECP-068: Compute Failure Recovery Engine
 * Manages retry policies and worker failure handling.
 */

import { EngineeringJob } from './EngineeringComputeTypes';

export class ComputeFailureRecoveryEngine {
  public static shouldRetry(job: EngineeringJob, currentRetries: number): boolean {
    return currentRetries < job.executionPolicy.maxRetries;
  }

  public static handleWorkerFailure(job: EngineeringJob): EngineeringJob {
    return {
      ...job,
      status: 'RETRYING'
    };
  }
}
