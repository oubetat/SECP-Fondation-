(async () => {
  const { GCSBenchmarkCaseRegistry } = await import('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts');
  const { GCSRunner } = await import('./src/engine/benchmark/gcs/GCSRunner.ts');
  const { GCSIndependentGeometricOracle } = await import('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle.ts');
  const { IndustrialVariationalSolver } = await import('./src/engine/sketch/IndustrialVariationalSolver.ts');

  const c3 = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-A03-RECTANGLE');
  const sketch = c3.generator().sketch;
  const solver = new IndustrialVariationalSolver();
  const solved = solver.solve(sketch).sketch;
  
  // Mutate solved geometry
  solved.entities['p1'].x += 5; // Introduce 5mm error

  const validation = GCSIndependentGeometricOracle.verifySketch(solved, 1e-4);
  console.log("A03 ORACLE MUTATION CAUGHT:", !validation.satisfied, "Max Error:", validation.maxError);

})();
