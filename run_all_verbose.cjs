(async () => {
  const { GCSBenchmarkBattery } = await import('./src/engine/benchmark/gcs/GCSBenchmarkBattery.ts');
  const { GCSBenchmarkCaseRegistry } = await import('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts');
  const { GCSRunner } = await import('./src/engine/benchmark/gcs/GCSRunner.ts');
  
  const cases = GCSBenchmarkCaseRegistry.getAllCases();
  for (const c of cases) {
    console.log("Running:", c.id);
    try {
      const res = await GCSRunner.executeCase(c);
      console.log("Finished:", c.id, "Verdict:", res.verdict);
    } catch (e) {
      console.log("Error:", c.id, e.message);
    }
  }
})();
