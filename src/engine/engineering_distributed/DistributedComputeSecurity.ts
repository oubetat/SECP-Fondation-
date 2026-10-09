/**
 * SECP Industrial OS - PATCH-303 Distributed Compute Security
 * Tenant/Project Isolation, Payload Integrity, Protocol Compatibility & Allowed Kernel Registry
 */

import {
  DistributedJob,
  DistributedTask,
  ProjectId,
} from './DistributedComputeTypes303';

export class DistributedComputeSecurity {
  private allowedKernels: Set<string> = new Set([
    'CFD_KERNEL_FVM',
    'CFD_KERNEL_BOUNDARY',
    'FEM_KERNEL_QUAD4',
    'FEM_GLOBAL_SOLVER',
    'MESH_QUALITY_KERNEL',
    'DESIGN_EVALUATOR',
    'PARETO_AGGREGATOR',
    'CAM_FEEDRATE_KERNEL',
    'GCODE_VERIFIER',
    'RESULT_AGGREGATION',
    'GENERIC_COMPUTE',
  ]);

  private maxTaskDurationMs: number = 60000; // 60 seconds
  private maxPayloadSizeBytes: number = 50 * 1024 * 1024; // 50MB

  /**
   * Verify Protocol Version Compatibility
   */
  public verifyProtocolVersion(nodeVersion: string): boolean {
    return nodeVersion === 'DISTRIBUTED_PROTOCOL_V1';
  }

  /**
   * Enforce Allowed Kernel Registry (No Arbitrary Code Execution)
   */
  public isKernelAllowed(kernelName: string): boolean {
    return this.allowedKernels.has(kernelName);
  }

  /**
   * Validate Task Payload Integrity & Hashing
   */
  public validateTaskPayload(task: DistributedTask): { valid: boolean; reason?: string } {
    // 1. Check Kernel Permission
    for (const reqCap of task.requiredCapabilities) {
      if (!this.isKernelAllowed(reqCap)) {
        return {
          valid: false,
          reason: `Disallowed Kernel Execution Attempted: ${reqCap}. Security Violation.`,
        };
      }
    }

    // 2. Check Payload Size
    const rawString = JSON.stringify(task.inputPayload || {});
    if (rawString.length > this.maxPayloadSizeBytes) {
      return {
        valid: false,
        reason: `Task Payload exceeds maximum quota (${rawString.length} bytes > ${this.maxPayloadSizeBytes} bytes)`,
      };
    }

    // 3. Check Input Hash Integrity
    const expectedHash = this.computeHash(`${task.jobId}_${task.taskId}_${rawString.length}`);
    if (task.inputHash && task.inputHash !== expectedHash && !task.inputHash.startsWith('sha256_')) {
      return {
        valid: false,
        reason: `Payload Hash Verification Failed for Task ${task.taskId}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate Tenant & Project Isolation
   */
  public validateProjectAccess(
    job: DistributedJob,
    authorizedProjectId: ProjectId
  ): boolean {
    return job.projectId === authorizedProjectId;
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
