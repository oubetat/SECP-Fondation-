import { HardAcceptanceGate326 } from './src/engine/digital_twin/HardAcceptanceGate326';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v2: PATCH-326 DIGITAL TWIN ACCEPTANCE GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate326.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Digital Twin Validation Evidence ---');
  if (report.evidencePackage) {
    const ep = report.evidencePackage;
    console.log(`  Twin ID:                      ${ep.twinId}`);
    console.log(`  Asset Type:                   ${ep.assetRegistration.type}`);
    console.log(`  Bound Asset ID:               ${ep.assetRegistration.assetId}`);
    console.log(`  Manufacturer & Model:          ${ep.assetRegistration.manufacturer} ${ep.assetRegistration.model}`);
    console.log(`  Active Geometry Revision:      ${ep.geometryRevision}`);
    console.log(`  Sensors Connected:             ${ep.sensorMapping.length}`);
    console.log(`  Telemetry Ingested Readings:   ${ep.telemetryEvidenceCount}`);
    console.log(`  Completeness Score:           ${ep.completenessScore}/100%`);
    console.log(`  Twin Readiness Level (TRL):   LEVEL ${ep.readinessLevel} (Validated Twin)\n`);
  }

  console.log('--- Stage-by-Stage Verification ---');
  report.details.forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Execution Logs ---');
  report.executionLogs.forEach((log, idx) => {
    console.log(`  [LOG ${idx + 1}] ${log}`);
  });
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - DIGITAL TWIN PIPELINE ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Digital Twin Evaluation Runner:', err);
  process.exit(1);
}
