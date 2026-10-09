import { HardAcceptanceGate329 } from './src/engine/digital_twin/HardAcceptanceGate329';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v2: PATCH-329 SENSOR INTEGRATION GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate329.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Connected Sensor Network State ---');
  if (report.sensorSuiteState) {
    const state = report.sensorSuiteState;
    console.log(`  Active Registered Sensors:    ${state.sensors.length}`);
    state.sensors.forEach(s => {
      console.log(`    - ${s.sensorId}: Type=${s.sensorType}, Loc=${s.location}, Status=${s.status}, Health=${s.health}`);
    });
    console.log(`  Calibration Records Loaded:   ${state.calibrations.length}`);
    console.log(`  Active Logged Faults:         ${state.faults.length}`);
    console.log(`  Discovered Networks:          ${state.discoveries.length} nodes found`);
    console.log(`  Normalized Reading Ex:        SNS-TEMP-329 CurrentValue=${state.readings[0].value}${state.readings[0].unit} (Raw=${state.readings[0].rawValue})\n`);
  }

  console.log('--- Gateway Verification Checklist (Mandatory Checks) ---');
  const criticalChecks = report.details.filter(d => !d.includes('AUX_CHECK'));
  console.log(`  Total assertions checked:     ${report.details.length}`);
  console.log('  Showing critical checks:\n');
  criticalChecks.forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Evaluation Execution Logs ---');
  report.executionLogs.forEach((log, idx) => {
    console.log(`  [LOG ${idx + 1}] ${log}`);
  });
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - SENSOR INTEGRATION ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Sensor Integration Evaluation Runner:', err);
  process.exit(1);
}
