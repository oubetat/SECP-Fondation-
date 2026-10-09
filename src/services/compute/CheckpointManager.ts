import { EngineeringTask, EngineeringCheckpoint } from '../../engine/engineering_compute/types';

export class CheckpointManager {
  private static checkpoints = new Map<string, EngineeringCheckpoint>();

  public static createCheckpoint(
    task: EngineeringTask,
    iteration: number,
    solverState: Record<string, any>,
    workerId: string,
    resourceId: string
  ): EngineeringCheckpoint {
    const cp: EngineeringCheckpoint = {
      checkpointId: `CP-${task.taskId}-${iteration}-${Date.now()}`,
      taskId: task.taskId,
      taskState: task.state,
      inputHash: `in-hash-${JSON.stringify(task.inputs)}`,
      partialOutputHash: `part-hash-${iteration}`,
      solverState,
      iteration,
      timeStep: iteration * 0.01,
      workerId,
      resourceId,
      timestamp: new Date().toISOString()
    };

    this.checkpoints.set(cp.checkpointId, cp);
    return cp;
  }

  public static getCheckpoint(checkpointId: string): EngineeringCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  public static resumeFromCheckpoint(
    checkpointId: string,
    currentTaskInputs: Record<string, any>
  ): { valid: boolean; checkpoint?: EngineeringCheckpoint; error?: string } {
    const cp = this.checkpoints.get(checkpointId);
    if (!cp) {
      return { valid: false, error: 'CHECKPOINT_NOT_FOUND' };
    }

    const currentHash = `in-hash-${JSON.stringify(currentTaskInputs)}`;
    if (cp.inputHash !== currentHash) {
      return { valid: false, error: 'CHECKPOINT_INPUT_MISMATCH' };
    }

    return { valid: true, checkpoint: cp };
  }
}
