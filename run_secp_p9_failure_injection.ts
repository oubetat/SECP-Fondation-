import { HardAcceptanceGateP9 } from './src/engine/validation/HardAcceptanceGateP9';

console.log('=== SECP PHASE P9: FAILURE INJECTION & ADVERSARIAL RESILIENCE ACCEPTANCE GATE ===\n');

try {
  const evidence = HardAcceptanceGateP9.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P9 Gate Status:        ${arch.overallP9GateStatus}`);
  console.log(`  Physical Hardware Attestation: ${arch.physicalHardwareAttestationP6B}`);
  console.log(`  P9-A 14 Fault Injection Scenarios: ${arch.p9AFaultInjection14Scenarios}`);
  console.log(`  P9-B 5-Stage Resilience Lifecycle: ${arch.p9BResilienceLifecycle5Stages}`);
  console.log(`  P9-C Logging Subsystem Failure Response: ${arch.p9CLoggingFailureDetectionAndResponse}`);
  console.log(`  Inherited P6-B Field Status:   ${arch.inheritedP6BFieldAuthenticity}\n`);

  console.log('--- Anti-Fabrication Firewall & Claim Boundary Evaluation ---');
  const guard = evidence.antiFabricationGuard;
  console.log(`  Claim ID:                      ${guard.claimId}`);
  console.log(`  Requested Claim:               ${guard.requestedClaim}`);
  console.log(`  Authorized Claim:              ${guard.authorizedClaim}`);
  console.log(`  Claim Blocked & Downgraded:    ${guard.claimBlockedAndDowngraded}`);
  console.log(`  Verified NDA State:            ${guard.ndaStateVerified}`);
  console.log(`  Verified MSA State:            ${guard.msaStateVerified}`);
  console.log(`  Claim Status Message:          ${guard.claimStatusText}`);
  console.log('  Downstream Inheritance Rule:');
  console.log(`    - Rule ID: ${guard.downstreamInheritanceRule.ruleId}`);
  console.log(`    - Inherited P6-A (Pipeline): ${guard.downstreamInheritanceRule.p6APipelineInherited}`);
  console.log(`    - Inherited P6-C (Benchmark): ${guard.downstreamInheritanceRule.p6CBenchmarkInherited}`);
  console.log(`    - Inherited P6-B (Field Authenticity): ${guard.downstreamInheritanceRule.p6BFieldAuthenticityInherited}`);
  console.log(`    - Downstream Field Promotion Allowed: ${guard.downstreamInheritanceRule.downstreamPromotionAllowed}\n`);

  console.log('--- Failure Injection Engine Summary ---');
  const fi = evidence.failureInjectionReport;
  console.log(`  Total Faults Injected:          ${fi.totalFaultsInjected}`);
  console.log(`  Total Faults Passed:            ${fi.totalFaultsPassed}/${fi.totalFaultsInjected}`);
  console.log(`  Total System Crashes:           ${fi.totalSystemCrashes} (Expected: 0)`);
  console.log(`  Total Data Loss Events:         ${fi.totalDataLossEvents} (Expected: 0)`);
  console.log(`  Resilience Lifecycle Success:   ${fi.resilienceLifecycleSuccessRatePct}%\n`);

  console.log('--- 14 Injected Industrial Faults Breakdown (5-Stage Resilience Lifecycle) ---');
  fi.faultResults.forEach(f => {
    const lc = f.lifecycle;
    const lcStr = `Detect:${lc.detectMs}ms | Contained:${lc.contained} | Recovered:${lc.recovered} | Audited:${lc.audited} | Resumed:${lc.resumed}`;
    console.log(`  [${f.passed ? 'PASS' : 'FAIL'}] ${f.faultId} - ${f.category}`);
    console.log(`      Details: ${f.description}`);
    console.log(`      Anomaly: ${f.injectedAnomalyDetails}`);
    console.log(`      Containment: ${f.containmentStrategy}`);
    console.log(`      Recovery: ${f.recoveryMechanism}`);
    console.log(`      Lifecycle: ${lcStr}\n`);
  });

  console.log('--- Logging Subsystem Failure & WAL Fallback Test (Fault #14 Specifics) ---');
  const logTest = fi.loggingFailureTest;
  console.log(`  [${logTest.passed ? 'PASS' : 'FAIL'}] Logging Sink Error: ${logTest.primarySinkError}`);
  console.log(`      Detection Latency: ${logTest.loggingFailureDetectedMs}ms | WAL Activated: ${logTest.secondaryWalFallbackActivated}`);
  console.log(`      Audit Trail Preserved: ${logTest.auditTrailPreserved} | Unmonitored Actions Blocked: ${logTest.unmonitoredExecutionBlocked}`);
  console.log(`      Details: ${logTest.details}\n`);

  console.log('--- Adversarial P9 Safe-Fail Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP9Suite.passedScenarios}/${evidence.adversarialP9Suite.totalScenarios}`);
  evidence.adversarialP9Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P9 GATE STATUS: ${evidence.overallStatus} (${arch.overallP9GateStatus})`);
  console.log(`PHYSICAL HARDWARE ATTESTATION (P6-B): ${arch.physicalHardwareAttestationP6B}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P9 Failure Injection Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P9 Failure Injection Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P9 Qualification Runner:', err);
  process.exit(1);
}
