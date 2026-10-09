/**
 * PATCH-SECP-068: Compute Package Engine
 * Bundles the complete distributed compute digital thread.
 */

import { 
  ComputePackage, 
  EngineeringJob, 
  ComputeWorker, 
  ExecutionRecord, 
  ComputeResult, 
  ComputeProvenanceRecord 
} from './EngineeringComputeTypes';

export class ComputePackageEngine {
  public static bundle(
    job: EngineeringJob,
    worker: ComputeWorker,
    execution: ExecutionRecord,
    result: ComputeResult,
    provenance: ComputeProvenanceRecord
  ): ComputePackage {
    return {
      packageId: `comp-pkg-${job.jobId}`,
      job,
      worker,
      execution,
      result,
      provenance
    };
  }
}
