import fs from 'fs';
const files = [
  'src/engine/materials/__tests__/Fatigue.test.ts',
  'src/engine/materials/__tests__/Fracture.test.ts',
  'src/engine/materials/__tests__/HeatTreatment.test.ts',
  'src/engine/materials/fatigue/HardAcceptanceGate094.ts',
  'src/engine/materials/fracture/HardAcceptanceGate095.ts',
  'src/engine/materials/heattreatment/HardAcceptanceGate096.ts',
  'src/engine/materials/temperature/HardAcceptanceGate091.ts',
  'src/engine/materials/uncertainty/HardAcceptanceGate099.ts'
];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('PropertySourceType.') && !c.includes('PropertySourceType')) {
    // Need to add import
    // But it's easier to just add it at the top
  }
  // Let's just sed directly.
}
