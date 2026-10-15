const fs = require('fs');
const filePath = 'src/engine/cfd3d/Fvm3DNavierStokesSolver.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

function findLines(query) {
  lines.forEach((l, i) => {
    if (l.includes(query)) {
      console.log(`${i+1}: ${l}`);
    }
  });
}

console.log('=== kResidual / omegaResidual / linSolve / GS_sweeps / terminationReason ===');
findLines('kResidual');
findLines('omegaResidual');
findLines('linearSolveResidual');
findLines('GS_sweeps');
findLines('terminationReason');
findLines('forceStabilityPassed');
findLines('converged');
