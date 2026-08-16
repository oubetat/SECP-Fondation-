import { HardAcceptanceGateP6 } from './src/engine/validation/HardAcceptanceGateP6';

console.log('=== SECP PHASE P6: INDUSTRIAL DATA PIPELINE & BLIND ANOMALY BENCHMARK ===\n');

try {
  const evidence = HardAcceptanceGateP6.evaluateQualification();

  console.log('--- Overall Architecture Qualification Status ---');
  const arch = evidence.overallArchitectureStatus;
  console.log(`  Overall P6 Gate Status:        ${arch.overallP6GateStatus}`);
  console.log(`  Industrial Field Qualification:${arch.industrialFieldQualification} (Pending Physical Site Attestation)`);
  console.log(`  P6-A Pipeline Engine:          ${arch.p6APipelineEngine}`);
  console.log(`  P6-B Source Authenticity:      ${arch.p6BSourceAuthenticityAndFieldEvidence}`);
  console.log(`  P6-C Blind Synthetic Benchmark:${arch.p6CBlindSyntheticBenchmark}\n`);

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

  console.log('--- Industrial Pipeline & Statistical Summary ---');
  const summary = evidence.pilotSummary;
  console.log(`  Evaluated Datasets Count:      ${summary.totalPilotDatasetsEvaluated} Benchmark Pilot Specs`);
  console.log(`  Total Parts Processed:         ${summary.totalPartsProcessed} Component Runs`);
  console.log(`  Total Telemetry Points Ingested:${summary.totalTelemetryPointsIngested.toLocaleString()} Points @ 50-100Hz`);
  console.log(`  IP/PII Redaction Success Rate: ${summary.ipPiiRedactionSuccessRatePct}% (100% HMAC Anonymized)`);
  console.log(`  Average SPC Process Cpk:       ${summary.averageCpkScore} (Benchmark Target >= 1.50)`);
  console.log(`  Average Manufacturing Yield:   ${summary.averageManufacturingYieldRatePct}% (Benchmark Target >= 99.0%)`);
  console.log(`  Blind Anomaly Precision:       ${summary.blindAnomalyPrecisionPct}%`);
  console.log(`  Blind Anomaly Recall:          ${summary.blindAnomalyRecallPct}%`);
  console.log(`  Blind Anomaly F1-Score:        ${summary.blindAnomalyF1Score} (Benchmark Target >= 0.95)`);
  console.log(`  Measurement System Gage R&R:   ${summary.gageRAndRPctGrr}% GRR (AIAG Target <= 10.0%)`);
  console.log(`  Process In Statistical Control:${summary.overallSpcProcessInControlRatePct}%\n`);

  console.log('--- Industrial Dataset Evaluation Breakdown ---');
  evidence.pilotDatasetReports.forEach(rep => {
    const spec = rep.spec;
    const spc = rep.spcAnalytics;
    const msa = rep.gageRAndR;
    const ano = rep.blindAnomaly;
    const q = rep.qualityInspection;
    console.log(`  [${rep.overallStatus}] Dataset ${spec.id}: ${spec.datasetTitle}`);
    console.log(`      Evaluation Mode: ${rep.evaluationMode} | Tier: ${rep.qualificationTier}`);
    console.log(`      Partner Spec: ${spec.partnerConsent.companyName} (${spec.partnerConsent.industrySector})`);
    console.log(`      NDA Ref: ${spec.partnerConsent.ndaReferenceId} | Redaction: ${rep.ipRedactionStatus.redactionSuccessPct}%`);
    console.log(`      CAD & Production: ${spec.totalPartCount} Parts (${spec.cadFormat}) | Tolerance ±${spec.targetToleranceMm}mm`);
    console.log(`      Gage R&R (%GRR): ${msa.repeatabilityAndReproducibilityPctGrr}% | Distinct Categories (ndc): ${msa.numberOfDistinctCategoriesNdc} | Status: ${msa.msaStatus}`);
    console.log(`      Blind Anomaly Evaluation: F1: ${ano.f1Score} (Precision: ${ano.precision}, Recall: ${ano.recall}, Latency: ${ano.detectionLatencyMs}ms)`);
    console.log(`      SPC Rigor Analytics: Cp ${spc.cp} | Cpk ${spc.cpk} | Pp ${spc.pp} | Ppk ${spc.ppk} | Shapiro-Wilk W: ${spc.shapiroWilkNormalityW}`);
    console.log(`      3D CMM Quality: ${q.scannedPointsCount.toLocaleString()} Points Scanned | ${q.gdAndTFeatureMatchesCount} GD&T Features Matched | Yield ${rep.yieldRatePct}%`);
    console.log(`      Diagnostics:`);
    rep.diagnostics.forEach(d => console.log(`        - ${d}`));
    console.log('');
  });

  console.log('--- Adversarial P6 Industrial Data Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP6Suite.passedScenarios}/${evidence.adversarialP6Suite.totalScenarios}`);
  evidence.adversarialP6Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P6 GATE STATUS: ${evidence.overallStatus} (${arch.overallP6GateStatus})`);
  console.log(`INDUSTRIAL FIELD QUALIFICATION: ${arch.industrialFieldQualification}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P6 Industrial Data Pipeline Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P6 Industrial Data Pipeline Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P6 Qualification Runner:', err);
  process.exit(1);
}
