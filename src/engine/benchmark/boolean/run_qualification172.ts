/**
 * SECP Industrial OS v2 — Qualification 172 Runner Script
 */

import { HardAcceptanceGate172 } from './HardAcceptanceGate172';

console.log('=== RUNNING HARD ACCEPTANCE GATE 172 ===');
console.log('Initializing battery report...');
const gateReport = HardAcceptanceGate172.evaluate();
console.log(gateReport.formattedQualificationText);

console.log('\n=== GATE CHECKS ===');
for (const check of gateReport.checks) {
  console.log(`[${check.status}] ${check.id}: ${check.details}`);
}

console.log('\n=== CATEGORY BREAKDOWN ===');
for (const [cat, data] of Object.entries(gateReport.batteryReport.categoryBreakdown)) {
  console.log(`${cat}: total=${data.total}, passed=${data.passed}, failed=${data.failed}, unproven=${data.unproven}, invalid=${data.invalid}`);
}

console.log('\n=== MUTATION REPORT DETAILS ===');
for (const detail of gateReport.batteryReport.mutationReport.details) {
  console.log(`[${detail.detected ? 'DETECTED' : 'MISSED'}] ${detail.mutationType}: ${detail.mutationDescription}`);
  if (detail.detectedIssues.length > 0) {
    console.log(`  Issues: ${detail.detectedIssues.join('; ')}`);
  }
}
console.log('=== SUMMARY OF NON-PASSING CASES ===');
for (const record of gateReport.batteryReport.evidenceLedger) {
  if (record.verdict !== 'PASS' && record.verdict !== 'INVALID_INPUT') {
    console.log(`[${record.testId}] (${record.category}) -> Verdict: ${record.verdict}`);
    for (const diag of record.diagnostics.slice(0, 3)) {
      console.log(`   └─ ${diag}`);
    }
  }
}
