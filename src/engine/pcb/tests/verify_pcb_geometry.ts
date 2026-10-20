/**
 * SECP Industrial OS - PCB Acceptance Tests Executor
 * Self-contained executable verifying Stage 1 and Stage 2 assertions:
 * Canonical Integrity, Electrical Connectivity, Geometry DRC, and Mechanical Fit.
 */

import { PcbHardAcceptanceGate } from '../PcbHardAcceptanceGate';

export function runPcbSuite() {
  const report = PcbHardAcceptanceGate.runGate();

  console.log('======================================================================');
  console.log(`SECP INDUSTRIAL OS — PCB HARD ACCEPTANCE GATE (19 ASSERTIONS)`);
  console.log(`STATUS: ${report.passed ? 'PASSED (100%)' : 'FAILED'}`);
  console.log(`PASSED: ${report.passedCount}/${report.totalAssertions} in ${report.executionTimeMs.toFixed(2)}ms`);
  console.log('======================================================================');

  for (const a of report.assertions) {
    const symbol = a.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${symbol}] ${a.id.padEnd(12)} [${a.category.padEnd(12)}] ${a.description}`);
    console.log(`       ↳ ${a.details}`);
  }

  return report;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('verify_pcb_geometry.ts')) {
  const report = runPcbSuite();
  if (!report.passed) {
    process.exit(1);
  }
}
