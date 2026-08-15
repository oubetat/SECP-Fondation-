/**
 * SECP079ReproducibilityEngine: Deterministic Ingestion & Verification Reproducibility Audit
 * Verifies that under identical input parameters and random seed:
 * Run 1 and Run 2 produce bit-exact identical event streams, normalization digests, and audit hashes.
 */

import { ProtocolTestHarness } from '../telemetry/harness/ProtocolTestHarness';
import { TelemetryNormalizer } from '../telemetry/ingestion/TelemetryNormalizer';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';
import { IndustrialTelemetryEvent } from '../telemetry/IndustrialTelemetryTypes';

export interface ReproducibilityAudit079Result {
  isReproducible: boolean;
  run1Digest: string;
  run2Digest: string;
  divergentEventCount: number;
  totalEventsTested: number;
  verificationEvidence: string;
}

export class SECP079ReproducibilityEngine {
  /**
   * Executes deterministic dual-run audit
   */
  public static runAudit(count: number = 2000): ReproducibilityAudit079Result {
    const fixedTimestampMs = 1755244800000; // Fixed deterministic baseline timestamp

    // Run 1
    const run1Packets = ProtocolTestHarness.generateBatch('MQTT', 'TURBO-REP-01', 'CONN-REP-01', count, 1, fixedTimestampMs);
    const normalizer1 = new TelemetryNormalizer();
    const run1Events: IndustrialTelemetryEvent[] = [];
    for (const p of run1Packets) {
      const res = normalizer1.normalize(p);
      if (res.event) run1Events.push(res.event);
    }
    const run1Digest = TelemetryHasher.hashString(run1Events.map(e => `${e.eventId}:${e.provenanceId}:${e.value}`).join(';'));

    // Run 2
    const run2Packets = ProtocolTestHarness.generateBatch('MQTT', 'TURBO-REP-01', 'CONN-REP-01', count, 1, fixedTimestampMs);
    const normalizer2 = new TelemetryNormalizer();
    const run2Events: IndustrialTelemetryEvent[] = [];
    for (const p of run2Packets) {
      const res = normalizer2.normalize(p);
      if (res.event) run2Events.push(res.event);
    }
    const run2Digest = TelemetryHasher.hashString(run2Events.map(e => `${e.eventId}:${e.provenanceId}:${e.value}`).join(';'));

    let divergentEventCount = 0;
    for (let i = 0; i < run1Events.length; i++) {
      if (run1Events[i].provenanceId !== run2Events[i].provenanceId || run1Events[i].value !== run2Events[i].value) {
        divergentEventCount++;
      }
    }

    const isReproducible = (run1Digest as string) === (run2Digest as string) && divergentEventCount === 0;

    return {
      isReproducible,
      run1Digest,
      run2Digest,
      divergentEventCount,
      totalEventsTested: count,
      verificationEvidence: isReproducible 
        ? `Dual-run deterministic bit-exact match verified across ${count} industrial telemetry events (Digest: ${run1Digest})`
        : `Divergence detected: Run1 ${run1Digest} !== Run2 ${run2Digest}`
    };
  }
}
