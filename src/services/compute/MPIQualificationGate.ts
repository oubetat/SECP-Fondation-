import { MPIQualificationRecord } from '../../engine/engineering_hpc/mpi_types';

export class MPIQualificationGate {
  private static records = new Map<string, MPIQualificationRecord>();

  public static qualifyRuntime(
    implementation: string,
    version: string,
    transport: string,
    rankCount: number,
    latencyMs: number,
    bandwidthGBs: number
  ): MPIQualificationRecord {
    const isQualified = latencyMs < 0.01 && bandwidthGBs > 10;
    
    const record: MPIQualificationRecord = {
      qualificationId: `MPI-QUAL-${Date.now()}`,
      mpiVersion: `${implementation} ${version}`,
      transport,
      rankCount,
      latencyMs,
      bandwidthGBs,
      status: isQualified ? 'QUALIFIED' : 'FAILED'
    };

    this.records.set(record.qualificationId, record);
    return record;
  }

  public static isQualified(qualificationId: string): boolean {
    const q = this.records.get(qualificationId);
    return q ? q.status === 'QUALIFIED' : false;
  }
}
