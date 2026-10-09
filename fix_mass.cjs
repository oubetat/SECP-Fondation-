const fs = require('fs');
const files = [
  'src/engine/physics/conservation/MassConservation.ts',
  'src/engine/physics/conservation/MomentumConservation.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/f\.boundaryId/g, '(f as any).boundaryId');
  content = content.replace(/f\.sourceId/g, '(f as any).sourceId');
  fs.writeFileSync(file, content);
}
