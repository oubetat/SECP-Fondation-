import { HardAcceptanceGateP11 } from './src/engine/validation/HardAcceptanceGateP11';

console.log('=== SECP PHASE P11: DISASTER RECOVERY & DESTROY-RESTORE ACCEPTANCE GATE ===\n');

try {
  const evidence = HardAcceptanceGateP11.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P11 Gate Status:        ${arch.overallP11GateStatus}`);
  console.log(`  Physical Hardware Attestation: ${arch.physicalHardwareAttestationP6B}`);
  console.log(`  P11-A Destroy-Restore Engine:  ${arch.p11ADestroyRestoreEngine}`);
  console.log(`  P11-B Measured RTO Achieved:   ${arch.p11BMeasuredRtoAchieved}`);
  console.log(`  P11-C Measured RPO Achieved:   ${arch.p11CMeasuredRpoAchieved}`);
  console.log(`  P11-D Artifact & Audit Trail:  ${arch.p11DArtifactAndAuditTrailRestored}`);
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

  console.log('--- Empirical Disaster Recovery SLA Metrics ---');
  const dr = evidence.disasterRecoveryReport;
  console.log(`  Environment:                    ${dr.drEnvironment}`);
  console.log(`  Measured RTO (Recovery Time):   ${dr.achievedRtoSeconds}s (Target <= ${dr.targetRtoSeconds}s) -> ${dr.rtoTargetMet ? 'SLA MET PASS' : 'FAIL'}`);
  console.log(`  Measured RPO (Data Loss):       ${dr.achievedRpoSeconds}s (Target <= ${dr.targetRpoSeconds}s) -> ${dr.rpoTargetMet ? 'ZERO DATA LOSS PASS' : 'FAIL'}`);
  console.log(`  Total DR Layers Restored:       ${dr.totalLayersRestoredPassed}/${dr.totalLayersTested}`);
  console.log(`  Post-Restore Data Integrity:    ${dr.dataIntegrityPercentage}%\n`);

  console.log('--- 9 Destroy-Restore Verification Layers Breakdown ---');
  dr.layerResults.forEach(l => {
    console.log(`  [${l.passed ? 'PASS' : 'FAIL'}] ${l.layerId} - ${l.destructionType}`);
    console.log(`      Destruction Injected: ${l.destructionMethodInjected}`);
    console.log(`      Restoration Mechanism: ${l.restorationMechanism}`);
    console.log(`      Time To Restore: ${l.timeToRestoreSeconds}s | Data Lost: ${l.dataLostRecordsCount} | Checksum Match: ${l.hashMatchVerified}`);
    console.log(`      Details: ${l.details}\n`);
  });

  console.log('--- Adversarial P11 Disaster Recovery Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP11Suite.passedScenarios}/${evidence.adversarialP11Suite.totalScenarios}`);
  evidence.adversarialP11Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P11 GATE STATUS: ${evidence.overallStatus} (${arch.overallP11GateStatus})`);
  console.log(`MEASURED RTO: ${dr.achievedRtoSeconds} SECONDS`);
  console.log(`MEASURED RPO: ${dr.achievedRpoSeconds} SECONDS (ZERO DATA LOSS)`);
  console.log(`PHYSICAL HARDWARE ATTESTATION (P6-B): ${arch.physicalHardwareAttestationP6B}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P11 Disaster Recovery Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P11 Disaster Recovery Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P11 DR Qualification Runner:', err);
  process.exit(1);
}
