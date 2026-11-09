import { ManufacturingExecutionEvent, ManufacturedPartInstance } from './ManufacturingExecutionTypes';

export class ExecutionProvenanceEngine {
  public static createPartInstance(
    partInstanceId: string,
    partId: string,
    partRevision: string,
    parentJobId: string,
    serialNumber: string,
    lotId: string,
    toolUsedIds: string[],
    machineUsedId: string,
    clDataHash: string,
    ncProgramHash: string
  ): ManufacturedPartInstance {
    return {
      partInstanceId,
      partId,
      partRevision,
      parentJobId,
      serialNumber,
      lotId,
      toolUsedIds,
      machineUsedId,
      clDataHash,
      ncProgramHash,
      timestampCompleted: new Date().toISOString()
    };
  }
  public static signPartInstance(partSerial: string, sessionId: string, operatorId: string): string {
    const payload = `${partSerial}:${sessionId}:${operatorId}:${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return `PART-SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
  }

  public static sealSessionLogs(events: ManufacturingExecutionEvent[]): string {
    const payload = events.map(e => e.provenanceHash || '').join('->');
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }

    return `SECP-060-CHAIN-SEAL-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
