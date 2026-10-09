/**
 * SECP Industrial OS - PATCH-301: Engineering Task Queue
 * Prioritized, fair-scheduled task queue with DAG dependency graph resolution,
 * cycle detection, backpressure enforcement, and anti-starvation age promotion.
 */

import {
  WorkerTaskModel,
  TaskPriority,
  TaskStatus,
  SchedulerPolicy
} from './WorkerTypes301';

export class EngineeringTaskQueue {
  private readonly maxQueueLength: number;
  private readonly maxTaskMemoryBytes: number;
  private queue: WorkerTaskModel[] = [];
  private taskStatusMap: Map<string, TaskStatus> = new Map();
  private taskRegistry: Map<string, WorkerTaskModel> = new Map();
  private completedTaskIds: Set<string> = new Set();
  private failedTaskIds: Set<string> = new Set();
  private starvationWaitThresholdMs: number = 5000;

  constructor(maxQueueLength: number = 250, maxTaskMemoryBytes: number = 512 * 1024 * 1024) {
    this.maxQueueLength = maxQueueLength;
    this.maxTaskMemoryBytes = maxTaskMemoryBytes;
  }

  public getLength(): number {
    return this.queue.length;
  }

  public getCapacity(): number {
    return this.maxQueueLength;
  }

  public getAllTasks(): WorkerTaskModel[] {
    return [...this.queue];
  }

  public getTaskStatus(taskId: string): TaskStatus | undefined {
    return this.taskStatusMap.get(taskId);
  }

  public getTask(taskId: string): WorkerTaskModel | undefined {
    return this.taskRegistry.get(taskId);
  }

  public enqueue(task: WorkerTaskModel): void {
    if (this.queue.length >= this.maxQueueLength) {
      throw new Error(`QUEUE_BACKPRESSURE: Maximum task queue limit (${this.maxQueueLength}) reached.`);
    }

    if (task.resourceRequirements.memoryRequirementBytes && task.resourceRequirements.memoryRequirementBytes > this.maxTaskMemoryBytes) {
      throw new Error(`RESOURCE_ERROR: Task memory requirement (${task.resourceRequirements.memoryRequirementBytes} B) exceeds maximum task limit (${this.maxTaskMemoryBytes} B).`);
    }

    this.taskRegistry.set(task.taskId, task);

    // Validate DAG cycles with this new task
    this.validateNoCycles(task);

    // Check if task has unfulfilled dependencies
    const hasUnfulfilledDeps = task.dependencies.some(depId => !this.completedTaskIds.has(depId));

    if (hasUnfulfilledDeps) {
      this.taskStatusMap.set(task.taskId, 'BLOCKED');
    } else {
      this.taskStatusMap.set(task.taskId, 'QUEUED');
      this.queue.push(task);
    }
  }

  public dequeue(policy: SchedulerPolicy = 'PRIORITY', filterFn?: (task: WorkerTaskModel) => boolean): WorkerTaskModel | null {
    if (this.queue.length === 0) return null;

    let candidateIdx = -1;
    const now = Date.now();

    if (policy === 'FIFO') {
      for (let i = 0; i < this.queue.length; i++) {
        if (!filterFn || filterFn(this.queue[i])) {
          candidateIdx = i;
          break;
        }
      }
    } else {
      // PRIORITY or FAIR (with anti-starvation age score)
      let bestScore = -Infinity;

      for (let i = 0; i < this.queue.length; i++) {
        const task = this.queue[i];
        if (filterFn && !filterFn(task)) continue;

        const priorityBase = this.getPriorityScore(task.priority);
        const ageMs = now - task.createdAt;
        const antiStarvationBonus = policy === 'FAIR' ? (ageMs / this.starvationWaitThresholdMs) * 1.5 : 0;
        const totalScore = priorityBase + antiStarvationBonus;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          candidateIdx = i;
        }
      }
    }

    if (candidateIdx >= 0) {
      const [task] = this.queue.splice(candidateIdx, 1);
      this.taskStatusMap.set(task.taskId, 'DISPATCHED');
      return task;
    }

    return null;
  }

  public notifyTaskCompleted(taskId: string): WorkerTaskModel[] {
    this.completedTaskIds.add(taskId);
    this.taskStatusMap.set(taskId, 'COMPLETED');
    const unblockedTasks: WorkerTaskModel[] = [];

    // Check all registered blocked tasks to see if they can now be queued
    for (const [id, status] of this.taskStatusMap.entries()) {
      if (status === 'BLOCKED') {
        const task = this.taskRegistry.get(id);
        if (task) {
          const allDepsSatisfied = task.dependencies.every(depId => this.completedTaskIds.has(depId));
          if (allDepsSatisfied) {
            this.taskStatusMap.set(id, 'QUEUED');
            this.queue.push(task);
            unblockedTasks.push(task);
          }
        }
      }
    }

    return unblockedTasks;
  }

  public notifyTaskFailed(taskId: string): string[] {
    this.failedTaskIds.add(taskId);
    this.taskStatusMap.set(taskId, 'FAILED');
    const cascadeFailedIds: string[] = [];

    // Cascade fail all tasks that depend on this failed task
    for (const [id, status] of this.taskStatusMap.entries()) {
      if (status === 'BLOCKED' || status === 'QUEUED') {
        const task = this.taskRegistry.get(id);
        if (task && task.dependencies.includes(taskId)) {
          this.taskStatusMap.set(id, 'FAILED');
          cascadeFailedIds.push(id);
          // Remove from queue if it was queued
          const qIdx = this.queue.findIndex(t => t.taskId === id);
          if (qIdx >= 0) this.queue.splice(qIdx, 1);
        }
      }
    }

    return cascadeFailedIds;
  }

  public notifyTaskCancelled(taskId: string): void {
    this.taskStatusMap.set(taskId, 'CANCELLED');
    const qIdx = this.queue.findIndex(t => t.taskId === taskId);
    if (qIdx >= 0) this.queue.splice(qIdx, 1);
  }

  public clear(): void {
    this.queue = [];
    this.taskStatusMap.clear();
    this.taskRegistry.clear();
    this.completedTaskIds.clear();
    this.failedTaskIds.clear();
  }

  public detectCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const check = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const task = this.taskRegistry.get(nodeId);
      if (task) {
        for (const depId of task.dependencies) {
          if (!visited.has(depId) && check(depId)) return true;
          if (recStack.has(depId)) return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const taskId of this.taskRegistry.keys()) {
      if (!visited.has(taskId)) {
        if (check(taskId)) return true;
      }
    }

    return false;
  }

  private validateNoCycles(newTask: WorkerTaskModel): void {
    // Temporary test with newTask added
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const check = (nodeId: string, depth: number = 0): boolean => {
      if (depth > 50) return true; // prevent infinite loop
      visited.add(nodeId);
      recStack.add(nodeId);

      const task = nodeId === newTask.taskId ? newTask : this.taskRegistry.get(nodeId);
      if (task) {
        for (const depId of task.dependencies) {
          if (depId === newTask.taskId) return true; // Direct circular dependency
          if (!visited.has(depId) && check(depId, depth + 1)) return true;
          if (recStack.has(depId)) return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    if (check(newTask.taskId)) {
      this.taskRegistry.delete(newTask.taskId);
      throw new Error(`DAG_CYCLE_DETECTED: Task ${newTask.taskId} introduces a circular dependency in DAG.`);
    }
  }

  private getPriorityScore(p: TaskPriority): number {
    switch (p) {
      case 'CRITICAL': return 1000;
      case 'HIGH': return 500;
      case 'NORMAL': return 100;
      case 'LOW': return 10;
      default: return 0;
    }
  }
}
