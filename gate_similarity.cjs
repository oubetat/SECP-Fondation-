const fs = require('fs');
const path = require('path');

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
const gates = [];

for (const file of gateFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const size = Buffer.byteLength(content, 'utf8');
  const loc = content.split('\n').length;
  gates.push({ file, size, loc });
}

// Group by LOC
const byLoc = {};
for(const g of gates) {
   if(!byLoc[g.loc]) byLoc[g.loc] = 0;
   byLoc[g.loc]++;
}

console.log("Distribution by LOC:");
Object.entries(byLoc).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([loc, count]) => {
   if(count > 2) console.log(`${loc} LOC: ${count} files`);
});

