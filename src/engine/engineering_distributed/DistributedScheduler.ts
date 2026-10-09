/**
 * SECP Industrial OS - PATCH-303 Distributed Scheduler & Load Balancer
 * Priority Queues, Capability-Aware Scheduling, Least-Loaded Selection, Task Leases & Backpressure
 */

import { ComputeNodeRegistry } from './ComputeNodeRegistry';
import {
  ComputeNode,
  DistributedJob,
  DistributedTask,
  JobId,
  NodeId,
  PriorityLevel,
  TaskId,
  TaskLease,
} from './DistributedComputeTypes303';

export class DistributedScheduler {
  private registry: ComputeNodeRegistry;
  private highQueue: DistributedTask[] = [];
  private normalQueue: DistributedTask[] = [];
  private lowQueue: DistributedTask[] = [];

  private activeLeases: Map<TaskId, TaskLease> = new Map();
  private defaultLeaseDurationMs: number = 10000;
  private maxConcurrentTasksPerNode: number = 8;

  constructor(registry: ComputeNodeRegistry) {
    this.registry = registry;
  }

  /**
   * Enqueue a task based on job priority
   */
  public enqueueTask(task: DistributedTask, priority: PriorityLevel = 'NORMAL'): void {
    task.status = 'PENDING';
    if (priority === 'HIGH') {
      this.highQueue.push(task);
    } else if (priority === 'LOW') {
      this.lowQueue.push(task);
    } else {
      this.normalQueue.push(task);
    }
  }

  /**
   * Pop the next ready task from the highest priority queue
   */
  public popNextReadyTask(completedTaskIds: Set<TaskId>): DistributedTask | null {
    const checkQueue = (queue: DistributedTask[]): DistributedTask | null => {
      for (let i = 0; i < queue.length; i++) {
        const task = queue[i];
        // All dependencies must be completed
        const depsMet = task.dependencies.every((dep) => completedTaskIds.has(dep));
        if (depsMet && (task.status === 'PENDING' || task.status === 'READY')) {
          queue.splice(i, 1);
          task.status = 'READY';
          return task;
        }
      }
      return null;
    };

    return (
      checkQueue(this.highQueue) ||
      checkQueue(this.normalQueue) ||
      checkQueue(this.lowQueue)
    );
  }

  /**
   * Least-Loaded & Capability-Aware Node Selection
   */
  public selectBestNodeForTask(
    task: DistributedTask,
    reqCpu: number = 1,
    reqMemBytes: number = 128 * 1024 * 1024,
    reqGpu: boolean = false,
    reqWasm: boolean = false
  ): ComputeNode | null {
    const availableNodes = this.registry.getAvailableNodes();

    // Filter matching capabilities
    const eligibleNodes = availableNodes.filter((node) => {
      if (node.activeTasks.length >= this.maxConcurrentTasksPerNode) return false;
      return this.registry.matchesCapabilities(
        node.nodeId,
        task.requiredCapabilities,
        reqCpu,
        reqMemBytes,
        reqGpu,
        reqWasm
      );
    });

    if (eligibleNodes.length === 0) {
      return null; // Backpressure: no node available
    }

    // Sort by Least-Loaded (active task count / capacity + reserved CPU ratio)
    eligibleNodes.sort((a, b) => {
      const loadA =
        a.activeTasks.length / Math.max(1, a.capabilities.workerCount) +
        a.accounting.reservedCpuCores / Math.max(1, a.capabilities.cpuCores);
      const loadB =
        b.activeTasks.length / Math.max(1, b.capabilities.workerCount) +
        b.accounting.reservedCpuCores / Math.max(1, b.capabilities.cpuCores);
      return loadA - loadB;
    });

    return eligibleNodes[0];
  }

  /**
   * Dispatch task to node and issue lease
   */
  public dispatchTaskToNode(
    task: DistributedTask,
    node: ComputeNode,
    reqCpu: number = 1,
    reqMemBytes: number = 128 * 1024 * 1024
  ): TaskLease {
    task.assignedNodeId = node.nodeId;
    task.status = 'DISPATCHED';

    const reserved = this.registry.reserveResources(
      node.nodeId,
      task.taskId,
      reqCpu,
      reqMemBytes
    );

    if (!reserved) {
      throw new Error(`Failed to reserve resources on Node ${node.nodeId} for Task ${task.taskId}`);
    }

    // Create lease for split-brain protection
    const lease: TaskLease = {
      leaseId: `LEASE_${task.taskId}_${Date.now()}`,
      taskId: task.taskId,
      nodeId: node.nodeId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.defaultLeaseDurationMs,
      renewalCount: 0,
    };

    task.lease = lease;
    this.activeLeases.set(task.taskId, lease);
    task.status = 'RUNNING';

    return lease;
  }

  /**
   * Renew lease during execution
   */
  public renewTaskLease(taskId: TaskId, nodeId: NodeId): boolean {
    const lease = this.activeLeases.get(taskId);
    if (!lease || lease.nodeId !== nodeId) return false;

    lease.expiresAt = Date.now() + this.defaultLeaseDurationMs;
    lease.renewalCount++;
    return true;
  }

  /**
   * Check expired leases and revoke assignments for unresponsive workers
   */
  public revokeExpiredLeases(): TaskId[] {
    const now = Date.now();
    const expired: TaskId[] = [];

    for (const [taskId, lease] of this.activeLeases.entries()) {
      if (now > lease.expiresAt) {
        expired.push(taskId);
        this.activeLeases.delete(taskId);
      }
    }
    return expired;
  }

  /**
   * Remove lease upon task completion
   */
  public releaseLease(taskId: TaskId): void {
    this.activeLeases.delete(taskId);
  }

  public getQueueDepth(): { high: number; normal: number; low: number; total: number } {
    return {
      high: this.highQueue.length,
      normal: this.normalQueue.length,
      low: this.lowQueue.length,
      total: this.highQueue.length + this.normalQueue.length + this.lowQueue.length,
    };
  }

  public clearQueues(): void {
    this.highQueue = [];
    this.normalQueue = [];
    this.lowQueue = [];
    this.activeLeases.clear();
  }
}
