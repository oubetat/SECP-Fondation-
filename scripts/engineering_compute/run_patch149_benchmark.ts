/**
 * PATCH-149 — Verification Script
 * SECP Industrial OS v2 — HPC / GPU / Cloud Phase
 */

import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate149 } from '../../src/engine/engineering_hpc/HardAcceptanceGate149';

async function runBenchmarkVerification() {
  console.log('================================================================');
  console.log('  SECP Industrial OS v2 — Solver Scaling Benchmark (PATCH-149)');
  console.log('  REV.A — Operational Reality & Measurement Integrity');
  console.log('  HPC / GPU / Cloud Quality Gate & Performance Verification');
  console.log('================================================================');

  try {
    const run = await HardAcceptanceGate149.runAllTests();
    const results = run.results;
    const qualification = run.qualification;

    console.log('\nResults Summary:');
    console.log(`Total Tests: ${results.length}`);
    const passedCount = results.filter(r => r.passed).length;
    console.log(`Passed Tests: ${passedCount}`);
    const score = (passedCount / results.length) * 100;
    console.log(`Overall Score: ${score.toFixed(2)}%`);
    const verdict = (passedCount === results.length && qualification.state === 'QUALIFIED') ? 'PASS' : 'FAIL';
    console.log(`Final Verdict: ${verdict}`);

    console.log('\nDetailed Breakdown:');
    for (const res of results) {
      const mark = res.passed ? '✅ [PASS]' : '❌ [FAIL]';
      console.log(`${mark} ${res.gateId}: ${res.description}`);
      console.log(`   Verdict: ${res.verdict}`);
      console.log(`   Details: ${res.details}`);
    }

    if (qualification.state === 'FAILED') {
      console.log('\nCritical Failures:');
      for (const fail of qualification.criticalFailures) {
        console.log(`❌ ${fail}`);
      }
    }

    // Generate Report Artifact
    const reportDir = path.join(process.cwd(), 'reports', 'engineering-hpc', 'patch-149');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, `scaling-benchmark-report-${Date.now()}.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          patch: 'PATCH-149',
          title: 'Solver Scaling Benchmark — HPC Evidence Layer',
          timestamp: new Date().toISOString(),
          summary: {
            totalTests: results.length,
            passedTests: passedCount,
            score: score,
            verdict: verdict,
            qualificationState: qualification.state
          },
          results,
          qualification
        },
        null,
        2
      )
    );

    console.log(`\nReport generated at: ${reportPath}`);

    if (verdict !== 'PASS') {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error running PATCH-149 verification:', err);
    process.exit(1);
  }
}

runBenchmarkVerification();
