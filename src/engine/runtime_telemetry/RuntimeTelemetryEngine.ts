import { 
  RuntimeSession, 
  TelemetryEvent, 
  RuntimeResourceSnapshot, 
  JobRuntimeTelemetry 
} from './types';
import { CanonicalTelemetrySerializer } from './CanonicalTelemetrySerializer';

export class RuntimeTelemetryEngine {
  public createSession(
    runtimeSessionId: string, 
    appVersion: string, 
    buildId: string, 
    configurationHash: string, 
    hostId: string,
    environment: string
  ): RuntimeSession {
    const sessionHash = CanonicalTelemetrySerializer.computeRuntimeIdentityHash(
      appVersion, buildId, configurationHash, hostId, environment, 'N/A'
    );
    return {
      runtimeSessionId,
      startTime: new Date().toISOString(),
      environment,
      deploymentVersion: appVersion,
      gitCommit: 'abcd123',
      buildId,
      configurationHash,
      hostId,
      operatorId: 'OP-01',
      sessionHash,
      state: 'RUNNING'
    };
  }

  public createEvent(
    eventId: string,
    runtimeSessionId: string,
    sequenceNumber: number,
    eventType: string,
    payload: any,
    previousEventHash: string
  ): TelemetryEvent {
    const payloadStr = CanonicalTelemetrySerializer.canonicalizeEventPayload(payload);
    const payloadHash = CanonicalTelemetrySerializer.sha256(payloadStr);
    const metadataStr = `${runtimeSessionId}|${sequenceNumber}|${eventType}`;
    const eventHash = CanonicalTelemetrySerializer.computeEventHash(payloadHash, metadataStr, previousEventHash);

    return {
      eventId,
      runtimeSessionId,
      timestamp: new Date().toISOString(),
      sequenceNumber,
      eventType,
      source: 'RuntimeEngine',
      schemaVersion: '1.0',
      payload,
      payloadHash,
      previousEventHash,
      eventHash
    };
  }
}
