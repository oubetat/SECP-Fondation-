const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.name.includes('HardAcceptanceGate') && fullPath.endsWith('.ts')) files.push(fullPath);
  }
  return files;
}

const gateFiles = walk('src');
console.log(`Found ${gateFiles.length} HardAcceptanceGate files.`);

const gates = [];
const hashGroups = {};
const exactHashGroups = {};

for (const file of gateFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const size = Buffer.byteLength(content, 'utf8');
  const loc = content.split('\n').length;
  
  const imports = (content.match(/^import .*/gm) || []).length;
  const exports = (content.match(/export (class|const|function|interface|type|enum)/g) || []).length;
  const isExecutable = content.includes('function') || content.includes('class') || content.includes('=>');
  const isTestOnly = content.includes('describe(') || content.includes('it(') || content.includes('test(') || content.includes('assert(') || content.includes('AssertionError');

  // Exact Hash
  const exactHash = crypto.createHash('sha256').update(content).digest('hex');
  if (!exactHashGroups[exactHash]) exactHashGroups[exactHash] = [];
  exactHashGroups[exactHash].push(file);

  // Near duplicate hash (strip comments, whitespace, class names, gate IDs)
  let normalized = content
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // remove comments
    .replace(/\s+/g, '') // remove whitespace
    .replace(/HardAcceptanceGate\d+/g, 'GATE_CLASS')
    .replace(/PATCH\d+_[a-zA-Z0-9_]+/g, 'GATE_ID');
  
  const structHash = crypto.createHash('sha256').update(normalized).digest('hex');
  
  if (!hashGroups[structHash]) hashGroups[structHash] = [];
  hashGroups[structHash].push(file);

  gates.push({ file, size, loc, imports, exports, isExecutable, isTestOnly });
}

const uniqueImplementations = Object.keys(hashGroups).length;
const exactDuplicatesCount = Object.values(exactHashGroups).filter(arr => arr.length > 1).reduce((acc, arr) => acc + arr.length - 1, 0);

let boilerplateCount = 0;
let nearDuplicates = 0;

for (const hash in hashGroups) {
  const count = hashGroups[hash].length;
  if (count > 1) {
    nearDuplicates += (count - 1); // everything after the first is a duplicate
    // If there are many of the same structure, it's boilerplate
    if (count > 5) {
      boilerplateCount += count;
    }
  }
}

console.log(`\n=== DUPLICATE ANALYSIS ===`);
console.log(`Total Gate Files: ${gateFiles.length}`);
console.log(`Exact Duplicates: ${exactDuplicatesCount}`);
console.log(`Unique Implementations: ${uniqueImplementations}`);
console.log(`Near-duplicates (Structural): ${nearDuplicates}`);
console.log(`Boilerplate Wrappers (groups > 5): ${boilerplateCount}`);

