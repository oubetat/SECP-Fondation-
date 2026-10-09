const fs = require('fs');
const crypto = require('crypto');

const filesToHash = [
  'src/engine/benchmark/gcs/GCSRunner.ts',
  'src/engine/sketch/IndustrialVariationalSolver.ts',
  'src/engine/benchmark/gcs/GCSBenchmarkCaseRegistry.ts',
  'src/engine/benchmark/gcs/GCSBenchmarkBattery.ts',
  'src/engine/benchmark/gcs/GCSIndependentGeometricOracle.ts',
  'src/engine/benchmark/gcs/GCSIndependentGraphAuditor.ts',
  'src/engine/benchmark/gcs/GCSDeterminismAuditor.ts'
];

let state = "";
for (const file of filesToHash) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    state += `${file} - SHA256: ${hash}\n`;
  } else {
    state += `${file} - NOT FOUND\n`;
  }
}
fs.writeFileSync('gcs_state.txt', state);
