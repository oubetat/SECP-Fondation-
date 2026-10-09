(async () => {
  const { GCSBenchmarkBattery } = await import('./src/engine/benchmark/gcs/GCSBenchmarkBattery.ts');
  console.log("Running Full Battery...");
  const report = await GCSBenchmarkBattery.runFullBattery();
  console.log('Overall Verdict:', report.overallVerdict);
  console.log('Passed:', report.passedCount, '/', report.totalCases);
  if (report.failedCount > 0) {
     report.records.filter(r => r.verdict !== 'PASS').forEach(r => {
        console.log("FAILED:", r.testId, r.verdict, r.actualState);
     });
  }
})();
