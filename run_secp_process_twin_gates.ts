import { HardAcceptanceGate328 } from './src/engine/digital_twin/HardAcceptanceGate328';

console.log('================================================================================');
console.log('=== SECP INDUSTRIAL OS v2: PATCH-328 PROCESS DIGITAL TWIN GATE EVALUATION ===');
console.log('================================================================================\n');

try {
  const report = HardAcceptanceGate328.runGate();

  console.log('--- Overall Status & Verdict ---');
  console.log(`  Gate Passed:                  ${report.passed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(`  Verdict:                      ${report.verdict}`);
  console.log(`  Assertions Run:               ${report.totalAssertions}`);
  console.log(`  Passed Assertions:            ${report.passedCount}/${report.totalAssertions}`);
  console.log(`  Failed Assertions:            ${report.failedCount}\n`);

  console.log('--- Process Digital Twin Evidence ---');
  if (report.processTwinState) {
    const ts = report.processTwinState;
    console.log(`  Twin ID:                      ${ts.twin.processTwinId}`);
    console.log(`  Process ID:                   ${ts.twin.processId}`);
    console.log(`  Lifecycle State:              ${ts.twin.lifecycleState}`);
    console.log(`  Plant & Line ID:              ${ts.twin.plantId} - ${ts.twin.productionLineId}`);
    console.log(`  Part ID & Rev:                ${ts.twin.partId} ${ts.twin.partRevision}`);
    console.log(`  Process Type:                 ${ts.twin.processType}`);
    console.log(`  Revision & Description:       ${ts.revision.revisionNumber} (${ts.revision.changeDescription})`);
    console.log(`  Sequential Operations:        ${ts.operations.length}`);
    console.log(`  Machine Binding ID:           ${ts.bindings.machine.machineId}`);
    console.log(`  Tool Binding ID:              ${ts.bindings.tool.toolId} (R=${ts.bindings.tool.toolOffset.radiusMm}mm)`);
    console.log(`  NC Program Bound:             ${ts.bindings.nc.ncProgramId}`);
    console.log(`  Active Bound Parameters:      ${ts.parameters.length}`);
    console.log(`  Completeness Score:           ${ts.completenessScore}/100%`);
    console.log(`  Maturity Model Level:         LEVEL ${ts.maturityLevel} (Validated Process Twin)\n`);
  }

  console.log('--- Stage-by-Stage Verification ---');
  console.log(`  Total assertions checked: ${report.details.length}`);
  console.log('  Showing critical checks:\n');
  report.details.filter(d => !d.includes('AUX_CHECK')).forEach(detail => {
    console.log(`  ${detail}`);
  });
  console.log('');

  console.log('--- Execution Logs ---');
  report.executionLogs.forEach((log, idx) => {
    console.log(`  [LOG ${idx + 1}] ${log}`);
  });
  console.log('\n================================================================================');
  console.log('FINAL PRODUCTION DECISION:');
  console.log(`  - PROCESS DIGITAL TWIN GATE ACCEPTANCE: ${report.passed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================================\n');

  process.exit(report.passed ? 0 : 1);
} catch (err) {
  console.error('FATAL EXCEPTION in Process Digital Twin Evaluation Runner:', err);
  process.exit(1);
}
