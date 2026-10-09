/**
 * SECP Industrial OS - PATCH-303 Distributed Fault Recovery Engine
 * Node & Task Failure Classification, Exponential Retries, Node Replacement & Failure Propagation
 */

import { ComputeNodeRegistry } from './ComputeNodeRegistry';
import {
  DistributedJob,
  DistributedTask,
  FailureCategory,
  JobId,
  NodeId,
  TaskId,
} from './DistributedComputeTypes303';

export class DistributedFaultRecoveryEngine {
  private registry: ComputeNodeRegistry;
  private committedTaskOutputs: Set<TaskId> = new Set();

  constructor(registry: ComputeNodeRegistry) {
    this.registry = registry;
  }

  /**
   * Classify failure root cause
   */
  public classifyFailure(
    errorMessage: string,
    isNodeCrash: boolean = false
  ): FailureCategory {
    if (isNodeCrash || errorMessage.includes('UNRESPONSIVE') || errorMessage.includes('TIMEOUT')) {
      return 'TRANSIENT';
    }
    if (errorMessage.includes('OUT_OF_MEMORY') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      return 'RESOURCE';
    }
    if (errorMessage.includes('NaN') || errorMessage.includes('DIVIDE_BY_ZERO') || errorMessage.includes('DIVERGED')) {
      return 'NUMERICAL';
    }
    if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('BAD_SIGNATURE')) {
      return 'SECURITY';
    }
    return 'LOGICAL';
  }

  /**
   * Handle Task Failure according to policy
   */
  public handleTaskFailure(
    job: DistributedJob,
    task: DistributedTask,
    errorMessage: string,
    isNodeCrash: boolean = false
  ): { action: 'RETRY' | 'FAIL_JOB' | 'PROPAGATE_FAILURE'; targetNodeId?: NodeId; delayMs: number } {
    const category = this.classifyFailure(errorMessage, isNodeCrash);
    task.failureCategory = category;
    task.executionError = errorMessage;

    // Release node resources
    if (task.assignedNodeId) {
      this.registry.releaseResources(task.assignedNodeId, task.taskId, 1, 128 * 1024 * 1024, false);
    }

    // Do NOT retry logical or security failures blindly!
    if (category === 'LOGICAL' || category === 'SECURITY') {
      task.status = 'FAILED';
      this.propagateFailureToDependents(job, task.taskId);
      return { action: 'FAIL_JOB', delayMs: 0 };
    }

    // Check retry limits
    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = 'RETRYING';
      const delayMs = Math.pow(2, task.retryCount) * 100; // Exponential backoff: 200ms, 400ms, 800ms...

      // Assign to a DIFFERENT node if available
      const currentAssigned = task.assignedNodeId;
      task.assignedNodeId = undefined;
      task.lease = undefined;

      return { action: 'RETRY', targetNodeId: currentAssigned, delayMs };
    }

    // Max retries exceeded -> Mark Task Failed and propagate down DAG
    task.status = 'FAILED';
    this.propagateFailureToDependents(job, task.taskId);
    return { action: 'FAIL_JOB', delayMs: 0 };
  }

  /**
   * Propagate failure to all dependent tasks down the DAG
   */
  public propagateFailureToDependents(job: DistributedJob, failedTaskId: TaskId): void {
    job.tasks.forEach((dependentTask) => {
      if (dependentTask.dependencies.includes(failedTaskId) && dependentTask.status !== 'FAILED') {
        dependentTask.status = 'FAILED';
        dependentTask.executionError = `Dependency task ${failedTaskId} failed. Failure propagated down DAG.`;
        // Recursively propagate
        this.propagateFailureToDependents(job, dependentTask.taskId);
      }
    });
  }

  /**
   * Handle complete Node failure: Re-assign all active tasks assigned to that node
   */
  public handleNodeFailure(job: DistributedJob, failedNodeId: NodeId): TaskId[] {
    const reassignedTaskIds: TaskId[] = [];

    job.tasks.forEach((task) => {
      if (task.assignedNodeId === failedNodeId && task.status === 'RUNNING') {
        reassignedTaskIds.push(task.taskId);
        this.handleTaskFailure(job, task, `Assigned Node ${failedNodeId} became UNRESPONSIVE`, true);
      }
    });

    return reassignedTaskIds;
  }

  /**
   * Exactly-Once Commit Protection: Ensures result is committed idempotently
   */
  public commitTaskResultIdempotent(
    task: DistributedTask,
    outputPayload: Record<string, any>,
    outputHash: string
  ): boolean {
    if (this.committedTaskOutputs.has(task.taskId)) {
      // Already committed once -> prevent duplicate commit corruption
      return false;
    }

    task.outputPayload = outputPayload;
    task.outputHash = outputHash;
    task.status = 'COMPLETED';
    task.progress = 100;
    task.endTime = Date.now();

    this.committedTaskOutputs.add(task.taskId);
    return true;
  }

  /**
   * Cancel job and all non-completed tasks
   */
  public cancelJob(job: DistributedJob): void {
    job.status = 'CANCELLED';
    job.tasks.forEach((task) => {
      if (task.status !== 'COMPLETED' && task.status !== 'FAILED') {
        task.status = 'CANCELLED';
        if (task.assignedNodeId) {
          this.registry.releaseResources(task.assignedNodeId, task.taskId, 1, 128 * 1024 * 1024, false);
        }
      }
    });
  }

  public clearCommittedSet(): void {
    this.committedTaskOutputs.clear();
  }
}
