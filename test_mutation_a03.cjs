const { GCSRunner } = require('./src/engine/benchmark/gcs/GCSRunner');
const { GCSBenchmarkCaseRegistry } = require('./src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry');

(async () => {
  try {
    const allCases = GCSBenchmarkCaseRegistry.getAllCases();
    const caseA03 = allCases.find(c => c.id === 'GCS-A03-RECTANGLE');
    const r = await GCSRunner.executeCase(caseA03);
    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
