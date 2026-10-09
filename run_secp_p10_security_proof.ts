import { HardAcceptanceGateP10 } from './src/engine/validation/HardAcceptanceGateP10';

console.log('=== SECP PHASE P10: INDEPENDENT SECURITY ASSESSMENT & PRODUCTION PROOF GATE ===\n');

try {
  const evidence = HardAcceptanceGateP10.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P10 Gate Status:        ${arch.overallP10GateStatus}`);
  console.log(`  Physical Hardware Attestation: ${arch.physicalHardwareAttestationP6B}`);
  console.log(`  P10-A 13 Security Domains:    ${arch.p10ASecurityDomains13Evaluated}`);
  console.log(`  P10-B Audit Trail Traceability: ${arch.p10BAuditTrailTraceability}`);
  console.log(`  P10-C Independent Pen-Testing:  ${arch.p10CIndependentPenetrationAssessment}`);
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

  console.log('--- Security Assessment Summary ---');
  const sec = evidence.securityProductionReport;
  console.log(`  Assessment Type:                ${sec.assessmentType}`);
  console.log(`  Total Security Domains:         ${sec.totalDomainsEvaluated}/13`);
  console.log(`  Total Controls Verified:        ${sec.totalControlsVerified}`);
  console.log(`  Critical Vulnerabilities:       ${sec.criticalVulnerabilitiesCount} (Expected: 0)`);
  console.log(`  High Vulnerabilities:           ${sec.highVulnerabilitiesCount} (Expected: 0)`);
  console.log(`  Audit Trail Traceability Rate:  ${sec.auditTrailTraceabilityPct}%\n`);

  console.log('--- 13 Production Security Domains Breakdown & Audit Trail Verification ---');
  sec.domainResults.forEach(d => {
    const aud = d.auditRecord;
    console.log(`  [${d.passed ? 'PASS' : 'FAIL'}] ${d.domainId} - ${d.domainName}`);
    console.log(`      Controls Evaluated: ${d.controlsEvaluatedCount} | Vulnerabilities: ${d.vulnerabilitiesFoundCount}`);
    console.log(`      Attack Vector Trapped: ${d.attackVectorTrapped} | Audit Trail Verified: ${d.auditTrailVerified}`);
    console.log(`      Audit Event: [${aud.eventId}] ${aud.actor} -> ${aud.action} (${aud.threatLevel})`);
    console.log(`      Details: ${d.details}\n`);
  });

  console.log('--- Adversarial P10 Penetration Testing Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP10Suite.passedScenarios}/${evidence.adversarialP10Suite.totalScenarios}`);
  evidence.adversarialP10Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P10 GATE STATUS: ${evidence.overallStatus} (${arch.overallP10GateStatus})`);
  console.log(`PHYSICAL HARDWARE ATTESTATION (P6-B): ${arch.physicalHardwareAttestationP6B}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P10 Security Production Proof Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P10 Security Production Proof Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P10 Security Qualification Runner:', err);
  process.exit(1);
}
