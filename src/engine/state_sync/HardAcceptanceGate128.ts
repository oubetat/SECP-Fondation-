import { StateSynchronizationEngine } from './StateSynchronizationEngine';
import { IndependentStateVerifier } from './IndependentStateVerifier';
import { StateIdentityService } from './StateIdentityService';
import { StateConflictEngine } from './StateConflictEngine';
import { CanonicalStateSerializer } from './CanonicalStateSerializer';
import { EngineeringState, SynchronizationSession, StateSynchronizationEvent, StateDependency, StateConflict } from './types';

export interface Gate128CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate128Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate128CheckResult[];
}

export class HardAcceptanceGate128 {
  public static evaluateGate(): Gate128Summary {
    const checks: Gate128CheckResult[] = [];
    const engine = new StateSynchronizationEngine();

    const deps: StateDependency[] = [
      { entityId: 'DEP-1', stateVersion: 1, stateHash: 'dep1_hash' }
    ];

    const baseState = engine.createState('ENT-1', 'CAD', 1, '1.0', { a: 1 }, deps);
    const sourceState = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2 }, deps, baseState.stateId, baseState.stateVersion, baseState.stateHash);
    const targetState = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2 }, deps, baseState.stateId, baseState.stateVersion, baseState.stateHash);

    // 1. Deterministic State Identity
    const s1 = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2 }, deps);
    const s2 = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2 }, deps);
    const g01Passed = s1.stateHash === s2.stateHash && s1.stateHash.length === 64;
    checks.push({ gateId: 'GATE-128-01', description: 'Deterministic State Identity', passed: g01Passed, score: g01Passed ? 100 : 0, details: g01Passed ? 'Hashes match exactly' : 'Determinism failed' });

    // 2. Immutable State Versioning
    const vCheck = StateIdentityService.verifyVersionMonotonicity(1, 2);
    const g02Passed = vCheck.valid;
    checks.push({ gateId: 'GATE-128-02', description: 'Immutable State Versioning', passed: g02Passed, score: g02Passed ? 100 : 0, details: g02Passed ? 'Monotonicity passed' : 'Monotonicity failed' });

    // 3. Dependency Integrity
    const badDeps: StateDependency[] = [{ entityId: 'DEP-1', stateVersion: 2, stateHash: 'dep1_hash_wrong' }];
    const staleCheck = StateIdentityService.detectStaleState(sourceState, badDeps);
    const g03Passed = staleCheck.isStale && staleCheck.error === 'DERIVED_STATE_STALE';
    checks.push({ gateId: 'GATE-128-03', description: 'Dependency Integrity', passed: g03Passed, score: g03Passed ? 100 : 0, details: g03Passed ? 'Stale state correctly detected' : 'Failed to detect stale state' });

    // 4. Missing Dependency
    const missingCheck = StateIdentityService.detectMissingDependency(['DEP-1', 'DEP-2'], deps);
    const g04Passed = !missingCheck.valid && missingCheck.error === 'DEPENDENCY_MISSING';
    checks.push({ gateId: 'GATE-128-04', description: 'Missing Dependency Check', passed: g04Passed, score: g04Passed ? 100 : 0, details: g04Passed ? 'Successfully caught missing dependency' : 'Failed to catch missing dependency' });

    // 5. Version Conflict
    const tStateConflict1 = engine.createState('ENT-1', 'CAD', 3, '1.0', { a: 2 }, deps);
    const conflictsV = StateConflictEngine.detectConflicts(baseState, sourceState, tStateConflict1);
    const g05Passed = conflictsV.some(c => c.conflictType === 'VERSION_CONFLICT');
    checks.push({ gateId: 'GATE-128-05', description: 'Version Conflict Detection', passed: g05Passed, score: g05Passed ? 100 : 0, details: g05Passed ? 'Successfully caught VERSION_CONFLICT' : 'Failed to catch VERSION_CONFLICT' });

    // 6. Field Conflict
    const sStateField = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2, b: 3 }, deps);
    const tStateField = engine.createState('ENT-1', 'CAD', 2, '1.0', { a: 2, b: 4 }, deps);
    const conflictsF = StateConflictEngine.detectConflicts(baseState, sStateField, tStateField);
    const g06Passed = conflictsF.some(c => c.conflictType === 'FIELD_CONFLICT');
    checks.push({ gateId: 'GATE-128-06', description: 'Field Conflict Detection', passed: g06Passed, score: g06Passed ? 100 : 0, details: g06Passed ? 'Successfully caught FIELD_CONFLICT' : 'Failed to catch FIELD_CONFLICT' });

    // 7. Fake Synchronization Check
    const fakeSession: SynchronizationSession = engine.createSyncSession('SYNC-01', sourceState, targetState, baseState.stateHash);
    fakeSession.status = 'COMPLETED';
    fakeSession.targetStateHash = undefined;
    const fakeCheck = IndependentStateVerifier.verifySynchronizationTruth(fakeSession, sourceState, targetState, [], [], 'hash', deps);
    const g07Passed = !fakeCheck.valid && fakeCheck.details === 'FAKE_SYNCHRONIZATION';
    checks.push({ gateId: 'GATE-128-07', description: 'Fake Synchronization Check', passed: g07Passed, score: g07Passed ? 100 : 0, details: g07Passed ? 'Successfully caught FAKE_SYNCHRONIZATION' : 'Failed to catch fake sync' });

    // 8. Event Hash Chain Broken
    const e1 = engine.createSyncEvent('E1', 'SYNC-01', sourceState.stateHash, targetState.stateHash, 'PREPARE', 1, 'GENESIS');
    const e2 = engine.createSyncEvent('E2', 'SYNC-01', sourceState.stateHash, targetState.stateHash, 'COMMIT', 2, e1.eventHash);
    const tamperedE2 = { ...e2, operation: 'ABORT' }; // Hash no longer matches content
    const chainCheck = IndependentStateVerifier.verifySynchronizationTruth({ ...fakeSession, status: 'SYNCING', targetStateHash: targetState.stateHash }, sourceState, targetState, [e1, tamperedE2], [], 'hash', deps);
    const g08Passed = !chainCheck.valid && chainCheck.details === 'EVENT_CHAIN_BROKEN';
    checks.push({ gateId: 'GATE-128-08', description: 'Event Hash Chain Verification', passed: g08Passed, score: g08Passed ? 100 : 0, details: g08Passed ? 'Successfully caught EVENT_CHAIN_BROKEN' : 'Failed to catch broken chain' });

    // 9. Root Hash Differential Verify
    // Compute proper root hash
    const session = engine.createSyncSession('SYNC-02', sourceState, targetState, baseState.stateHash);
    session.status = 'COMPLETED';
    
    let evt1 = engine.createSyncEvent('E-01', session.syncSessionId, sourceState.stateHash, targetState.stateHash, 'PREPARE', 1, 'GENESIS');
    let evt2 = engine.createSyncEvent('E-02', session.syncSessionId, sourceState.stateHash, targetState.stateHash, 'COMMIT', 2, evt1.eventHash);
    const evts = [evt1, evt2];
    
    const conflictHashes = 'NO_CONFLICTS';
    const expectedRootHash = CanonicalStateSerializer.computeSyncRootHash(sourceState.stateHash, targetState.stateHash, evt2.eventHash, conflictHashes);
    session.syncRootHash = expectedRootHash;

    const indVerify = IndependentStateVerifier.verifySynchronizationTruth(session, sourceState, targetState, evts, [], expectedRootHash, deps);
    const g09Passed = indVerify.verdict === 'MATCH';
    checks.push({ gateId: 'GATE-128-09', description: 'Independent State Verifier Match', passed: g09Passed, score: g09Passed ? 100 : 0, details: g09Passed ? 'Differential match 100%' : 'Mismatch detected' });

    // 10. Unresolved Conflicts block completion
    const openConflicts: StateConflict[] = [{
      conflictId: 'C1', entityId: 'E1', baseVersion: 1, sourceVersion: 2, targetVersion: 2, conflictingFields: ['a'], detectedAt: new Date().toISOString(), severity: 'BLOCKING', resolutionStatus: 'UNRESOLVED', conflictType: 'FIELD_CONFLICT'
    }];
    const blockCheck = IndependentStateVerifier.verifySynchronizationTruth(session, sourceState, targetState, evts, openConflicts, expectedRootHash, deps);
    const g10Passed = !blockCheck.valid && blockCheck.details === 'UNRESOLVED_CONFLICTS';
    checks.push({ gateId: 'GATE-128-10', description: 'Unresolved Conflicts Validation', passed: g10Passed, score: g10Passed ? 100 : 0, details: g10Passed ? 'Successfully blocked completion on unresolved conflicts' : 'Failed to block completion' });

    const passedCount = checks.filter(c => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
