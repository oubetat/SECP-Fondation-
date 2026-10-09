import { GPUDevice, GPUExecutionEvidence } from '../../engine/engineering_gpu/types';
import { GPUBackend } from './GPUBackend';
import { ComputeExecutionParams } from './ComputeBackend';

export class GPUExecutionFuture {
  public id: string;
  public status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  public result?: any;
  public evidence?: GPUExecutionEvidence;
  public error?: string;

  constructor(id: string) {
    this.id = id;
    this.status = 'PENDING';
  }
}

export class MultiGPUExecutor {
  private devices: GPUDevice[];

  constructor(devices: GPUDevice[]) {
    this.devices = devices;
  }

  public async executeMultiGPUJob(params: ComputeExecutionParams): Promise<{
    completedFutures: GPUExecutionFuture[];
    aggregatedResult: number;
    evidenceList: GPUExecutionEvidence[];
  }> {
    const futures: GPUExecutionFuture[] = [];
    const evidenceList: GPUExecutionEvidence[] = [];
    let aggregatedResult = 0;

    for (let i = 0; i < this.devices.length; i++) {
      const dev = this.devices[i];
      const future = new GPUExecutionFuture(`FUTURE-${dev.deviceId}-${i}`);
      future.status = 'RUNNING';

      const backend = new GPUBackend('CUDA', dev);
      const res = await backend.execute(params);

      if (res.success && res.outputs) {
        future.status = 'COMPLETED';
        future.result = res.outputs;
        future.evidence = res.evidence;
        if (res.evidence) evidenceList.push(res.evidence);
        aggregatedResult += res.outputs.resultValue || 0;
      } else {
        future.status = 'FAILED';
        future.error = res.error;
      }

      futures.push(future);
    }

    return { completedFutures: futures, aggregatedResult, evidenceList };
  }
}
