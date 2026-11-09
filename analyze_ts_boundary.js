import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const rootDir = process.cwd();

// 1. Production Entry Points
const productionEntryPoints = [
  path.resolve(rootDir, 'src/main.tsx'),
  path.resolve(rootDir, 'server.ts'),
  path.resolve(rootDir, 'index.html'),
  path.resolve(rootDir, 'src/App.tsx')
];

// Test Entry Points
const testEntryPoints = [
  path.resolve(rootDir, 'vitest.config.ts'),
  path.resolve(rootDir, 'src/test/setup.ts')
];

// Find all test files in src/ and root
function findTestFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        results = results.concat(findTestFiles(filePath));
      }
    } else {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts') || file.endsWith('.spec.tsx')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const allTestFiles = findTestFiles(path.resolve(rootDir, 'src')).concat(findTestFiles(rootDir));
allTestFiles.forEach(f => testEntryPoints.push(f));

// Aliases from vite.config.ts
const aliases = {
  'motion/react': 'framer-motion',
  'buffer': path.resolve(rootDir, 'src/polyfills/buffer.ts'),
  'crypto': path.resolve(rootDir, 'src/polyfills/crypto.ts'),
  'node:crypto': path.resolve(rootDir, 'src/polyfills/crypto.ts'),
  'node:buffer': path.resolve(rootDir, 'src/polyfills/buffer.ts')
};

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.d.ts', '/index.ts', '/index.tsx', '/index.js', '/index.d.ts'];

function resolveImport(importSpec, importer) {
  if (aliases[importSpec]) {
    const target = aliases[importSpec];
    if (target.startsWith('/')) return target;
    return null; // external module
  }

  let basePaths = [];
  if (importSpec.startsWith('.')) {
    basePaths.push(path.resolve(path.dirname(importer), importSpec));
  } else if (importSpec.startsWith('/')) {
    basePaths.push(path.resolve(importSpec));
  } else if (importSpec.startsWith('src/')) {
    basePaths.push(path.resolve(rootDir, importSpec));
  } else {
    // maybe relative to root or src
    basePaths.push(path.resolve(rootDir, 'src', importSpec));
    basePaths.push(path.resolve(rootDir, importSpec));
  }

  for (const absPath of basePaths) {
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) return absPath;
    for (const ext of extensions) {
      if (fs.existsSync(absPath + ext) && fs.statSync(absPath + ext).isFile()) return absPath + ext;
    }
  }

  return null;
}

function extractImports(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = new Set();

  // Match import/export ... from '...'
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Match dynamic import('...')
  const dynamicRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  // Match require('...')
  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

// 2. Build Production Reachability Map
const productionReachable = new Set();
const prodQueue = [...productionEntryPoints];

while (prodQueue.length > 0) {
  const current = prodQueue.pop();
  if (!current || productionReachable.has(current)) continue;
  productionReachable.add(current);

  const importedSpecs = extractImports(current);
  for (const spec of importedSpecs) {
    const resolved = resolveImport(spec, current);
    if (resolved && !productionReachable.has(resolved)) {
      prodQueue.push(resolved);
    }
  }
}

// 3. Build Test Reachability Map
const testReachable = new Set();
const testQueue = [...testEntryPoints];

while (testQueue.length > 0) {
  const current = testQueue.pop();
  if (!current || testReachable.has(current)) continue;
  testReachable.add(current);

  const importedSpecs = extractImports(current);
  for (const spec of importedSpecs) {
    const resolved = resolveImport(spec, current);
    if (resolved && !testReachable.has(resolved)) {
      testQueue.push(resolved);
    }
  }
}

console.log(`Production Reachable Files: ${productionReachable.size}`);
console.log(`Test Reachable Files: ${testReachable.size}`);

// 4. Read tsc_final.txt
const tscLog = fs.readFileSync(path.resolve(rootDir, 'tsc_final.txt'), 'utf-8');
const lines = tscLog.split('\n');

const diagnostics = [];
let currentDiag = null;

const diagRegex = /^([^(]+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = diagRegex.exec(line);
  if (match) {
    if (currentDiag) {
      diagnostics.push(currentDiag);
    }
    const relFile = match[1].trim();
    const absFile = path.resolve(rootDir, relFile);
    currentDiag = {
      index: diagnostics.length + 1,
      file: relFile,
      absPath: absFile,
      line: parseInt(match[2], 10),
      col: parseInt(match[3], 10),
      severity: match[4],
      code: match[5],
      message: match[6].trim(),
      raw: line
    };
  } else if (currentDiag && line.startsWith('  ')) {
    currentDiag.message += ' ' + line.trim();
  }
}
if (currentDiag) {
  diagnostics.push(currentDiag);
}

console.log(`Total Parsed Diagnostics: ${diagnostics.length}`);

// 5. Classify Diagnostics
const classificationCounts = {
  PRODUCTION_DIRECT: 0,
  PRODUCTION_TRANSITIVE: 0,
  SHARED_PRODUCTION_EXPERIMENTAL: 0,
  TEST_ONLY: 0,
  EXPERIMENTAL_UNREACHABLE: 0,
  HISTORICAL_UNREACHABLE: 0,
  UNRESOLVED: 0
};

const categorizedDiags = diagnostics.map(d => {
  const isProd = productionReachable.has(d.absPath);
  const isTest = testReachable.has(d.absPath);
  const isDirectProdEntry = productionEntryPoints.includes(d.absPath) || d.file === 'src/App.tsx' || d.file === 'src/main.tsx' || d.file === 'server.ts';

  let classification = 'UNRESOLVED';
  let reachabilityEvidence = '';

  if (isProd && isDirectProdEntry) {
    classification = 'PRODUCTION_DIRECT';
    reachabilityEvidence = 'Directly imported as root production entry point or core App container';
  } else if (isProd && isTest) {
    classification = 'SHARED_PRODUCTION_EXPERIMENTAL';
    reachabilityEvidence = 'Reachable via production import graph AND test harness execution graph';
  } else if (isProd) {
    classification = 'PRODUCTION_TRANSITIVE';
    reachabilityEvidence = 'Reachable via transitive import chain from main.tsx / server.ts';
  } else if (isTest) {
    classification = 'TEST_ONLY';
    reachabilityEvidence = 'Reachable only from vitest runner / test suites; absent from production bundle graph';
  } else if (d.file.startsWith('src/')) {
    classification = 'EXPERIMENTAL_UNREACHABLE';
    reachabilityEvidence = 'File located in src/ but orphan/unreachable from production entry points (main.tsx/server.ts)';
  } else {
    classification = 'HISTORICAL_UNREACHABLE';
    reachabilityEvidence = 'Historical script / audit runner / gate file outside src/ and unreachable from production';
  }

  classificationCounts[classification]++;

  return {
    ...d,
    classification,
    reachabilityEvidence,
    isProductionReachable: isProd
  };
});

console.log('Classification Summary:', classificationCounts);

// Write summary details
const prodDiags = categorizedDiags.filter(d => d.isProductionReachable);
console.log(`Total Production Reachable Diagnostics: ${prodDiags.length}`);

// Domain attribution for production diags
const prodDiagsByDomain = {};
prodDiags.forEach(d => {
  const domainMatch = d.file.match(/^src\/engine\/([^\/]+)/) || d.file.match(/^src\/([^\/]+)/);
  const domain = domainMatch ? domainMatch[1] : 'root';
  prodDiagsByDomain[domain] = (prodDiagsByDomain[domain] || 0) + 1;
});
console.log('Production Diagnostics by Domain/Subsystem:', prodDiagsByDomain);
