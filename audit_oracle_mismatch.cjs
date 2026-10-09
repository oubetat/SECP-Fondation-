const { GCSIndependentGeometricOracle } = require('./src/engine/benchmark/gcs/GCSIndependentGeometricOracle');
const { ProductionGCSBenchmarkSuite } = require('./src/engine/benchmark/gcs/ProductionGCSBenchmarkSuite');

(async () => {
  const caseG01 = ProductionGCSBenchmarkSuite.getAllCaseGenerators().find(g => g().id === 'G01-3D-POINT-ALIGNMENT')();
  
  const report = GCSIndependentGeometricOracle.verify(
    caseG01.entities,
    caseG01.constraints,
    { state: 'SOLVED' }
  );

  console.log('=== ORACLE MISMATCH AUDIT ===');
  console.log('Case ID:', caseG01.id);
  console.log('Verdict:', report.verdict);
  console.log('Max Error:', report.maxError);
  
  // Need to see the internal GeometricOracleResult to see evaluatedConstraints
  const sketch = { entities: caseG01.entities, constraints: caseG01.constraints };
  const internalRes = GCSIndependentGeometricOracle.verifySketch(sketch);
  console.log('Evaluated Constraints:', internalRes.evaluatedConstraints);
  console.log('Violations Count:', internalRes.violations.length);
  if (internalRes.details.length > 0) {
     console.log('First Detail:', internalRes.details[0]);
  } else {
     console.log('NO DETAILS GENERATED');
  }
})();
