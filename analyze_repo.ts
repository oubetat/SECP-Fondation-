import * as fs from 'fs';
import * as path from 'path';

const excludes = ['.git', 'node_modules', 'dist', 'build', '.cache'];

let stats = {
  totalFiles: 0,
  totalDirs: 0,
  sourceFiles: 0,
  testFiles: 0,
  gateFiles: 0,
  verifierFiles: 0,
  evidenceFiles: 0,
  scripts: 0,
  configFiles: 0,
  docFiles: 0,
  backupFiles: 0,
};

let files: any[] = [];
let dirs: string[] = [];

function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.includes(entry.name)) continue;
    
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      stats.totalDirs++;
      dirs.push(fullPath);
      walk(fullPath);
    } else {
      stats.totalFiles++;
      const ext = path.extname(entry.name);
      let content = '';
      let loc = 0;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
        loc = content.split('\n').length;
      } catch (e) {}

      files.push({ path: fullPath, name: entry.name, ext, loc, content });

      if (['.ts', '.tsx', '.js', '.jsx', '.cpp', '.hpp'].includes(ext)) {
        stats.sourceFiles++;
      }
      if (fullPath.includes('test') || fullPath.includes('__tests__') || entry.name.includes('.test.')) {
        stats.testFiles++;
      }
      if (entry.name.includes('HardAcceptanceGate') || entry.name.includes('gate') || entry.name.includes('Gate')) {
        stats.gateFiles++;
      }
      if (entry.name.includes('Verifier') || entry.name.includes('Validator')) {
        stats.verifierFiles++;
      }
      if (entry.name.includes('Evidence') || entry.name.includes('Provenance') || entry.name.includes('Proof')) {
        stats.evidenceFiles++;
      }
      if (ext === '.sh' || fullPath.includes('scripts/')) {
        stats.scripts++;
      }
      if (['.json', '.yaml', '.yml', '.config.ts', '.config.js', 'CMakeLists.txt'].includes(entry.name) || entry.name === 'package.json') {
        stats.configFiles++;
      }
      if (ext === '.md' || ext === '.txt' && !entry.name.includes('verdict')) {
        stats.docFiles++;
      }
      if (entry.name.includes('backup') || entry.name.includes('archive') || entry.name.includes('old') || entry.name.includes('legacy')) {
        stats.backupFiles++;
      }
    }
  }
}

walk('.');

console.log("=== 1. TOTALS ===");
console.log(JSON.stringify(stats, null, 2));

console.log("\n=== 7. TOP 30 FILES BY LOC ===");
files.sort((a, b) => b.loc - a.loc).slice(0, 30).forEach((f, i) => {
  console.log(`${i+1}. ${f.path} - ${f.loc} LOC`);
});

const srcDirMap = new Map();
const engineDirMap = new Map();

files.forEach(f => {
  if (f.path.startsWith('src/')) {
    const parts = f.path.split('/');
    if (parts.length > 2) {
      const topDir = parts[1];
      if (!srcDirMap.has(topDir)) srcDirMap.set(topDir, {files:0, ts:0, js:0, test:0, loc:0});
      const d = srcDirMap.get(topDir);
      d.files++;
      d.loc += f.loc;
      if (f.ext === '.ts' || f.ext === '.tsx') d.ts++;
      if (f.ext === '.js' || f.ext === '.jsx') d.js++;
      if (f.path.includes('test')) d.test++;
    }
    
    if (parts[1] === 'engine' && parts.length > 3) {
      const eDir = parts[2];
      if (!engineDirMap.has(eDir)) engineDirMap.set(eDir, {files:0, ts:0, js:0, test:0, loc:0});
      const ed = engineDirMap.get(eDir);
      ed.files++;
      ed.loc += f.loc;
      if (f.ext === '.ts' || f.ext === '.tsx') ed.ts++;
      if (f.ext === '.js' || f.ext === '.jsx') ed.js++;
      if (f.path.includes('test')) ed.test++;
    }
  }
});

console.log("\n=== 3. SRC/ DIRS ===");
for (const [k, v] of srcDirMap.entries()) console.log(k, JSON.stringify(v));

console.log("\n=== 3. SRC/ENGINE/ DIRS ===");
for (const [k, v] of engineDirMap.entries()) console.log(k, JSON.stringify(v));

console.log("\n=== 6. PATCH ARCHITECTURE ===");
const patchFiles = files.filter(f => f.name.includes('PATCH') || f.name.includes('HardAcceptanceGate') || f.name.includes('SECP') || f.name.includes('CleanRoom'));
console.log("Total Patch/Gate files:", patchFiles.length);
// Group by prefix
const gateMatches = patchFiles.filter(f => f.name.includes('HardAcceptanceGate'));
console.log("HardAcceptanceGates count:", gateMatches.length);

console.log("\n=== 8. SUSPICIOUS PATTERNS (Sample) ===");
let suspiciousCount = 0;
files.forEach(f => {
  if (f.path.startsWith('src/') && !f.path.includes('test')) {
    const lines = f.content.split('\n');
    lines.forEach((line: string, idx: number) => {
      if (line.match(/mock|fake|stub|hardcoded/i) && !line.includes('//') && line.length < 150) {
        if (suspiciousCount < 20) {
           console.log(`SUSPICIOUS: ${f.path}:${idx+1} -> ${line.trim()}`);
        }
        suspiciousCount++;
      }
    });
  }
});
console.log("Total Suspicious lines found (excluding comments):", suspiciousCount);

