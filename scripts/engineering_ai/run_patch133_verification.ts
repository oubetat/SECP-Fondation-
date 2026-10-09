import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate133 } from '../../src/engine/engineering_ai/physics/HardAcceptanceGate133';

async function runVerification() {
  console.log('================================================================');
  console.log('  SECP Industrial OS v2 — Engineering AI Layer (PATCH-133)');
  console.log('  Physics Engine Verification & Acceptance Gate Execution');
  console.log('================================================================');

  const summary = HardAcceptanceGate133.evaluateGate();

  console.log(`\nResults Summary:`);
  console.log(`Total Checks: ${summary.totalChecks}`);
  console.log(`Passed Checks: ${summary.passedChecks}`);
  console.log(`Overall Score: ${summary.overallScore.toFixed(2)}%`);
  console.log(`Verdict: ${summary.verdict}`);

  console.log(`\nDetailed Check Breakdown:`);
  for (const check of summary.checks) {
    const mark = check.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${mark} ${check.gateId}: ${check.description}`);
    console.log(`   Details: ${check.details}`);
  }

  const reportDir = path.join(process.cwd(), 'reports', 'digital-twin', 'patch-133');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'acceptance_report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        patch: 'PATCH-133',
        title: 'Physics Engine — Engineering AI Layer',
        timestamp: new Date().toISOString(),
        summary
      },
      null,
      2
    )
  );

  console.log(`\nAcceptance report saved to: ${reportPath}`);

  if (summary.verdict !== 'PASS') {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error running PATCH-133 verification:', err);
  process.exit(1);
});
