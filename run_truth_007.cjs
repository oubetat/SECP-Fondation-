const { ProductionGCSBenchmarkSuite } = require('./src/engine/benchmark/gcs/ProductionGCSBenchmarkSuite');

(async () => {
  console.log('=== BENCH-TRUTH-007: PRODUCTION BATTERY REALITY RUN ===\n');
  
  try {
    const report = ProductionGCSBenchmarkSuite.runAll();
    
    // 2 & 3. Print full report and metrics
    console.log('--- FULL JSON REPORT ---');
    console.log(JSON.stringify(report, null, 2));
    console.log('------------------------\n');
    
    console.log('--- CORE METRICS ---');
    console.log(`Battery ID: ${report.batteryId}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Cases: ${report.totalCases}`);
    console.log(`Passed Cases: ${report.passedCases}`);
    console.log(`Failed Cases: ${report.failedCases}`);
    console.log(`Pass Rate: ${report.passRatePercent}%`);
    console.log(`Avg Solve Time: ${report.averageSolveTimeMs}ms`);
    console.log(`p50: ${report.p50SolveTimeMs}ms, p95: ${report.p95SolveTimeMs}ms, p99: ${report.p99SolveTimeMs}ms`);
    console.log(`Determinism Verified: ${report.determinismVerified}\n`);

    // 4. Per case details
    console.log('--- PER CASE EXECUTION TRACE ---');
    report.caseResults.forEach(r => {
      console.log(`\n[${r.caseId}] ${r.name}`);
      console.log(`  Category: ${r.category}`);
      console.log(`  Expected State: ${r.expectedState}`);
      console.log(`  Actual State: ${r.actualState}`);
      console.log(`  Passed: ${r.passed}`);
      console.log(`  Iterations: ${r.iterations}`);
      console.log(`  Residual Norm: ${r.residualNorm}`);
      console.log(`  Solve Time: ${r.solveTimeMs}ms`);
      console.log(`  Oracle Verdict: ${r.oracleReport.verdict}`);
      console.log(`  Diagnostics: ${JSON.stringify(r.diagnostics)}`);
    });

    // 7. Independent consistency check
    console.log('\n--- INDEPENDENT METRIC RECOMPUTATION ---');
    const computedTotal = report.caseResults.length;
    const computedPassed = report.caseResults.filter(r => r.passed === true).length;
    const computedFailed = report.caseResults.filter(r => r.passed === false).length;
    const computedPassRate = (computedPassed / computedTotal) * 100;

    console.log(`Recomputed Total: ${computedTotal} (Report: ${report.totalCases})`);
    console.log(`Recomputed Passed: ${computedPassed} (Report: ${report.passedCases})`);
    console.log(`Recomputed Failed: ${computedFailed} (Report: ${report.failedCases})`);
    console.log(`Recomputed Pass Rate: ${computedPassRate}% (Report: ${report.passRatePercent}%)`);

  } catch (e) {
    console.error('CRITICAL EXECUTION EXCEPTION');
    console.error('Type:', e.constructor.name);
    console.error('Message:', e.message);
    console.error('Stack:', e.stack);
  }
})();
