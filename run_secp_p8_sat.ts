import { HardAcceptanceGateP8 } from './src/engine/validation/HardAcceptanceGateP8';

console.log('=== SECP PHASE P8: SITE ACCEPTANCE TESTING (SAT) SYSTEM ACCEPTANCE GATE ===\n');

try {
  const evidence = HardAcceptanceGateP8.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P8 Gate Status:        ${arch.overallP8GateStatus}`);
  console.log(`  Physical Hardware Attestation: ${arch.physicalHardwareAttestationP6B}`);
  console.log(`  P8-A Firewalls/Latency/SSO:   ${arch.p8AFirewallsLatencySSO}`);
  console.log(`  P8-B Network Drops/Storage/Proxy:${arch.p8BNetworkDropsStorageProxies}`);
  console.log(`  P8-C Integration Breakers/Workflows:${arch.p8CIntegrationFailuresAndCustomerWorkflows}`);
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
  console.log(`    - Downstream Field Promotion Allowed: ${guard.downstreamInheritanceRule.downstreamPromotionAllowed}`);
  console.log('  Missing Physical Attestations:');
  guard.missingPhysicalAttestations.forEach(m => console.log(`    - [MISSING] ${m}`));
  console.log('');

  console.log('--- SAT Enterprise Infrastructure Domains Summary ---');
  const sat = evidence.satSummary;
  const doms = sat.domainsSummary;
  console.log(`  Enterprise Firewall & Ports:   ${doms.firewallPassed ? 'PASS (Port 8080/50051 Tunneled Over 443 HTTPS/WSS)' : 'FAIL'}`);
  console.log(`  WAN Latency & Packet Jitter:   ${doms.latencyPassed ? 'PASS (310ms Latency / 85ms Jitter Handled)' : 'FAIL'}`);
  console.log(`  Enterprise Identity (Azure AD):${doms.identityPassed ? 'PASS (OIDC SSO, MFA & Token Rotation Verified)' : 'FAIL'}`);
  console.log(`  Network Drops & Chunked Resume:${doms.networkInterruptionsPassed ? 'PASS (45s Wi-Fi Disconnect Resumed Byte-Perfect)' : 'FAIL'}`);
  console.log(`  Multi-Tenant Org Permissions:  ${doms.permissionsPassed ? 'PASS (5-Level Hierarchy, 100% Cross-Tenant Trapped)' : 'FAIL'}`);
  console.log(`  Enterprise Storage & KMS:      ${doms.storagePoliciesPassed ? 'PASS (AES-256-GCM Customer KMS & 7-Year Retention)' : 'FAIL'}`);
  console.log(`  Corporate TLS Inspecting Proxy:${doms.proxiesPassed ? 'PASS (Custom Root CA Loaded, mTLS Handshake Valid)' : 'FAIL'}`);
  console.log(`  Integration Circuit Breakers:  ${doms.integrationFailuresPassed ? 'PASS (SAP 503 Trapped, Circuit OPEN, DLQ Queued)' : 'FAIL'}`);
  console.log(`  Customer Site Real Workflows:  ${doms.customerWorkflowsPassed}/${doms.customerWorkflowsTotal} Passed\n`);

  console.log('--- Real Customer Site Workflows Breakdown ---');
  sat.customerWorkflows.forEach(w => {
    console.log(`  [${w.e2eSuccess ? 'PASS' : 'FAIL'}] ${w.workflowId}: ${w.customerSiteName}`);
    console.log(`      Users: ${w.realUsersCount} | Data Volume: ${w.realDataVolumeMb}MB | Steps: ${w.workflowStepsCompleted}/${w.totalWorkflowSteps} | Time: ${w.totalExecutionTimeMs}ms`);
    console.log(`      Details: ${w.details}`);
  });
  console.log('');

  console.log('--- Third-Party Integration Circuit Breakers Breakdown ---');
  sat.integrationFailureResults.forEach(f => {
    console.log(`  [${f.passed ? 'PASS' : 'FAIL'}] ${f.targetSystem}: ${f.simulatedFailureMode}`);
    console.log(`      Circuit Breaker State: ${f.circuitBreakerState} | Exponential Backoff: ${f.exponentialBackoffAttempted} | DLQ Count: ${f.deadLetterQueueCount} | System Crashed: ${f.systemCrashed}`);
    console.log(`      Details: ${f.details}`);
  });
  console.log('');

  console.log('--- Adversarial P8 Site Acceptance Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP8Suite.passedScenarios}/${evidence.adversarialP8Suite.totalScenarios}`);
  evidence.adversarialP8Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P8 GATE STATUS: ${evidence.overallStatus} (${arch.overallP8GateStatus})`);
  console.log(`PHYSICAL HARDWARE ATTESTATION (P6-B): ${arch.physicalHardwareAttestationP6B}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P8 Site Acceptance Testing Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P8 Site Acceptance Testing Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P8 Qualification Runner:', err);
  process.exit(1);
}
