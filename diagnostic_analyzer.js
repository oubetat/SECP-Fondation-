const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Use a temporary file to store output to avoid buffer issues with huge outputs
  execSync('npx tsc --noEmit -p tsconfig.json > full_tsc_output.txt 2>&1');
} catch (e) {
  // Expected to fail with exit code 2 if there are errors
}

const content = fs.readFileSync('full_tsc_output.txt', 'utf8');
const lines = content.split('\n');

const stats = {
  totalErrors: 0,
  byDirectory: {
    engine: 0,
    services: 0,
    components: 0,
    verification: 0,
    other: 0
  }
};

lines.forEach(line => {
  if (line.includes('error TS')) {
    stats.totalErrors++;
    if (line.includes('src/engine/')) stats.byDirectory.engine++;
    else if (line.includes('src/services/')) stats.byDirectory.services++;
    else if (line.includes('src/components/')) stats.byDirectory.components++;
    else if (line.includes('src/verification/')) stats.byDirectory.verification++;
    else stats.byDirectory.other++;
  }
});

fs.writeFileSync('diagnostic_summary.json', JSON.stringify(stats, null, 2));
console.log(JSON.stringify(stats, null, 2));
