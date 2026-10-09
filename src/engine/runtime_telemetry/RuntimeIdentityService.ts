import { TelemetryEvent, RuntimeSession, JobRuntimeTelemetry } from './types';
import { CanonicalTelemetrySerializer } from './CanonicalTelemetrySerializer';

export class RuntimeIdentityService {
  
  public static verifySchemaValidation(event: TelemetryEvent): { valid: boolean; error?: string } {
    if (!event.schemaVersion) {
      return { valid: false, error: 'SCHEMA_INVALID: Missing schemaVersion' };
    }
    // Simplistic check for testing
    if (event.schemaVersion !== '1.0' && event.schemaVersion !== '2.0') {
      return { valid: false, error: `SCHEMA_INVALID: Unsupported schema version ${event.schemaVersion}` };
    }
    return { valid: true };
  }

  public static verifySequenceIntegrity(events: TelemetryEvent[]): { valid: boolean; error?: string } {
    if (events.length === 0) return { valid: true };
    
    let maxSeenSeq = events[0].sequenceNumber - 1;
    const seenEvents = new Set<string>();

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      if (seenEvents.has(evt.eventId)) {
        return { valid: false, error: 'DUPLICATE_EVENT' };
      }
      seenEvents.add(evt.eventId);

      if (evt.sequenceNumber <= maxSeenSeq) {
        return { valid: false, error: 'OUT_OF_ORDER' };
      }
      if (evt.sequenceNumber > maxSeenSeq + 1) {
        return { valid: false, error: 'MISSING_EVENT' };
      }
      maxSeenSeq = Math.max(maxSeenSeq, evt.sequenceNumber);
    }
    return { valid: true };
  }

  public static verifyTimestampIntegrity(event: TelemetryEvent, currentSystemTime: string): { valid: boolean; error?: string } {
    const evTime = new Date(event.timestamp).getTime();
    const sysTime = new Date(currentSystemTime).getTime();
    
    // Future timestamp check
    if (evTime > sysTime + 60000) { // allow 60s skew
      return { valid: false, error: 'FUTURE_TIMESTAMP' };
    }
    
    // Simplistic stale check (older than 1 year)
    if (evTime < sysTime - 31536000000) {
      return { valid: false, error: 'STALE_TIMESTAMP' };
    }

    return { valid: true };
  }

  public static detectReplayAttack(event: TelemetryEvent, seenEventHashes: Set<string>): { valid: boolean; error?: string } {
    if (seenEventHashes.has(event.eventHash)) {
      return { valid: false, error: 'REPLAY_DETECTED' };
    }
    return { valid: true };
  }

  public static verifyConfigurationMatch(recordedConfigHash: string, runtimeConfigHash: string): { valid: boolean; error?: string } {
    if (recordedConfigHash !== runtimeConfigHash) {
      return { valid: false, error: 'CONFIGURATION_MISMATCH' };
    }
    return { valid: true };
  }

  public static verifyJobCompletionIntegrity(job: JobRuntimeTelemetry, requiredEvents: TelemetryEvent[]): { valid: boolean; error?: string } {
    if (job.status === 'COMPLETED') {
      if (!job.outputHash) {
        return { valid: false, error: 'RUNTIME_VERDICT_INTEGRITY_FAILURE: Fake COMPLETED without outputHash' };
      }
      if (requiredEvents.length === 0) {
        return { valid: false, error: 'RUNTIME_VERDICT_INTEGRITY_FAILURE: Fake COMPLETED without events' };
      }
    }
    return { valid: true };
  }

  public static enforceMetricUnit(value: number, unit: string, requiredUnit: string): number {
    if (unit !== requiredUnit) {
      throw new Error(`UNIT_MISMATCH: Metric expected unit ${requiredUnit}, got ${unit}`);
    }
    return value;
  }
}
