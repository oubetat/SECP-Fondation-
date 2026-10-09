import { BaselineTruthCollector } from './src/engine/validation/baseline/BaselineTruthCollector';
import { BaselineTruthReport } from './src/engine/validation/baseline/BaselineTruthReport';
import { BaselineTruthGate } from './src/engine/validation/baseline/BaselineTruthGate';

async function main() {
  console.log('====================================================');
  console.log('SECP Industrial OS v2 — Baseline Truth Runner');
  console.log('Phase 0: Restoration & Truth Recovery');
  console.log('====================================================\n');

  console.log('[1/4] Collecting baseline truth across all 11 engineering domains...');
  const reportData = BaselineTruthCollector.collectBaselineTruth();

  console.log('[2/4] Saving JSON & Markdown Baseline Truth reports...');
  const jsonPath = BaselineTruthReport.saveJsonReport(reportData);
  const mdPath = BaselineTruthReport.generateMarkdownReport(reportData);
  console.log(`  -> JSON Report: ${jsonPath}`);
  console.log(`  -> Markdown Report: ${mdPath}`);

  console.log('[3/4] Evaluating BaselineTruthGate...');
  const gateResult = BaselineTruthGate.evaluate(reportData);
  console.log(`  -> Gate Verdict: ${gateResult.verdict}`);
  gateResult.checks.forEach((c) => {
    console.log(`     [${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.reason}`);
  });

  console.log('[4/4] Saving Evidence report...');
  const evidencePath = BaselineTruthReport.saveEvidenceReport(reportData, [], gateResult);
  console.log(`  -> Evidence Report: ${evidencePath}\n`);

  console.log('====================================================');
  console.log('CAPABILITY STATUS SUMMARY');
  console.log('====================================================');
  console.log(`PRODUCTION_READY : ${reportData.summary.productionReady}`);
  console.log(`WORKING          : ${reportData.summary.working}`);
  console.log(`UNPROVEN         : ${reportData.summary.unproven}`);
  console.log(`SIMULATED        : ${reportData.summary.simulated}`);
  console.log(`FAILED           : ${reportData.summary.failed}`);
  console.log(`TOTAL EVALUATED  : ${reportData.capabilities.length}`);
  console.log('====================================================\n');

  if (gateResult.verdict === 'FAIL') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal runner exception:', err);
  process.exit(1);
});
