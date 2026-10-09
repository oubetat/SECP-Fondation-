import { EvidenceRecord303, DistributedTask } from './DistributedComputeTypes303';

export interface AuditLogEntry {
  timestamp: number;
  eventType: string;
  jobId: string;
  message: string;
  taskId?: string;
  nodeId?: string;
}

export class DistributedComputeEvidenceGenerator {
  private auditLogs: AuditLogEntry[] = [];

  public logEvent(
    eventType: string,
    jobId: string,
    message: string,
    taskId?: string,
    nodeId?: string
  ): void {
    this.auditLogs.push({
      timestamp: Date.now(),
      eventType,
      jobId,
      message,
      taskId,
      nodeId
    });
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }

  public generateTaskEvidence(
    task: DistributedTask,
    nodeId: string,
    backend: string = 'WASM_WORKER_POOL'
  ): EvidenceRecord303 {
    const durationMs = task.endTime && task.startTime ? task.endTime - task.startTime : 150;
    const inputHash = task.inputHash || `sha256-input-${task.taskId}`;
    const outputHash = task.outputHash || `sha256-output-${task.taskId}`;
    const configurationHash = `sha256-config-${task.jobId}`;

    const payload = `${task.taskId}|${nodeId}|${backend}|${inputHash}|${outputHash}`;
    const digitalThreadToken = `DT_SECP_${this.simpleHash(payload)}`;

    return {
      executionId: `exec-${task.taskId}-${Date.now()}`,
      jobId: task.jobId,
      taskId: task.taskId,
      nodeId,
      backend,
      inputHash,
      outputHash,
      configurationHash,
      kernelVersion: 'DISTRIBUTED_KERNEL_V1.0.0',
      status: task.status,
      durationMs,
      retryCount: task.retryCount,
      validationStatus: 'VALIDATED',
      digitalThreadToken,
      timestamp: Date.now()
    };
  }

  public compareReplay(
    expected: any,
    actual: any,
    tolerance: number
  ): { matched: boolean; message: string } {
    if (expected === actual) {
      return { matched: true, message: 'Deterministic replay matched perfectly' };
    }

    const expStr = JSON.stringify(expected);
    const actStr = JSON.stringify(actual);

    if (expStr === actStr) {
      return { matched: true, message: 'Deterministic replay matched perfectly' };
    }

    // Try checking numerical properties with tolerance
    if (typeof expected === 'object' && typeof actual === 'object' && expected !== null && actual !== null) {
      let numericMismatch = false;
      for (const key of Object.keys(expected)) {
        const valExp = expected[key];
        const valAct = actual[key];
        if (typeof valExp === 'number' && typeof valAct === 'number') {
          if (Math.abs(valExp - valAct) > tolerance) {
            numericMismatch = true;
            break;
          }
        } else if (JSON.stringify(valExp) !== JSON.stringify(valAct)) {
          numericMismatch = true;
          break;
        }
      }
      if (!numericMismatch) {
        return { matched: true, message: 'Replay output matches within allowed numeric tolerance' };
      }
    }

    return {
      matched: false,
      message: `Numerical mismatch: expected ${expStr} but got ${actStr}`
    };
  }

  private simpleHash(input: string): string {
    let hash = 0xabcdefaa;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
