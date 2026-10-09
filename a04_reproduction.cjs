(async () => {
  const { GCSBenchmarkCaseRegistry } = await import('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts');
  const { GCSRunner } = await import('./src/engine/benchmark/gcs/GCSRunner.ts');

  const c = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-A04-CIRCLES-TANGENCY');
  if (!c) {
    console.error("GCS-A04-CIRCLES-TANGENCY not found");
    return;
  }
  const result = await GCSRunner.executeCase(c);
  console.log(JSON.stringify(result, null, 2));
})();
