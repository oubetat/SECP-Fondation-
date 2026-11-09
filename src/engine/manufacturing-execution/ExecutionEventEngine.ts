import { ManufacturingExecutionEvent } from './ManufacturingExecutionTypes';

export class ExecutionEventEngine {
  public static createEvent(
    eventId: string,
    executionSessionId: string,
    jobId: string,
    machineId: string,
    eventType: any,
    source: string,
    previousState?: any,
    newState?: any,
    errorCode?: string,
    message?: string
  ): ManufacturingExecutionEvent {
    const event: ManufacturingExecutionEvent = {
      eventId,
      executionSessionId,
      jobId,
      machineId,
      eventType,
      timestamp: new Date().toISOString(),
      source,
      previousState,
      newState,
      errorCode,
      message,
      provenanceHash: ''
    };
    event.provenanceHash = ExecutionEventEngine.computeEventProvenance(event);
    return event;
  }

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
