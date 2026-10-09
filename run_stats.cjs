const fs = require('fs');
const path = require('path');
const excludes = ['.git', 'node_modules', 'dist', 'build', '.cache'];
let stats = {
  totalFiles: 0, totalDirs: 0, sourceFiles: 0, testFiles: 0,
  gateFiles: 0, verifierFiles: 0, evidenceFiles: 0, scripts: 0,
  configFiles: 0, docFiles: 0, backupFiles: 0
};
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      stats.totalDirs++; walk(fullPath);
    } else {
      stats.totalFiles++;
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx', '.cpp', '.hpp'].includes(ext)) stats.sourceFiles++;
      if (fullPath.includes('test') || fullPath.includes('__tests__') || entry.name.includes('.test.')) stats.testFiles++;
      if (entry.name.includes('HardAcceptanceGate') || entry.name.includes('gate') || entry.name.includes('Gate')) stats.gateFiles++;
      if (entry.name.includes('Verifier') || entry.name.includes('Validator')) stats.verifierFiles++;
      if (entry.name.includes('Evidence') || entry.name.includes('Provenance') || entry.name.includes('Proof')) stats.evidenceFiles++;
      if (ext === '.sh' || fullPath.includes('scripts/')) stats.scripts++;
      if (['.json', '.yaml', '.yml', '.config.ts', '.config.js', 'CMakeLists.txt'].includes(entry.name) || entry.name === 'package.json') stats.configFiles++;
      if (ext === '.md' || ext === '.txt' && !entry.name.includes('verdict')) stats.docFiles++;
      if (entry.name.includes('backup') || entry.name.includes('archive') || entry.name.includes('old') || entry.name.includes('legacy')) stats.backupFiles++;
    }
  }
}
walk('.');
console.log(JSON.stringify(stats, null, 2));
