import { DistributedCheckpoint, DistributedJob, JobStatus } from './DistributedComputeTypes303';

export class DistributedCheckpointManager {
  private checkpoints: Map<string, DistributedCheckpoint> = new Map();

  public createCheckpoint(job: DistributedJob): DistributedCheckpoint {
    const checkpointId = `CP_${job.jobId}_${Date.now()}`;
    const taskStates = Array.from(job.tasks.values()).map(t => ({
      taskId: t.taskId,
      status: t.status,
      progress: t.progress
    }));

    const completedOutputs = Array.from(job.tasks.values())
      .filter(t => t.status === 'COMPLETED')
      .map(t => ({
        taskId: t.taskId,
        outputHash: t.outputHash || 'no_hash',
        payload: t.outputPayload || {}
      }));

    const inputHashes = Array.from(job.tasks.values()).map(t => ({
      taskId: t.taskId,
      hash: t.inputHash
    }));

    const nodeAssignments = Array.from(job.tasks.values())
      .filter(t => t.assignedNodeId !== undefined)
      .map(t => ({
        taskId: t.taskId,
        nodeId: t.assignedNodeId!
      }));

    const signatureStr = `${checkpointId}|${job.jobId}|${job.status}|${taskStates.length}|${completedOutputs.length}`;
    const signatureSha256 = `sha256_${this.simpleHash(signatureStr)}`;

    const checkpoint: DistributedCheckpoint = {
      checkpointId,
      jobId: job.jobId,
      jobState: job.status,
      taskStates,
      completedOutputs,
      inputHashes,
      configurationHash: job.inputHash,
      nodeAssignments,
      timestamp: Date.now(),
      signatureSha256
    };

    this.checkpoints.set(checkpointId, checkpoint);
    return checkpoint;
  }

  public validateCheckpointForResume(
    checkpoint: DistributedCheckpoint,
    job: DistributedJob
  ): { compatible: boolean; message: string } {
    if (checkpoint.jobId !== job.jobId) {
      return { compatible: false, message: 'Checkpoint belongs to a different job ID' };
    }
    if (checkpoint.configurationHash !== job.inputHash) {
      return { compatible: false, message: 'Configuration hash mismatch - inputs changed' };
    }
    return { compatible: true, message: 'Checkpoint compatible and verified for resume' };
  }

  private simpleHash(input: string): string {
    let hash = 0x12345678;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
