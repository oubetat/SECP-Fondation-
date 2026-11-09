const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Run tsc and capture output
  const output = execSync('npx tsc --noEmit -p tsconfig.json', { encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  const output = error.stdout || '';
  const lines = output.split('\n');
  const counts = { engine: 0, services: 0, components: 0, verification: 0, other: 0, total: 0 };
  
  lines.forEach(line => {
    if (line.includes('error TS')) {
      counts.total++;
      if (line.includes('src/engine')) counts.engine++;
      else if (line.includes('src/services')) counts.services++;
      else if (line.includes('src/components')) counts.components++;
      else if (line.includes('src/verification')) counts.verification++;
      else counts.other++;
    }
  });
  
  fs.writeFileSync('error_report.json', JSON.stringify(counts, null, 2));
}
