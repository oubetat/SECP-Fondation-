import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate148 } from '../../src/engine/engineering_hpc/HardAcceptanceGate148';
import { HardAcceptanceGate148_REVA } from '../../src/engine/engineering_hpc/HardAcceptanceGate148_REVA';
import { HardAcceptanceGate148_REVB } from '../../src/engine/engineering_hpc/HardAcceptanceGate148_REVB';

async function runVerification() {
  console.log('================================================================');
  console.log('  SECP Industrial OS v2 — Distributed FEM (PATCH-148 COMPLETE)');
  console.log('  Distributed Finite Element Engineering Solver Quality Gate');
  console.log('================================================================');

  const coreResults = await HardAcceptanceGate148.runAllTests();

  console.log('\nResults Summary (PATCH-148 Core):');
  console.log(`Total Tests: ${coreResults.length}`);
  const corePassedCount = coreResults.filter(r => r.passed).length;
  console.log(`Passed Tests: ${corePassedCount}`);
  const coreScore = (corePassedCount / coreResults.length) * 100;
  console.log(`Overall Score: ${coreScore.toFixed(2)}%`);
  const coreVerdict = corePassedCount === coreResults.length ? 'PASS' : 'FAIL';
  console.log(`Core Verdict: ${coreVerdict}`);

  console.log('\nDetailed Breakdown (PATCH-148 Core):');
  for (const res of coreResults) {
    const mark = res.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${mark} ${res.gateId}: ${res.description}`);
    console.log(`   Verdict: ${res.verdict}`);
    console.log(`   Details: ${res.details}`);
  }

  console.log('\n================================================================');
  console.log('  SECP Industrial OS v2 — Distributed FEM — REV.A EXTENSIONS');
  console.log('  Distributed FEM Integrity & Robustness Extensions Quality Gate');
  console.log('================================================================');

  const revaRun = await HardAcceptanceGate148_REVA.runAllTests();
  const revaResults = revaRun.results;
  const revaQual = revaRun.qualification;

  console.log('\nResults Summary (PATCH-148 — REV.A):');
  console.log(`Total Tests: ${revaResults.length}`);
  const revaPassedCount = revaResults.filter(r => r.passed).length;
  console.log(`Passed Tests: ${revaPassedCount}`);
  const revaScore = (revaPassedCount / revaResults.length) * 100;
  console.log(`Overall Score: ${revaScore.toFixed(2)}%`);
  const revaVerdict = (revaPassedCount === revaResults.length && revaQual.state === 'QUALIFIED') ? 'PASS' : 'FAIL';
  console.log(`REV.A Verdict: ${revaVerdict}`);

  console.log('\nDetailed Breakdown (PATCH-148 — REV.A):');
  for (const res of revaResults) {
    const mark = res.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${mark} ${res.gateId}: ${res.description}`);
    console.log(`   Verdict: ${res.verdict}`);
    console.log(`   Details: ${res.details}`);
  }

  console.log('\n================================================================');
  console.log('  SECP Industrial OS v2 — Distributed FEM — REV.B EXTENSIONS');
  console.log('  Distributed FEM Numerical Integrity Extensions Quality Gate');
  console.log('================================================================');

  const revbRun = await HardAcceptanceGate148_REVB.runAllTests();
  const revbResults = revbRun.results;
  const revbQual = revbRun.qualification;

  console.log('\nResults Summary (PATCH-148 — REV.B):');
  console.log(`Total Tests: ${revbResults.length}`);
  const revbPassedCount = revbResults.filter(r => r.passed).length;
  console.log(`Passed Tests: ${revbPassedCount}`);
  const revbScore = (revbPassedCount / revbResults.length) * 100;
  console.log(`Overall Score: ${revbScore.toFixed(2)}%`);
  const revbVerdict = (revbPassedCount === revbResults.length && revbQual.state === 'QUALIFIED') ? 'PASS' : 'FAIL';
  console.log(`REV.B Verdict: ${revbVerdict}`);

  console.log('\nDetailed Breakdown (PATCH-148 — REV.B):');
  for (const res of revbResults) {
    const mark = res.passed ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${mark} ${res.gateId}: ${res.description}`);
    console.log(`   Verdict: ${res.verdict}`);
    console.log(`   Details: ${res.details}`);
  }

  const finalPassed = coreVerdict === 'PASS' && revaVerdict === 'PASS' && revbVerdict === 'PASS';
  const finalVerdict = finalPassed ? 'PASS' : 'FAIL';

  console.log('\n================================================================');
  console.log(`FINAL COMPREHENSIVE VERDICT: ${finalVerdict}`);
  console.log('================================================================');

  const reportDir = path.join(process.cwd(), 'reports', 'engineering-hpc', 'patch-148');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, `verification-report-${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        patch: 'PATCH-148-REV.B-COMPLETE',
        title: 'Distributed FEM — Complete HPC & Integrity Extensions',
        timestamp: new Date().toISOString(),
        coreSummary: {
          totalTests: coreResults.length,
          passedTests: corePassedCount,
          score: coreScore,
          verdict: coreVerdict
        },
        revaSummary: {
          totalTests: revaResults.length,
          passedTests: revaPassedCount,
          score: revaScore,
          verdict: revaVerdict,
          qualificationState: revaQual.state
        },
        revbSummary: {
          totalTests: revbResults.length,
          passedTests: revbPassedCount,
          score: revbScore,
          verdict: revbVerdict,
          qualificationState: revbQual.state
        },
        finalVerdict,
        coreResults,
        revaResults,
        revaQualification: revaQual,
        revbResults,
        revbQualification: revbQual
      },
      null,
      2
    )
  );

  console.log(`\nReport generated at: ${reportPath}`);
  if (!finalPassed) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal error running PATCH-148 / REV.B verification:', err);
  process.exit(1);
});
