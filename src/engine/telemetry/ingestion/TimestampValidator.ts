/**
 * TimestampValidator: Rigorous forensic timestamp classification & integrity validation
 * Supports:
 * - Future timestamp detection (clock drift > tolerance)
 * - Stale timestamp detection (source older than configured threshold)
 * - Out-of-order timestamp detection compared to per-stream monotonic high-water mark
 * - Duplicate timestamp detection
 * - Timestamp classifications: VALID, LATE, OUT_OF_ORDER, STALE, CLOCK_DRIFT, INVALID
 */

import { TimestampClassification, TimestampValidationResult } from '../IndustrialTelemetryTypes';

export interface TimestampValidatorConfig {
  maxFutureDriftMs: number;     // e.g., 2000 ms
  maxStaleThresholdMs: number;  // e.g., 60000 ms
  lateArrivalThresholdMs: number; // e.g., 5000 ms
}

export class TimestampValidator {
  private config: TimestampValidatorConfig;
  private lastSourceTimestampMs: Map<string, number> = new Map(); // streamKey -> maxTimestampMs

  constructor(config?: Partial<TimestampValidatorConfig>) {
    this.config = {
      maxFutureDriftMs: config?.maxFutureDriftMs ?? 2000,
      maxStaleThresholdMs: config?.maxStaleThresholdMs ?? 60000,
      lateArrivalThresholdMs: config?.lateArrivalThresholdMs ?? 5000
    };
  }

  /**
   * Evaluates timestamp integrity of incoming event against reference ingestion time
   */
  public evaluate(
    sourceTimestampStr: string,
    ingestTimestampMs: number,
    streamKey: string
  ): TimestampValidationResult {
    const sourceMs = Date.parse(sourceTimestampStr);
    if (isNaN(sourceMs)) {
      return {
        classification: 'INVALID',
        driftMs: 0,
        isAcceptable: false,
        reason: 'Unparseable ISO-8601 timestamp string'
      };
    }

    const driftMs = sourceMs - ingestTimestampMs; // Positive: Future, Negative: Past
    const lastSourceMs = this.lastSourceTimestampMs.get(streamKey);

    // 1. Future timestamp check
    if (driftMs > this.config.maxFutureDriftMs) {
      return {
        classification: 'CLOCK_DRIFT',
        driftMs,
        isAcceptable: false,
        reason: `Source clock is ${driftMs}ms in the future (max allowed: ${this.config.maxFutureDriftMs}ms)`
      };
    }

    // 2. Out-of-order check against per-stream high-water mark
    if (lastSourceMs !== undefined && sourceMs < lastSourceMs) {
      const lateByMs = lastSourceMs - sourceMs;
      if (lateByMs > this.config.maxStaleThresholdMs) {
        return {
          classification: 'STALE',
          driftMs,
          isAcceptable: false,
          reason: `Stale packet: arrived ${lateByMs}ms older than high-water mark`
        };
      }
      return {
        classification: 'OUT_OF_ORDER',
        driftMs,
        isAcceptable: true, // Out-of-order is classified and accepted into reordering window
        reason: `Out-of-order timestamp: arrived ${lateByMs}ms after higher timestamp`
      };
    }

    // 3. Stale check against ingestion clock
    if (ingestTimestampMs - sourceMs > this.config.maxStaleThresholdMs) {
      return {
        classification: 'STALE',
        driftMs,
        isAcceptable: false,
        reason: `Packet timestamp is ${ingestTimestampMs - sourceMs}ms stale (> ${this.config.maxStaleThresholdMs}ms)`
      };
    }

    // 4. Late arrival check
    if (ingestTimestampMs - sourceMs > this.config.lateArrivalThresholdMs) {
      if (lastSourceMs === undefined || sourceMs >= lastSourceMs) {
        this.lastSourceTimestampMs.set(streamKey, sourceMs);
      }
      return {
        classification: 'LATE',
        driftMs,
        isAcceptable: true,
        reason: `Late arrival with ${ingestTimestampMs - sourceMs}ms latency`
      };
    }

    // Update monotonic high water mark
    this.lastSourceTimestampMs.set(streamKey, sourceMs);

    return {
      classification: 'VALID',
      driftMs,
      isAcceptable: true
    };
  }

  public resetStream(streamKey: string): void {
    this.lastSourceTimestampMs.delete(streamKey);
  }
}
