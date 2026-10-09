const fs = require('fs');
const file = 'src/engine/assembly/clash/BroadPhaseDetector.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    } else {
      // Default unit box fallback
      localCorners = [
        { x: -1, y: -1, z: -1 },
        { x: 1, y: 1, z: 1 },
      ];
    }`;

const replacement = `    } else {
      throw new Error("UNAVAILABLE: Cannot determine bounding box for empty or degenerate geometry without fabricating a synthetic box.");
    }`;

if (code.includes(target)) {
  fs.writeFileSync(file, code.replace(target, replacement));
  console.log('Patched');
} else {
  console.log('Target not found');
}
