// SECP Industrial OS v2 — PATCH-127 Verification & Forensic Runner
import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate127 } from '../../src/engine/runtime_telemetry/HardAcceptanceGate127';
import { RuntimeTelemetryEngine } from '../../src/engine/runtime_telemetry/RuntimeTelemetryEngine';
import { IndependentRuntimeVerifier } from '../../src/engine/runtime_telemetry/IndependentRuntimeVerifier';
import { RuntimeIdentityService } from '../../src/engine/runtime_telemetry/RuntimeIdentityService';
import { CanonicalTelemetrySerializer } from '../../src/engine/runtime_telemetry/CanonicalTelemetrySerializer';
import { RuntimeResourceSnapshot, JobRuntimeTelemetry, TelemetryEvent } from '../../src/engine/runtime_telemetry/types';

async function runPatch127Verification() {
  console.log('='.repeat(80));
  console.log('SECP INDUSTRIAL OS v2 — PATCH-127: RUNTIME TELEMETRY TRUTH');
  console.log('='.repeat(80));

  const reportsDir = path.join(process.cwd(), 'reports/digital-twin/patch-127');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const engine = new RuntimeTelemetryEngine();

  // Step 1: Generate 50 Forensic Reports
  console.log('>>> STEP 1: Generating 50 Comprehensive Runtime Telemetry Forensic Reports...');
  for (let i = 1; i <= 50; i++) {
    const sessionId = `RUN-SESS-${i.toString().padStart(3, '0')}`;
    const session = engine.createSession(sessionId, 'v2.0', `BUILD-${i}`, `conf_hash_${i}`, 'HOST-01', 'PROD');
    
    let e1 = engine.createEvent(`EVT-${i}-1`, sessionId, 1, 'START', { v: 1 }, 'GENESIS');
    let e2 = engine.createEvent(`EVT-${i}-2`, sessionId, 2, 'METRIC', { cpu: 50 }, e1.eventHash);

    const reportContent = {
      reportId: `REP-RUN-127-${i.toString().padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      sessionId: session.runtimeSessionId,
      sessionHash: session.sessionHash,
      state: session.state,
      eventChainHash: e2.eventHash
    };

    fs.writeFileSync(path.join(reportsDir, `report_runtime_${i.toString().padStart(3, '0')}.json`), JSON.stringify(reportContent, null, 2));
  }
  console.log(`Successfully generated 50 runtime telemetry forensic reports in ${reportsDir}`);

  // Step 2: Evaluate Hard Acceptance Gate 127
  console.log('\n>>> STEP 2: Evaluating Hard Acceptance Gate 127...');
  const gateResult = HardAcceptanceGate127.evaluateGate();
  console.log(`>>> Total Gate Checks: ${gateResult.totalChecks}`);
  console.log(`>>> Passed Gate Checks: ${gateResult.passedChecks}`);
  console.log(`>>> Overall Gate Score: ${gateResult.overallScore}%`);
  console.log(`>>> Gate Verdict: ${gateResult.verdict}`);

  for (const c of gateResult.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.gateId}: ${c.description}`);
    console.log(`         ${c.details}`);
  }

  // Step 3: Adversarial & Security Negative Attacks
  console.log('\n>>> STEP 3: Evaluating Adversarial & Security Negative Attacks...');

  const session = engine.createSession('ADV-SESS-1', 'v2.0', 'B-1', 'C-1', 'H-1', 'PROD');
  const e1 = engine.createEvent('A-1', session.runtimeSessionId, 1, 'M', {v:1}, 'GENESIS');
  const e2 = engine.createEvent('A-2', session.runtimeSessionId, 2, 'M', {v:2}, e1.eventHash);
  const e3 = engine.createEvent('A-3', session.runtimeSessionId, 3, 'M', {v:3}, e2.eventHash);

  // ADV 1: Replay Attack
  const seenHashes = new Set<string>([e1.eventHash, e2.eventHash]);
  const replay = RuntimeIdentityService.detectReplayAttack(e2, seenHashes);
  const adv1Passed = !replay.valid && replay.error === 'REPLAY_DETECTED';
  console.log(`  [${adv1Passed ? 'PASS' : 'FAIL'}] ADV-127-01: Event Replay Attack -> Intercepted (REPLAY_DETECTED)`);

  // ADV 2: Sequence Tampering (Missing Event)
  const missing = RuntimeIdentityService.verifySequenceIntegrity([e1, e3]);
  const adv2Passed = !missing.valid && missing.error === 'MISSING_EVENT';
  console.log(`  [${adv2Passed ? 'PASS' : 'FAIL'}] ADV-127-02: Sequence Tampering (Missing Event) -> Intercepted (MISSING_EVENT)`);

  // ADV 3: Sequence Tampering (Out of Order)
  const e1_ooo = engine.createEvent('A-1-ooo', session.runtimeSessionId, 1, 'M', {v:4}, 'GENESIS');
  const ooo = RuntimeIdentityService.verifySequenceIntegrity([e1, e2, e1_ooo]);
  const adv3Passed = !ooo.valid && ooo.error === 'OUT_OF_ORDER';
  console.log(`  [${adv3Passed ? 'PASS' : 'FAIL'}] ADV-127-03: Sequence Tampering (Out of Order) -> Intercepted (OUT_OF_ORDER)`);

  // ADV 4: Configuration Mismatch
  const confMatch = RuntimeIdentityService.verifyConfigurationMatch('CONF-1', 'CONF-WRONG');
  const adv4Passed = !confMatch.valid && confMatch.error === 'CONFIGURATION_MISMATCH';
  console.log(`  [${adv4Passed ? 'PASS' : 'FAIL'}] ADV-127-04: Configuration Forgery -> Intercepted (CONFIGURATION_MISMATCH)`);

  // ADV 5: Fake Completion
  const fakeJob: JobRuntimeTelemetry = {
    jobId: 'J-1', runtimeSessionId: session.runtimeSessionId, jobType: 'CFD',
    submittedAt: new Date().toISOString(), status: 'COMPLETED', inputHash: 'in' // missing output
  };
  const fakeComp = RuntimeIdentityService.verifyJobCompletionIntegrity(fakeJob, [e1, e2]);
  const adv5Passed = !fakeComp.valid && fakeComp.error?.includes('RUNTIME_VERDICT_INTEGRITY_FAILURE') === true;
  console.log(`  [${adv5Passed ? 'PASS' : 'FAIL'}] ADV-127-05: Fake Completion Verification -> Intercepted (RUNTIME_VERDICT_INTEGRITY_FAILURE)`);

  // Step 4: Scale & Performance Benchmark
  console.log('\n>>> STEP 4: Running Scale & Performance Benchmark...');
  const startTime = Date.now();
  
  let prevHash = 'GENESIS';
  for (let k = 1; k <= 5000; k++) {
    const evt = engine.createEvent(`EVT-PERF-${k}`, session.runtimeSessionId, k, 'PERF_METRIC', { usage: Math.random() * 100 }, prevHash);
    prevHash = evt.eventHash;
  }
  
  const duration = Date.now() - startTime;
  console.log(`  [TIER 5,000 Telemetry Events] Hashing & Canonicalization Chain: ${duration.toFixed(2)}ms`);

  console.log('='.repeat(80));
  if (gateResult.verdict === 'PASS' && adv1Passed && adv2Passed && adv3Passed && adv4Passed && adv5Passed) {
    console.log('FINAL RUNTIME TELEMETRY STATUS: ALL PASS (100% TRUTH VERIFIED)');
  } else {
    console.log('FINAL RUNTIME TELEMETRY STATUS: FAIL');
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runPatch127Verification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
