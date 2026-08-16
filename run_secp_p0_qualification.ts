import { HardAcceptanceGateP0 } from './src/engine/validation/HardAcceptanceGateP0';

console.log('=== SECP PHASE P0: PRODUCTION ENVIRONMENT QUALIFICATION ===\n');

try {
  const evidence = HardAcceptanceGateP0.evaluateQualification();

  console.log('--- Environment Verification (13 Infrastructure & Platform Elements) ---');
  const env = evidence.environmentQualification;
  console.log(`  [${env.productionDeployment.passed ? 'PASS' : 'FAIL'}] Production Deployment: ${env.productionDeployment.details}`);
  console.log(`  [${env.productionDatabase.passed ? 'PASS' : 'FAIL'}] Production Database: ${env.productionDatabase.details}`);
  console.log(`  [${env.productionObjectStorage.passed ? 'PASS' : 'FAIL'}] Production Object Storage: ${env.productionObjectStorage.details}`);
  console.log(`  [${env.productionQueue.passed ? 'PASS' : 'FAIL'}] Production Event Queue: ${env.productionQueue.details}`);
  console.log(`  [${env.productionObservability.passed ? 'PASS' : 'FAIL'}] Production Observability: ${env.productionObservability.details}`);
  console.log(`  [${env.productionAuthentication.passed ? 'PASS' : 'FAIL'}] Production Authentication: ${env.productionAuthentication.details}`);
  console.log(`  [${env.tls.passed ? 'PASS' : 'FAIL'}] TLS 1.3 & HSTS: ${env.tls.details}`);
  console.log(`  [${env.backup.passed ? 'PASS' : 'FAIL'}] Backup Engine & RPO: ${env.backup.details}`);
  console.log(`  [${env.restore.passed ? 'PASS' : 'FAIL'}] Restore Engine & Verification: ${env.restore.details}`);
  console.log(`  [${env.monitoring.passed ? 'PASS' : 'FAIL'}] Synthetic Health Monitoring: ${env.monitoring.details}`);
  console.log(`  [${env.alerting.passed ? 'PASS' : 'FAIL'}] Alerting & Escalation Matrix: ${env.alerting.details}`);
  console.log(`  [${env.auditLogging.passed ? 'PASS' : 'FAIL'}] Audit Logging & Immutable Trail: ${env.auditLogging.details}`);
  console.log(`  [${env.disasterRecovery.passed ? 'PASS' : 'FAIL'}] Disaster Recovery & Multi-Region RTO: ${env.disasterRecovery.details}\n`);

  console.log('--- Core Proof Requirements (7 Critical Verification Gates) ---');
  const proof = evidence.coreProofRequirements;
  console.log(`  [${proof.canDeployFromCleanCopy.passed ? 'PASS' : 'FAIL'}] Clean Deployment Capability: ${proof.canDeployFromCleanCopy.details}`);
  console.log(`  [${proof.canRestoreSystemFromBackup.passed ? 'PASS' : 'FAIL'}] System Restore Capability: ${proof.canRestoreSystemFromBackup.details}`);
  console.log(`  [${proof.canRestoreDatabase.passed ? 'PASS' : 'FAIL'}] Database Restore Capability: ${proof.canRestoreDatabase.details}`);
  console.log(`  [${proof.canRestoreArtifacts.passed ? 'PASS' : 'FAIL'}] Artifacts Restore Capability: ${proof.canRestoreArtifacts.details}`);
  console.log(`  [${proof.noTestDataLeaked.passed ? 'PASS' : 'FAIL'}] Zero Test Data Leakage: ${proof.noTestDataLeaked.details}`);
  console.log(`  [${proof.noDevKeys.passed ? 'PASS' : 'FAIL'}] Zero Development Keys / Defaults: ${proof.noDevKeys.details}`);
  console.log(`  [${proof.noDummyDataInProductionPaths.passed ? 'PASS' : 'FAIL'}] Zero Dummy/Mock Data in Prod Paths: ${proof.noDummyDataInProductionPaths.details}\n`);

  console.log('--- Adversarial P0 Qualification Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP0Suite.passedScenarios}/${evidence.adversarialP0Suite.totalScenarios}`);
  evidence.adversarialP0Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P0 GATE STATUS: ${evidence.overallStatus}`);
  console.log(`PRODUCTION PILOT DECISION: ${evidence.productionPilotDecision}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P0 Production Environment Qualification Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P0 Production Environment Qualification Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P0 Qualification Runner:', err);
  process.exit(1);
}
