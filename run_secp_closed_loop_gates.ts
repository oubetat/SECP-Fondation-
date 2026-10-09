import { HardAcceptanceGate334 } from './src/engine/closed_loop/HardAcceptanceGate334';

function runClosedLoopGates() {
  console.log('================================================================================');
  console.log('        SECP INDUSTRIAL OS v3 — CLOSED-LOOP ENGINEERING (PATCH-334)          ');
  console.log('================================================================================\n');

  const gate = new HardAcceptanceGate334();
  const result = gate.runAcceptanceSuite();

  console.log('\n--- Evaluation Execution Logs ---');
  result.executionLogs.forEach(log => console.log(`  ${log}`));

  console.log('\n================================================================================');
  console.log(`FINAL PRODUCTION DECISION:`);
  console.log(`  - CLOSED-LOOP ENGINEERING ACCEPTANCE: ${result.verdict}`);
  console.log('================================================================================\n');

  if (result.verdict !== 'PASS') {
    process.exit(1);
  }
}

runClosedLoopGates();
