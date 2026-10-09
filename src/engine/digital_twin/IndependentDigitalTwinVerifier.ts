import {
  UnifiedDigitalTwin,
  TwinState,
  TwinVerdict,
  TwinFreshness,
  DigitalTwinSnapshot,
  TwinEvent
} from './types';
import { DigitalTwinCanonicalizer } from './DigitalTwinCanonicalizer';
import { TwinConsistencyChecker } from './TwinConsistencyChecker';

export interface IndependentVerificationReport {
  twinId: string;
  verdict: TwinVerdict;
  freshness: TwinFreshness;
  healthScore: number; // dynamically computed, not fixed!
  integrityPassed: boolean;
  stateHashValid: boolean;
  rootHashValid: boolean;
  eventChainValid: boolean;
  evidenceBacked: boolean;
  issues: string[];
}

export class IndependentDigitalTwinVerifier {
  public static verifyTwin(
    twin: UnifiedDigitalTwin,
    currentState: TwinState,
    events: TwinEvent[],
    snapshot: DigitalTwinSnapshot
  ): IndependentVerificationReport {
    const issues: string[] = [];

    // 1. Verify Twin Identity Hash
    const recomputedTwinHash = DigitalTwinCanonicalizer.computeTwinIdentityHash(twin);
    if (twin.twinHash !== recomputedTwinHash) {
      issues.push(`TWIN_IDENTITY_HASH_MISMATCH: Stored ${twin.twinHash} vs Recomputed ${recomputedTwinHash}`);
    }

    // 2. Verify State Hash
    const recomputedStateHash = DigitalTwinCanonicalizer.computeStateHash(currentState);
    const stateHashValid = (currentState.stateHash === recomputedStateHash);
    if (!stateHashValid) {
      issues.push(`STATE_HASH_MISMATCH: Stored ${currentState.stateHash} vs Recomputed ${recomputedStateHash}`);
    }

    // 3. Verify Snapshot Root Hash
    const recomputedSnapshot = DigitalTwinCanonicalizer.computeSnapshot(twin.twinId, currentState.timestamp, currentState);
    const rootHashValid = (snapshot.twinRootHash === recomputedSnapshot.twinRootHash);
    if (!rootHashValid) {
      issues.push(`ROOT_HASH_MISMATCH: Stored ${snapshot.twinRootHash} vs Recomputed ${recomputedSnapshot.twinRootHash}`);
    }

    // 4. Verify Event Chain & Causality
    let eventChainValid = true;
    let expectedPreviousHash = '0'.repeat(64);
    for (const evt of events) {
      if (evt.previousStateHash !== expectedPreviousHash) {
        issues.push(`BROKEN_EVENT_CHAIN: Event ${evt.eventId} previous hash mismatch`);
        eventChainValid = false;
      }
      const recomputedEventHash = DigitalTwinCanonicalizer.computeEventHash(evt);
      if (evt.eventHash !== recomputedEventHash) {
        issues.push(`EVENT_HASH_MISMATCH: Event ${evt.eventId} has invalid hash`);
        eventChainValid = false;
      }
      expectedPreviousHash = evt.newStateHash;
    }

    // 5. Verify Consistency
    const consistency = TwinConsistencyChecker.checkConsistency(twin, currentState);
    if (!consistency.isConsistent && consistency.verdict === 'INCONSISTENT') {
      issues.push(...consistency.issues);
    }

    // 6. Verify Evidence Backing
    const evidenceBacked = currentState.evidenceReferences && currentState.evidenceReferences.length > 0;
    if (!evidenceBacked) {
      issues.push('NO_EVIDENCE_BACKING: State has no associated enterprise evidence');
    }

    // 7. Dynamic Freshness Calculation
    const stateTime = new Date(currentState.timestamp).getTime();
    const now = Date.now();
    const ageHours = (now - stateTime) / (1000 * 60 * 60);
    const freshness: TwinFreshness = ageHours < 24 ? 'FRESH' : 'STALE';

    // 8. Dynamic Health Score Calculation (Non-fixed)
    let penalty = 0;
    if (!stateHashValid) penalty += 40;
    if (!rootHashValid) penalty += 30;
    if (!eventChainValid) penalty += 20;
    if (!evidenceBacked) penalty += 15;
    if (!consistency.isConsistent) penalty += 10;
    const healthScore = Math.max(0, 100 - penalty);

    // Final Verdict
    let verdict: TwinVerdict = 'VALID';
    if (!stateHashValid || !rootHashValid || !eventChainValid) {
      verdict = 'CORRUPTED';
    } else if (!evidenceBacked) {
      verdict = 'INCOMPLETE';
    } else if (!consistency.isConsistent) {
      verdict = 'CONFLICT';
    }

    return {
      twinId: twin.twinId,
      verdict,
      freshness,
      healthScore,
      integrityPassed: issues.length === 0,
      stateHashValid,
      rootHashValid,
      eventChainValid,
      evidenceBacked,
      issues
    };
  }
}
