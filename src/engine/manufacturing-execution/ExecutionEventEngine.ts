import { ManufacturingExecutionEvent } from './ManufacturingExecutionTypes';

export class ExecutionEventEngine {
  public static computeEventProvenance(event: ManufacturingExecutionEvent): string {
    const payload = JSON.stringify({
      eventId: event.eventId,
      executionSessionId: event.executionSessionId,
      jobId: event.jobId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      previousState: event.previousState,
      newState: event.newState,
      source: event.source
    });

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }

    return `SECP-060-EVENT-PROV-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
