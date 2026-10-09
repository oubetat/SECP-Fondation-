(async () => {
  const { GCSBenchmarkCaseRegistry } = await import('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts');
  const { GCSRunner } = await import('./src/engine/benchmark/gcs/GCSRunner.ts');

  // A03 Mutation
  let c3 = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-A03-RECTANGLE');
  const origGen3 = c3.generator;
  c3.generator = () => {
    const res = origGen3();
    // MUTATION: Force point coordinate after generation but before solver, wait, solver takes sketch
    // Let's modify the benchmark constraint target value to create an inconsistency 
    res.sketch.constraints['c-w'].value = 80; // Changed from 60 to 80
    return res;
  };
  const res3 = await GCSRunner.executeCase(c3);
  console.log("A03 MUTATION:", res3.verdict, "Geometric Satisfied:", res3.geometricValidation.satisfied, "State:", res3.actualState);

  // A04 Mutation
  let c4 = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-A04-CIRCLES-TANGENCY');
  const origGen4 = c4.generator;
  c4.generator = () => {
    const res = origGen4();
    res.sketch.constraints['c-r1'].value = 30; // Changed from 20 to 30
    return res;
  };
  const res4 = await GCSRunner.executeCase(c4);
  console.log("A04 MUTATION:", res4.verdict, "Geometric Satisfied:", res4.geometricValidation.satisfied, "State:", res4.actualState);

})();
