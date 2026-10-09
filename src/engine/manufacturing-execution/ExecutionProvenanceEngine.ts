import { ManufacturingExecutionEvent } from './ManufacturingExecutionTypes';

export class ExecutionProvenanceEngine {
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
