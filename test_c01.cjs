(async () => {
  const { GCSBenchmarkCaseRegistry } = await import('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts');
  const { GCSRunner } = await import('./src/engine/benchmark/gcs/GCSRunner.ts');
  const c = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-C01-HORIZ-AND-VERT');
  const res = await GCSRunner.executeCase(c);
  console.log("C01 Verdict:", res.verdict, "Actual state:", res.actualState, "Residual:", res.residual);
})();
