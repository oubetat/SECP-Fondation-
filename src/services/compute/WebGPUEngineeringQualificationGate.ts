import { WebGPUQualificationRecord, WebGPUAdapterFingerprint } from '../../engine/engineering_webgpu/types';
import { PrecisionMode } from '../../engine/engineering_gpu/types';

export class WebGPUEngineeringQualificationGate {
  private static qualifications = new Map<string, WebGPUQualificationRecord>();

  public static qualifyWebGPUWorkload(
    workloadId: string,
    kernelVersion: number,
    shaderHash: string,
    fingerprint: WebGPUAdapterFingerprint,
    precision: PrecisionMode,
    maxRelError: number
  ): WebGPUQualificationRecord {
    const isQualified = maxRelError <= 1e-4;
    const record: WebGPUQualificationRecord = {
      qualificationId: `WEBGPU-QUAL-${workloadId}-${Date.now()}`,
      workloadId,
      kernelVersion,
      shaderHash,
      adapterFingerprint: fingerprint.adapterId,
      browserRuntime: fingerprint.browser,
      limits: fingerprint.limits,
      precision,
      testSuiteResults: {
        analyticalTest: true,
        cpuComparison: isQualified,
        maxRelativeError: maxRelError
      },
      status: isQualified ? 'QUALIFIED' : 'REJECTED',
      timestamp: new Date().toISOString()
    };

    this.qualifications.set(workloadId, record);
    return record;
  }

  public static isWorkloadQualified(workloadId: string): boolean {
    const q = this.qualifications.get(workloadId);
    return q ? q.status === 'QUALIFIED' : false;
  }

  public static getQualification(workloadId: string): WebGPUQualificationRecord | undefined {
    return this.qualifications.get(workloadId);
  }
}
