import { LifecycleTraceabilityEngine } from './LifecycleTraceabilityEngine';
import { LifecycleEvent, LifecycleSnapshot, LifecycleVerdict } from './types';
import { LifecycleCanonicalizer } from './LifecycleCanonicalizer';

export class IndependentLifecycleVerifier {
  public static verify(
    engine: LifecycleTraceabilityEngine,
    entityId: string
  ): { verdict: LifecycleVerdict; details: string[] } {
    const details: string[] = [];
    const history = engine.getHistory(entityId);

    if (history.length === 0) {
      return { verdict: 'INCOMPLETE', details: ['History is empty'] };
    }

    // 1. Monotonic Sequence Verification
    for (let i = 0; i < history.length; i++) {
      if (history[i].sequence !== i + 1) {
        details.push(`SEQUENCE_GAP: Missing or duplicate sequence at index ${i}`);
      }
    }

    // 2. Hash Chain Re-computation
    let prevHash = '0'.repeat(64);
    for (const event of history) {
      // 2a. Payload Integrity
      const recomputedPayloadHash = LifecycleCanonicalizer.sha256(JSON.stringify(event.payload || {}));
      if (event.payloadHash !== recomputedPayloadHash) {
        details.push(`PAYLOAD_TAMPER: Event ${event.sequence} payload mismatch with payloadHash`);
      }

      // 2b. Chain Integrity
      if (event.previousEventHash !== prevHash) {
        details.push(`CHAIN_BREAK: Event ${event.sequence} has incorrect previousHash`);
      }

      // 2c. Event Hash Integrity
      const recomputed = LifecycleCanonicalizer.computeEventHash(event);
      if (event.eventHash !== recomputed) {
        details.push(`TAMPER_DETECTED: Event ${event.sequence} hash mismatch`);
      }
      prevHash = event.eventHash;
    }

    // 3. Temporal Causality Check
    for (let i = 1; i < history.length; i++) {
      if (new Date(history[i].timestamp) < new Date(history[i-1].timestamp)) {
        details.push(`TEMPORAL_ANOMALY: Event ${history[i].sequence} occurs before ${history[i-1].sequence}`);
      }
    }

    const verdict: LifecycleVerdict = details.length === 0 ? 'VALID' : 'CORRUPTED';

    return { verdict, details };
  }
}
