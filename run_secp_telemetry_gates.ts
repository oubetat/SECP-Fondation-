import { HardAcceptanceGate330 } from './src/engine/digital_twin/HardAcceptanceGate330';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v3: PATCH-330 REAL-TIME TELEMETRY GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate330.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Active Ingested Stream Snapshot ---');
  if (report.streamStateSnapshot) {
    console.log(`  Active Registered Streams:    ${report.streamStateSnapshot.length}`);
    report.streamStateSnapshot.forEach(s => {
      console.log(`    - ${s.streamId}: Source=${s.sourceId}, Mode=${s.sourceMode}, Rate=${s.configuredSamplingRate}Hz, Status=${s.status}`);
    });
    console.log('');
  }

  console.log('--- Telemetry Verification Checklist (Mandatory Checks) ---');
  console.log(`  Total assertions checked:     ${report.details.length}`);
  console.log('  Showing critical checks:\n');
  report.details.forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Evaluation Execution Logs ---');
  report.executionLogs.forEach((log, idx) => {
    console.log(`  [LOG ${idx + 1}] ${log}`);
  });
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - REAL-TIME TELEMETRY ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Real-Time Telemetry Evaluation Runner:', err);
  process.exit(1);
}
