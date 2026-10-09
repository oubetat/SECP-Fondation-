import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate143 } from '../../src/engine/engineering_webgpu/HardAcceptanceGate143';

async function runVerification() {
  console.log('================================================================');
  console.log('  SECP Industrial OS v2 — WebGPU Compute Layer (PATCH-143)');
  console.log('  WebGPU Engineering Compute, Qualification & Evidence Gate');
  console.log('================================================================');

  const results = await HardAcceptanceGate143.runAllTests();

  console.log('\nResults Summary:');
  console.log(`Total Tests: ${results.length}`);
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Passed Tests: ${passedCount}`);
  const score = (passedCount / results.length) * 100;
  console.log(`Overall Score: ${score.toFixed(2)}%`);
  const finalVerdict = passedCount === results.length ? 'PASS' : 'FAIL';
  console.log(`Verdict: ${finalVerdict}`);

  console.log('\nDetailed Breakdown:');
  for (const res of results) {
    const mark = res.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${mark} ${res.gateId}: ${res.description}`);
    console.log(`   Verdict: ${res.verdict}`);
    console.log(`   Details: ${res.details}`);
  }

  const reportDir = path.join(process.cwd(), 'reports', 'engineering-webgpu', 'patch-143');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'acceptance_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        patch: 'PATCH-143',
        title: 'WebGPU Engineering Compute — HPC / GPU / Cloud Layer',
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: results.length,
          passedTests: passedCount,
          score,
          verdict: finalVerdict
        },
        results
      },
      null,
      2
    )
  );

  console.log(`\nAcceptance report saved to: ${reportPath}`);

  if (finalVerdict !== 'PASS') {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error running PATCH-143 verification:', err);
  process.exit(1);
});
