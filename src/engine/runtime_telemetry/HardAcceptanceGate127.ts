import { RuntimeTelemetryEngine } from './RuntimeTelemetryEngine';
import { IndependentRuntimeVerifier } from './IndependentRuntimeVerifier';
import { RuntimeIdentityService } from './RuntimeIdentityService';
import { CanonicalTelemetrySerializer } from './CanonicalTelemetrySerializer';
import { TelemetryEvent, RuntimeSession, JobRuntimeTelemetry, RuntimeResourceSnapshot } from './types';

export interface Gate127CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate127Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate127CheckResult[];
}

export class HardAcceptanceGate127 {
  public static evaluateGate(): Gate127Summary {
    const checks: Gate127CheckResult[] = [];
    const engine = new RuntimeTelemetryEngine();

    // Setup base telemetry for verification
    const session = engine.createSession('SESSION-001', 'v2.0', 'BUILD-500', 'conf_hash_1', 'HOST-1', 'PROD');
    
    let evt1 = engine.createEvent('EVT-01', session.runtimeSessionId, 1, 'CPU_METRIC', { usage: 45.2 }, 'GENESIS');
    let evt2 = engine.createEvent('EVT-02', session.runtimeSessionId, 2, 'MEM_METRIC', { usage: 1024 }, evt1.eventHash);
    let evt3 = engine.createEvent('EVT-03', session.runtimeSessionId, 3, 'GPU_METRIC', { usage: 88.1 }, evt2.eventHash);
    
    const validEvents = [evt1, evt2, evt3];

    // 1. GATE-127-01: Deterministic Runtime Identity & Canonical Hashing
    const session2 = engine.createSession('SESSION-001', 'v2.0', 'BUILD-500', 'conf_hash_1', 'HOST-1', 'PROD');
    const g01Passed = session.sessionHash === session2.sessionHash && session.sessionHash.length === 64;
    checks.push({
      gateId: 'GATE-127-01',
      description: 'Deterministic Runtime Identity & Canonical Hashing',
      passed: g01Passed,
      score: g01Passed ? 100 : 0,
      details: g01Passed ? `Determinism verified. Session Hash: ${session.sessionHash.substring(0, 16)}...` : 'Session hash determinism failed'
    });

    // 2. GATE-127-02: Sequence Integrity (Missing / Out-of-Order)
    let evt1_ooo = engine.createEvent('EVT-01-ooo', session.runtimeSessionId, 1, 'CPU_METRIC', { usage: 45.2 }, 'GENESIS');
    const oooEvents = [evt1, evt2, evt1_ooo];
    const oooCheck = RuntimeIdentityService.verifySequenceIntegrity(oooEvents);
    const g02Passed = !oooCheck.valid && oooCheck.error === 'OUT_OF_ORDER';
    checks.push({
      gateId: 'GATE-127-02',
      description: 'Sequence Integrity (Missing Event / Out of order detection)',
      passed: g02Passed,
      score: g02Passed ? 100 : 0,
      details: g02Passed ? 'Successfully intercepted OUT_OF_ORDER' : 'Failed to intercept out of order'
    });

    // 3. GATE-127-03: Duplicate Event Detection
    const dupEvents = [evt1, evt2, evt2, evt3];
    const dupCheck = RuntimeIdentityService.verifySequenceIntegrity(dupEvents);
    const g03Passed = !dupCheck.valid && dupCheck.error === 'DUPLICATE_EVENT';
    checks.push({
      gateId: 'GATE-127-03',
      description: 'Duplicate Event Detection (DUPLICATE_EVENT)',
      passed: g03Passed,
      score: g03Passed ? 100 : 0,
      details: g03Passed ? 'Successfully intercepted DUPLICATE_EVENT' : 'Failed to intercept duplicate event'
    });

    // 4. GATE-127-04: Replay Attack Detection
    const seenHashes = new Set<string>([evt1.eventHash, evt2.eventHash]);
    const replayCheck = RuntimeIdentityService.detectReplayAttack(evt2, seenHashes);
    const g04Passed = !replayCheck.valid && replayCheck.error === 'REPLAY_DETECTED';
    checks.push({
      gateId: 'GATE-127-04',
      description: 'Replay Attack Detection (REPLAY_DETECTED)',
      passed: g04Passed,
      score: g04Passed ? 100 : 0,
      details: g04Passed ? 'Successfully intercepted REPLAY_DETECTED' : 'Failed to intercept replay attack'
    });

    // 5. GATE-127-05: Resource Metric Unit Normalization / Enforcement
    let g05Passed = false;
    try {
      RuntimeIdentityService.enforceMetricUnit(100, 'MB', 'GB');
    } catch (e: any) {
      g05Passed = e.message.includes('UNIT_MISMATCH');
    }
    checks.push({
      gateId: 'GATE-127-05',
      description: 'Resource Metric Unit Normalization / Enforcement',
      passed: g05Passed,
      score: g05Passed ? 100 : 0,
      details: g05Passed ? 'Successfully intercepted UNIT_MISMATCH' : 'Failed unit enforcement'
    });

    // 6. GATE-127-06: Schema Validation
    const invalidSchemaEvt: TelemetryEvent = { ...evt1, schemaVersion: '3.0' };
    const schemaCheck = RuntimeIdentityService.verifySchemaValidation(invalidSchemaEvt);
    const g06Passed = !schemaCheck.valid && schemaCheck.error?.includes('SCHEMA_INVALID') === true;
    checks.push({
      gateId: 'GATE-127-06',
      description: 'Schema Validation (Rejection of invalid schema)',
      passed: g06Passed,
      score: g06Passed ? 100 : 0,
      details: g06Passed ? 'Successfully intercepted SCHEMA_INVALID' : 'Failed schema validation'
    });

    // 7. GATE-127-07: Configuration Mismatch Interception
    const configCheck = RuntimeIdentityService.verifyConfigurationMatch('conf_hash_1', 'conf_hash_WRONG');
    const g07Passed = !configCheck.valid && configCheck.error === 'CONFIGURATION_MISMATCH';
    checks.push({
      gateId: 'GATE-127-07',
      description: 'Configuration Mismatch Interception',
      passed: g07Passed,
      score: g07Passed ? 100 : 0,
      details: g07Passed ? 'Successfully intercepted CONFIGURATION_MISMATCH' : 'Failed configuration mismatch'
    });

    // 8. GATE-127-08: Telemetry Gap / Missing Sequence (MISSING_EVENT)
    const missingEvents = [evt1, evt3];
    const missingCheck = RuntimeIdentityService.verifySequenceIntegrity(missingEvents);
    const g08Passed = !missingCheck.valid && missingCheck.error === 'MISSING_EVENT';
    checks.push({
      gateId: 'GATE-127-08',
      description: 'Telemetry Gap / Missing Sequence Verification',
      passed: g08Passed,
      score: g08Passed ? 100 : 0,
      details: g08Passed ? 'Successfully intercepted MISSING_EVENT' : 'Failed to intercept missing event'
    });

    // 9. GATE-127-09: Fake Completion Attack Interception
    const fakeJob: JobRuntimeTelemetry = {
      jobId: 'JOB-01', runtimeSessionId: session.runtimeSessionId, jobType: 'CFD',
      submittedAt: new Date().toISOString(), status: 'COMPLETED', inputHash: 'input_1', // Missing outputHash
    };
    const fakeCompCheck = RuntimeIdentityService.verifyJobCompletionIntegrity(fakeJob, validEvents);
    const g09Passed = !fakeCompCheck.valid && fakeCompCheck.error?.includes('RUNTIME_VERDICT_INTEGRITY_FAILURE') === true;
    checks.push({
      gateId: 'GATE-127-09',
      description: 'Fake Completion Attack Interception',
      passed: g09Passed,
      score: g09Passed ? 100 : 0,
      details: g09Passed ? 'Successfully intercepted Fake COMPLETED' : 'Failed to intercept fake completion'
    });

    // 10. GATE-127-10: Independent Verifier & Differential Engine Match
    const resourceSnap: RuntimeResourceSnapshot = {
      snapshotId: 'SNAP-01', runtimeSessionId: session.runtimeSessionId, timestamp: new Date().toISOString(),
      cpuUsage: 45, memoryUsage: 1024, gpuUsage: 80, gpuMemory: 2048, diskUsage: 50, networkRx: 10, networkTx: 20,
      threads: 100, processes: 50, snapshotHash: 'snap_hash_1'
    };
    const validJob: JobRuntimeTelemetry = { ...fakeJob, outputHash: 'output_1' };
    
    // Compute expected root hash cleanly
    const sessionHash = CanonicalTelemetrySerializer.sha256(CanonicalTelemetrySerializer.canonicalizeRuntimeSession(session));
    const eventChainHash = validEvents[validEvents.length - 1].eventHash;
    const resourceSnapshotHash = CanonicalTelemetrySerializer.sha256(CanonicalTelemetrySerializer.canonicalizeResourceSnapshot(resourceSnap));
    const jobHash = CanonicalTelemetrySerializer.sha256(JSON.stringify(validJob));
    const evidenceHashes = CanonicalTelemetrySerializer.sha256('MOCK_EVIDENCES');

    const expectedRootHash = CanonicalTelemetrySerializer.computeRuntimeRootHash(
      sessionHash,
      session.configurationHash,
      eventChainHash,
      resourceSnapshotHash,
      jobHash,
      evidenceHashes
    );

    const indRes = IndependentRuntimeVerifier.verifyRuntimeTruth(
      session, validEvents, resourceSnap, validJob, 'conf_hash_1', expectedRootHash, validEvents
    );

    const g10Passed = indRes.verdict === 'MATCH';
    checks.push({
      gateId: 'GATE-127-10',
      description: 'Independent Verifier & Differential Engine Match',
      passed: g10Passed,
      score: g10Passed ? 100 : 0,
      details: g10Passed ? '100% Differential Match between Primary and Independent Verifiers' : 'Differential mismatch'
    });

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
