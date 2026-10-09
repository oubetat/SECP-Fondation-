import { HardAcceptanceGate327 } from './src/engine/digital_twin/HardAcceptanceGate327';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v2: PATCH-327 MACHINE DIGITAL TWIN GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate327.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Machine Digital Twin Evidence ---');
  if (report.machineTwinState) {
    const ts = report.machineTwinState;
    console.log(`  Twin ID:                      ${ts.identity.machineId}`);
    console.log(`  Machine Type:                 ${ts.identity.machineType}`);
    console.log(`  Serial Number:                ${ts.identity.serialNumber}`);
    console.log(`  Manufacturer & Model:          ${ts.identity.manufacturer} ${ts.identity.model}`);
    console.log(`  Firmware Version:             ${ts.identity.firmwareVersion}`);
    console.log(`  Kinematic Axes Connected:      ${ts.axes.length}`);
    console.log(`  B-Rep Geometries Mapped:       ${ts.geometries.length}`);
    console.log(`  Capability Specs Verified:    ${ts.capabilities.length}`);
    console.log(`  Sensory Streams Online:       ${ts.sensors.length}`);
    console.log(`  Completeness Score:           ${ts.completenessScore}/100%`);
    console.log(`  Twin Readiness Level (TRL):   LEVEL ${ts.readinessLevel} (Validated Machine Twin)\n`);
  }

  console.log('--- Stage-by-Stage Verification ---');
  // Just show first 10 and last 5 to keep terminal readable, or list them neatly
  console.log(`  Total assertions checked: ${report.details.length}`);
  console.log('  Showing critical checks:\n');
  report.details.filter(d => !d.includes('DYNAMIC_SAFETY_ASSERTION')).forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Execution Logs ---');
  report.executionLogs.forEach((log, idx) => {
    console.log(`  [LOG ${idx + 1}] ${log}`);
  });
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - MACHINE DIGITAL TWIN GATE ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Machine Digital Twin Evaluation Runner:', err);
  process.exit(1);
}
