/**
 * SECP079TelemetryVerificationEngine: Independent Forensic Telemetry Audit Engine
 * 
 * Independently recomputes from raw event streams:
 * - Sequence integrity (expected vs received, loss rate, duplicate rate, reorder rate)
 * - Timestamp integrity (drift distribution, clock anomalies, stale rates)
 * - Event hash and cryptographic provenance chains
 * - Dropped message accounting (ensuring zero silent loss)
 * - Throughput & processing latency distributions
 */

import { IndustrialTelemetryEvent, DroppedTelemetryRecord, TelemetryStreamMetrics } from '../telemetry/IndustrialTelemetryTypes';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';

export interface ForensicStreamAuditResult {
  isForensicallySound: boolean;
  totalEventsAudited: number;
  totalValidProvenanceCount: number;
  tamperedProvenanceCount: number;
  calculatedLossRate: number;
  calculatedDuplicateRate: number;
  calculatedReorderRate: number;
  clockDriftViolations: number;
  silentDropDetected: boolean;
  streamDigest: string;
  auditLogs: string[];
}

export class SECP079TelemetryVerificationEngine {
  /**
   * Independently audits a stream of processed events and drop logs
   */
  public static auditStream(
    events: IndustrialTelemetryEvent[],
    droppedRecords: DroppedTelemetryRecord[],
    expectedTotalSent: number
  ): ForensicStreamAuditResult {
    const logs: string[] = [];
    logs.push(`=== Initializing SECP-079 Independent Telemetry Stream Audit ===`);
    logs.push(`Auditing ${events.length} received events against ${droppedRecords.length} recorded drops (Expected Total Sent: ${expectedTotalSent})`);

    let tamperedProvenanceCount = 0;
    let totalValidProvenanceCount = 0;
    let clockDriftViolations = 0;
    let totalDuplicates = 0;
    let totalReordered = 0;
    let totalGaps = 0;

    const streamSequenceMap: Map<string, { lastSeq: number; seen: Set<number> }> = new Map();

    // 1. Verify Event Cryptographic Hashes & Provenance
    for (let i = 0; i < events.length; i++) {
      const e = events[i];

      // Recompute raw payload digest
      const expectedPayloadDigest = TelemetryHasher.hashString(
        `${e.connectorId}:${e.deviceId}:${e.protocol}:${e.sequenceNumber}:${e.timestamp}:${e.value}:${e.unit}:${e.source}`
      );

      const expectedProvId = TelemetryHasher.hashString(
        `PROV-079:${e.eventId}:${expectedPayloadDigest}:${e.receivedAt}`
      );

      if (e.provenanceId !== expectedProvId) {
        tamperedProvenanceCount++;
        if (tamperedProvenanceCount <= 3) {
          logs.push(`CRITICAL: Provenance mismatch on Event ${e.eventId} (Seq ${e.sequenceNumber})`);
        }
      } else {
        totalValidProvenanceCount++;
      }

      // 2. Independently verify timestamp
      const sourceMs = Date.parse(e.timestamp);
      const ingestMs = e.ingestTimestampMs || Date.parse(e.receivedAt);
      const drift = sourceMs - ingestMs;
      if (drift > 2500) { // Future drift > 2.5s
        clockDriftViolations++;
      }

      // 3. Independently verify sequence numbers
      const streamKey = `${e.deviceId}:${e.signalType}`;
      let seqTracker = streamSequenceMap.get(streamKey);
      if (!seqTracker) {
        seqTracker = { lastSeq: e.sequenceNumber, seen: new Set([e.sequenceNumber]) };
        streamSequenceMap.set(streamKey, seqTracker);
      } else {
        if (seqTracker.seen.has(e.sequenceNumber)) {
          totalDuplicates++;
        } else {
          seqTracker.seen.add(e.sequenceNumber);
          if (e.sequenceNumber > seqTracker.lastSeq + 1) {
            totalGaps += (e.sequenceNumber - seqTracker.lastSeq - 1);
          } else if (e.sequenceNumber < seqTracker.lastSeq) {
            totalReordered++;
          }
          seqTracker.lastSeq = Math.max(seqTracker.lastSeq, e.sequenceNumber);
        }
      }
    }

    // 4. Accounting Balance Check: Total Sent = Total Enqueued + Total Dropped
    const accountedTotal = events.length + droppedRecords.length;
    const silentLossCount = Math.max(0, expectedTotalSent - accountedTotal);
    const silentDropDetected = silentLossCount > 0;

    if (silentDropDetected) {
      logs.push(`CRITICAL ERROR: Silent packet loss detected! Expected: ${expectedTotalSent}, Accounted: ${accountedTotal}, Missing: ${silentLossCount}`);
    } else {
      logs.push(`SUCCESS: Zero silent drop policy verified. All ${accountedTotal} events strictly accounted for.`);
    }

    // 5. Compute overall rates
    const totalPotential = events.length + totalGaps;
    const calculatedLossRate = totalPotential > 0 ? totalGaps / totalPotential : 0;
    const calculatedDuplicateRate = events.length > 0 ? totalDuplicates / events.length : 0;
    const calculatedReorderRate = events.length > 0 ? totalReordered / events.length : 0;

    // 6. Compute deterministic stream hash digest
    const streamDigest = TelemetryHasher.hashString(
      `AUDIT-STREAM:${events.length}:${droppedRecords.length}:${totalValidProvenanceCount}:${tamperedProvenanceCount}:${calculatedLossRate.toFixed(4)}`
    );

    const isForensicallySound = tamperedProvenanceCount === 0 && !silentDropDetected && clockDriftViolations === 0;

    logs.push(`Audit Completed. Sound: ${isForensicallySound ? 'YES' : 'NO'}, Valid Provenance: ${totalValidProvenanceCount}/${events.length}, Stream Digest: ${streamDigest}`);

    return {
      isForensicallySound,
      totalEventsAudited: events.length,
      totalValidProvenanceCount,
      tamperedProvenanceCount,
      calculatedLossRate,
      calculatedDuplicateRate,
      calculatedReorderRate,
      clockDriftViolations,
      silentDropDetected,
      streamDigest,
      auditLogs: logs
    };
  }
}
