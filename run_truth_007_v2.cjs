const { ProductionGCSBenchmarkSuite } = require('./src/engine/benchmark/gcs/ProductionGCSBenchmarkSuite');
const { NonlinearSpatialSolver } = require('./src/engine/gcs3d/NonlinearSpatialSolver');
const { GCSIndependentGeometricOracle } = require('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle');
const { performance } = require('perf_hooks');

(async () => {
  console.log('=== BENCH-TRUTH-007: PRODUCTION BATTERY REALITY RUN (SAFE VERSION) ===\n');
  
  const caseGenerators = ProductionGCSBenchmarkSuite.getAllCaseGenerators();
  console.log(`[Case Discovery] Found ${caseGenerators.length} benchmark cases.\n`);

  const results = [];
  const solveTimes = [];

  for (const gen of caseGenerators) {
    const c = gen();
    console.log(`[Executing] ${c.id}: ${c.name}`);
    
    let solverRes;
    let startTime = performance.now();
    let error = null;

    try {
      if (c.customRunner) {
        console.log(`  -> Custom Runner detected.`);
        solverRes = c.customRunner();
      } else {
        solverRes = NonlinearSpatialSolver.solve(c.entities, c.constraints);
      }
    } catch (e) {
      console.log(`  !! Execution Exception: ${e.message}`);
      error = e.message;
    }

    const solveTime = performance.now() - startTime;
    if (solverRes) solveTimes.push(solveTime);

    // Validation logic (replicated from runAll with safety)
    let isPass = false;
    let oracleReport = { verdict: 'FAIL', details: ['Validation skipped due to solver error'] };
    
    if (solverRes) {
      try {
        oracleReport = GCSIndependentGeometricOracle.verify(
          solverRes.entities,
          c.constraints,
          solverRes
        );

        const expectedState = c.expectedState;
        
        // Safety guard for dofReport
        const hasDofReport = !!solverRes.dofReport;
        if (!hasDofReport) {
           console.log(`  !! Warning: solverRes.dofReport is UNDEFINED`);
        }

        const isStateMatch = solverRes.state === expectedState ||
          (expectedState === 'FULLY_CONSTRAINED' && solverRes.converged && hasDofReport && solverRes.dofReport.remainingDOF === 0) ||
          (expectedState === 'UNDER_CONSTRAINED' && solverRes.converged && hasDofReport && solverRes.dofReport.remainingDOF > 0) ||
          (expectedState === 'OVER_CONSTRAINED' && hasDofReport && solverRes.dofReport.redundantConstraintCount > 0) ||
          (expectedState === 'CONFLICT' && solverRes.state === 'CONFLICT');

        isPass = isStateMatch && (expectedState === 'CONFLICT' || oracleReport.verdict === 'PASS');
      } catch (e) {
        console.log(`  !! Validation Exception: ${e.message}`);
        error = (error ? error + " | " : "") + "Validation: " + e.message;
      }
    }

    results.push({
      caseId: c.id,
      name: c.name,
      category: c.category,
      passed: isPass,
      expectedState: c.expectedState,
      actualState: solverRes ? solverRes.state : 'ERROR',
      hasDofReport: !!(solverRes && solverRes.dofReport),
      iterations: solverRes ? solverRes.iterations : 0,
      residualNorm: solverRes ? solverRes.residualNorm : 999,
      solveTimeMs: solveTime,
      oracleVerdict: oracleReport.verdict,
      error
    });
  }

  console.log('\n=== EXECUTION TRACE RESULTS ===\n');
  results.forEach(r => {
    console.log(`${r.caseId} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.actualState} | Oracle: ${r.oracleVerdict} | Error: ${r.error || 'None'}`);
  });

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const passRate = (passed / total) * 100;

  console.log(`\n=== INDEPENDENT METRIC RECOMPUTATION ===`);
  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${passRate.toFixed(2)}%`);

  // Specific check for G17 Node/Constraint count
  const g17Case = caseGenerators.find(g => g().id === 'G17-LARGE-CONSTRAINT-GRAPH')();
  console.log(`\n[G17 Audit] Node Count: ${Object.keys(g17Case.entities).length}, Constraint Count: ${g17Case.constraints.length}`);

})();
