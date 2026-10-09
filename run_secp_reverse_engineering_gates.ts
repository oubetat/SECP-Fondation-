import { HardAcceptanceGate325 } from './src/engine/reverse_engineering/features/HardAcceptanceGate325';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v2: PATCH-325 SCAN-TO-CAD ACCEPTANCE GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate325.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Metrology Validation Metrics ---');
  if (report.evidencePackage) {
    const metrics = report.evidencePackage.validationMetrics;
    console.log(`  Point-to-CAD RMSE:            ${metrics.pointToCadRmse.toFixed(5)} mm`);
    console.log(`  CAD-to-Point RMSE:            ${metrics.cadToPointRmse.toFixed(5)} mm`);
    console.log(`  Maximum Local Deviation:       ${metrics.maxDeviation.toFixed(5)} mm`);
    console.log(`  Euler Characteristic Matches:  ${metrics.eulerMatches ? 'YES' : 'NO'}`);
    console.log(`  Dimensionality Matches:       ${metrics.dimensionalityMatches ? 'YES' : 'NO'}\n`);
  }

  console.log('--- Stage-by-Stage Verification ---');
  report.details.forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Execution Logs ---');
  if (report.evidencePackage) {
    report.evidencePackage.executionLogs.forEach((log, idx) => {
      console.log(`  [LOG ${idx + 1}] ${log}`);
    });
  }
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - SCAN-TO-CAD PIPELINE ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Scan-to-CAD Evaluation Runner:', err);
  process.exit(1);
}
