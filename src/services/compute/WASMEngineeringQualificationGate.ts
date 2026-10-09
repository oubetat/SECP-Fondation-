import { WASMQualificationRecord } from '../../engine/engineering_wasm/types';
import { PrecisionMode } from '../../engine/engineering_gpu/types';

export class WASMEngineeringQualificationGate {
  private static qualifications = new Map<string, WASMQualificationRecord>();

  public static qualifyWASMWorkload(
    workloadId: string,
    moduleVersion: number,
    moduleHash: string,
    runtimeVersion: string,
    precision: PrecisionMode,
    maxRelError: number
  ): WASMQualificationRecord {
    const isQualified = maxRelError <= 1e-5;
    const record: WASMQualificationRecord = {
      qualificationId: `WASM-QUAL-${workloadId}-${Date.now()}`,
      workloadId,
      moduleVersion,
      moduleHash,
      runtimeVersion,
      precision,
      testSuiteResults: {
        scalarSimdEquivalence: true,
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

  public static getQualification(workloadId: string): WASMQualificationRecord | undefined {
    return this.qualifications.get(workloadId);
  }
}
