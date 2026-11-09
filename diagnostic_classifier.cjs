const fs = require('fs');
const content = fs.readFileSync('forensic_tsc_output.txt', 'utf8');
const lines = content.split('\n');

const stats = {
  totalRaw: 0,
  uniqueLocations: new Set(),
  errorCodes: {},
  byDirectory: { engine: 0, services: 0, components: 0, verification: 0, other: 0 },
  errorGroups: {}
};

lines.forEach(line => {
  if (line.includes('error TS')) {
    stats.totalRaw++;
    const match = line.match(/(.*)\((.*)\): error (TS\d+):/);
    if (match) {
        const [_, file, loc, code] = match;
        stats.uniqueLocations.add(`${file}:${loc}`);
        stats.errorCodes[code] = (stats.errorCodes[code] || 0) + 1;
        
        // Grouping
        if (file.includes('src/engine/')) stats.byDirectory.engine++;
        else if (file.includes('src/services/')) stats.byDirectory.services++;
        else if (file.includes('src/components/')) stats.byDirectory.components++;
        else if (file.includes('src/verification/')) stats.byDirectory.verification++;
        else stats.byDirectory.other++;
    }
  }
});

const output = {
    totalRaw: stats.totalRaw,
    uniqueLocationsCount: stats.uniqueLocations.size,
    errorCodes: stats.errorCodes,
    byDirectory: stats.byDirectory
};

fs.writeFileSync('diagnostic_classification.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
