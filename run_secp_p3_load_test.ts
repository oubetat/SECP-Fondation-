import { HardAcceptanceGateP3 } from './src/engine/validation/HardAcceptanceGateP3';

console.log('=== SECP PHASE P3: PRODUCTION LOAD TEST & OPERATIONAL CAPACITY ===\n');

try {
  const evidence = HardAcceptanceGateP3.evaluateQualification();

  console.log('--- Production Capacity & Load Summary ---');
  const summary = evidence.loadSummary;
  console.log(`  Evaluated Load Tiers Count:    ${summary.totalTiersEvaluated} Tiers (L1 to L5)`);
  console.log(`  Max Concurrent Users Peak:     ${summary.maxConcurrentUsers} Users`);
  console.log(`  Max Target Throughput:         ${summary.maxTargetRps.toLocaleString()} RPS`);
  console.log(`  Peak P95 Ingress Latency:      ${summary.peakP95LatencyMs} ms`);
  console.log(`  Peak P99 Ingress Latency:      ${summary.peakP99LatencyMs} ms`);
  console.log(`  Peak HTTP Error Rate:          ${summary.peakErrorRatePct}%`);
  console.log(`  Peak System Queue Depth:       ${summary.peakQueueDepth} Pending Jobs`);
  console.log(`  Peak Database Latency:         ${summary.peakDatabaseLatencyMs} ms`);
  console.log(`  Peak Object Store Latency:     ${summary.peakObjectStoreLatencyMs} ms`);
  console.log(`  Min WebSocket Stability:       ${summary.lowestWebSocketStabilityPct}%`);
  console.log(`  Peak GPU Utilization:          ${summary.peakGpuUtilizationPct}%`);
  console.log(`  Peak CPU Saturation:           ${summary.peakCpuSaturationPct}%`);
  console.log(`  Peak Worker Saturation:        ${summary.peakWorkerSaturationPct}%`);
  console.log(`  SECP SLO Compliance Rate:      ${summary.overallSloComplianceRatePct}%\n`);

  console.log('--- Concurrent Load Tier Breakdown (L1 Baseline -> L5 Extreme) ---');
  evidence.tierReports.forEach(rep => {
    const spec = rep.tierSpec;
    const m = rep.metrics;
    console.log(`  [${rep.tierStatus}] ${spec.tier}: ${spec.concurrentUsers} Users | Target ${spec.targetRps} RPS (${spec.durationSeconds}s)`);
    console.log(`      Ingress:  P50 ${m.p50LatencyMs}ms | P95 ${m.p95LatencyMs}ms | P99 ${m.p99LatencyMs}ms | Error ${m.errorRatePct}%`);
    console.log(`      Storage:  DB ${m.databaseLatencyMs}ms | Object Store ${m.objectStorageLatencyMs}ms | Queue Depth ${m.queueDepth}`);
    console.log(`      Runtime:  CPU ${m.cpuSaturationPct}% | GPU ${m.gpuUtilizationPct}% | RAM Delta +${m.memoryGrowthMb}MB | Worker Saturation ${m.workerSaturationPct}%`);
    console.log(`      WS Sync:  WebSocket Connection Retention ${m.webSocketStabilityPct}%`);
    console.log(`      SLO Compliance (${rep.sloCompliance.length}/${rep.sloCompliance.length} Passed):`);
    rep.sloCompliance.forEach(s => {
      console.log(`        - [${s.sloCompliant ? 'PASS' : 'FAIL'}] ${s.slo.operationName.padEnd(35)}: P95 ${s.actualP95Ms}ms (SLO <= ${s.slo.targetP95Ms}ms) | P99 ${s.actualP99Ms}ms (SLO <= ${s.slo.targetP99Ms}ms) | DB ${s.actualDbLatencyMs}ms`);
    });
    console.log('');
  });

  console.log('--- Adversarial P3 Production Load Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP3Suite.passedScenarios}/${evidence.adversarialP3Suite.totalScenarios}`);
  evidence.adversarialP3Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P3 GATE STATUS: ${evidence.overallStatus}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P3 Production Load Test Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P3 Production Load Test Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P3 Qualification Runner:', err);
  process.exit(1);
}
