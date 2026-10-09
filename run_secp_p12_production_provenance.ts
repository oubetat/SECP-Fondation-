import { HardAcceptanceGateP12 } from './src/engine/validation/HardAcceptanceGateP12';

console.log('=== SECP PHASE P12: PRODUCTION PROVENANCE & PRODUCTION PROOF SCORE (SECP-PPS) GATE ===\n');

try {
  const evidence = HardAcceptanceGateP12.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P12 Gate Status:        ${arch.overallP12GateStatus}`);
  console.log(`  Physical Hardware Attestation: ${arch.physicalHardwareAttestationP6B}`);
  console.log(`  SECP Production Proof Score:  ${arch.secpProductionProofScorePps}`);
  console.log(`  Critical Penalty Filter:       ${arch.criticalPenaltyFilterStatus}`);
  console.log(`  Production Evidence Record:    ${arch.productionEvidenceRecordSigned}`);
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

  console.log('--- Production Evidence Record Details ---');
  const rec = evidence.provenanceReport.evidenceRecord;
  console.log(`  Test ID:                        ${rec.testId}`);
  console.log(`  Environment ID:                 ${rec.environmentId}`);
  console.log(`  Software Version:               ${rec.softwareVersion}`);
  console.log(`  Kernel Version:                 ${rec.kernelVersion}`);
  console.log(`  Database Version:               ${rec.databaseVersion}`);
  console.log(`  Infrastructure Fingerprint:     ${rec.infrastructureFingerprint}`);
  console.log(`  Dataset Fingerprint:            ${rec.datasetFingerprint}`);
  console.log(`  User/Test Operator:            ${rec.userTestOperator}`);
  console.log(`  Start Timestamp:                ${rec.startTimestamp}`);
  console.log(`  End Timestamp:                  ${rec.endTimestamp}`);
  console.log(`  Failures / Remediation:         ${rec.failuresCount} failures | ${rec.remediationActionTaken}`);
  console.log(`  SHA-256 Provenance Signature:   ${rec.sha256Provenance}\n`);

  console.log('--- SECP Production Proof Score (SECP-PPS) Weighted Dimensions Breakdown ---');
  const pps = evidence.provenanceReport.ppsReport;
  console.log(`  Overall SECP-PPS Score: ${pps.overallPpsScorePct.toFixed(2)} / 100.00 (${pps.overallPpsStatus})`);
  console.log(`  Critical Penalty Filter Triggered: ${pps.criticalPenaltyTriggered ? 'YES (FAIL)' : 'NO (PASS)'}\n`);

  pps.domains.forEach(d => {
    console.log(`  [${d.passed ? 'PASS' : 'FAIL'}] ${d.domainId} - ${d.domainName.padEnd(28)} | Weight: ${d.weightPct}% | Raw Score: ${d.rawScorePct.toFixed(1)}% -> Weighted: ${d.weightedScorePct.toFixed(2)}%`);
    console.log(`      Details: ${d.details}\n`);
  });

  console.log('--- Adversarial P12 Production Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP12Suite.passedScenarios}/${evidence.adversarialP12Suite.totalScenarios}`);
  evidence.adversarialP12Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P12 GATE STATUS: ${evidence.overallStatus} (${arch.overallP12GateStatus})`);
  console.log(`SECP PRODUCTION PROOF SCORE (SECP-PPS): ${arch.secpProductionProofScorePps}`);
  console.log(`CRITICAL PENALTY FILTER: ${arch.criticalPenaltyFilterStatus}`);
  console.log(`PHYSICAL HARDWARE ATTESTATION (P6-B): ${arch.physicalHardwareAttestationP6B}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P12 Production Provenance Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P12 Production Provenance Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P12 Production Provenance Runner:', err);
  process.exit(1);
}
