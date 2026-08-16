import { HardAcceptanceGateP4 } from './src/engine/validation/HardAcceptanceGateP4';

console.log('=== SECP PHASE P4: SOAK / ENDURANCE TEST & STABILITY VALIDATION ===\n');

try {
  const evidence = HardAcceptanceGateP4.evaluateQualification();

  console.log('--- Endurance & Long-Term Stability Summary ---');
  const summary = evidence.soakSummary;
  console.log(`  NIST Compliance Standard:       ${evidence.nistComplianceStandard}`);
  console.log(`  Evaluated Soak Windows Count:   ${summary.totalWindowsEvaluated} Windows (24h, 72h, 168h)`);
  console.log(`  Max Soak Duration Window:       ${summary.maxSoakDurationHours} Hours (7 Days)`);
  console.log(`  Total Simulated Requests:       ${summary.totalSimulatedRequests.toLocaleString()}`);
  console.log(`  Total CAD B-Rep Operations:     ${summary.totalSimulatedCadOperations.toLocaleString()}`);
  console.log(`  Total FEA Physics Simulations:  ${summary.totalSimulatedFeaSimulations.toLocaleString()}`);
  console.log(`  Peak Memory Leak Rate:          ${summary.peakMemoryLeakRateMbPerHour} MB/hr (< 0.05 MB/hr threshold)`);
  console.log(`  Total Accumulated Heap Growth:  ${summary.totalAccumulatedHeapGrowthMb} MB across 168 hours`);
  console.log(`  Unclosed Connection Leaks:      ${summary.totalUnclosedConnectionLeaks} Leaks`);
  console.log(`  Orphan Jobs Detected:           ${summary.totalOrphanJobsDetected} Jobs`);
  console.log(`  Corrupted Artifacts Detected:   ${summary.totalCorruptedArtifactsDetected} Artifacts`);
  console.log(`  Peak P95 Latency Drift:         ${summary.peakP95LatencyDriftPct}%`);
  console.log(`  Peak VRAM Fragmentation:        ${summary.peakVramFragmentationPct}%`);
  console.log(`  Worker Thread Crashes:          ${summary.totalWorkerCrashes} Crashes`);
  console.log(`  Audit Log Events Lost:          ${summary.totalAuditTrailLossCount} Lost Events`);
  console.log(`  NIST Self-Healing Actions:      ${summary.totalNistSelfHealingActionsExecuted.toLocaleString()} Executed Mitigations\n`);

  console.log('--- Soak Duration Window Reports (W1 24h -> W2 72h -> W3 168h / 7 Days) ---');
  evidence.soakWindowReports.forEach(rep => {
    const spec = rep.spec;
    const m = rep.metrics;
    console.log(`  [${rep.status}] ${spec.windowId}: ${spec.durationHours} Hours | ${spec.simulatedTotalRequests.toLocaleString()} Reqs (${spec.simulatedCadOperations.toLocaleString()} CAD Ops, ${spec.simulatedFeaSimulations.toLocaleString()} FEA Sims)`);
    console.log(`      Memory:   Leak Rate ${m.memoryLeakRateMbPerHour} MB/hr | Heap Growth +${m.totalHeapGrowthMb} MB`);
    console.log(`      Handles:  DB Leaks ${m.unclosedDbConnectionLeaks} | WS Leaks ${m.unclosedWebSocketLeaks} | Orphan Jobs ${m.orphanJobsCount}`);
    console.log(`      Quality:  Corrupted Assets ${m.corruptedArtifactsCount} | Audit Log Loss ${m.auditTrailLossCount} | Worker Crashes ${m.workerCrashCount}`);
    console.log(`      Drift:    P95 Latency Drift ${m.p95LatencyDriftPct}% | DB Latency Drift ${m.dbLatencyDriftPct}% | VRAM Frag ${m.vramFragmentationPct}%`);
    console.log(`      NIST SP 800-160 Active Self-Healing Mitigations:`);
    rep.nistSelfHealingActions.forEach(act => {
      console.log(`        - [${act.actionId}] (${act.executionCount}x): ${act.triggerCondition} -> ${act.mitigationApplied}`);
    });
    console.log('');
  });

  console.log('--- Adversarial P4 Soak Resilience Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP4Suite.passedScenarios}/${evidence.adversarialP4Suite.totalScenarios}`);
  evidence.adversarialP4Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P4 GATE STATUS: ${evidence.overallStatus}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P4 Soak / Endurance Test Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P4 Soak / Endurance Test Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P4 Qualification Runner:', err);
  process.exit(1);
}
