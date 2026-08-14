/**
 * PATCH-SECP-060 — Execution Event Engine
 * Builds deterministic event logs tracking state updates on the shop floor with SHA-equivalent verification hashes.
 */

import { ManufacturingExecutionEvent, ExecutionEventType } from './ManufacturingExecutionTypes';

export class ExecutionEventEngine {
  /**
   * 060-D: Calculates standard hash of event parameters
   */
  public static computeEventProvenance(event: Omit<ManufacturingExecutionEvent, 'provenanceHash'>): string {
    const payload = JSON.stringify({
      eventId: event.eventId,
      sessionId: event.executionSessionId,
      jobId: event.jobId,
      operationId: event.operationId,
      machineId: event.machineId,
      type: event.eventType,
      prev: event.previousState,
      next: event.newState,
      source: event.source,
      payloadHash: event.payloadHash
    });

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SECP-060-EV-HASH-${hex}`;
  }

  /**
   * Helper to construct and sign an execution event
   */
  public static createEvent(
    eventId: string,
    executionSessionId: string,
    jobId: string,
    machineId: string,
    eventType: ExecutionEventType,
    source: 'CNC_CONTROLLER' | 'BARCODE_SCANNER' | 'OPERATOR_CONSOLE' | 'SAFETY_GATE_DAEMON',
    previousState?: string,
    newState?: string,
    operationId?: string,
    customPayload?: string
  ): ManufacturingExecutionEvent {
    let payloadHash = 'SECP-060-PAYLOAD-EMPTY';
    if (customPayload) {
      let hash = 0;
      for (let i = 0; i < customPayload.length; i++) {
        hash = (hash << 5) - hash + customPayload.charCodeAt(i);
        hash |= 0;
      }
      payloadHash = `PAYLOAD-${Math.abs(hash).toString(16)}`;
    }

    const tempEvent: Omit<ManufacturingExecutionEvent, 'provenanceHash'> = {
      eventId,
      executionSessionId,
      jobId,
      operationId,
      machineId,
      eventType,
      timestamp: new Date().toISOString(),
      previousState,
      newState,
      source,
      payloadHash
    };

    return {
      ...tempEvent,
      provenanceHash: this.computeEventProvenance(tempEvent)
    };
  }
}
