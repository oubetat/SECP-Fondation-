const fs = require('fs');
const files = [
  'src/engine/cfd3d/conservation/energy/EnergyControlVolumeBalance.ts',
  'src/engine/cfd3d/conservation/CellMassBalance.ts',
  'src/engine/cfd3d/conservation/momentum/MomentumControlVolumeBalance.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/for \(const face of mesh\.faces\.filter[^\n]+?const fIdx = face\.id;/g, 
    'const attachedFaces = mesh.faces.filter(f => f.ownerCellId === cellIdx || f.neighborCellId === cellIdx); for (const f_item of attachedFaces) { const fIdx = f_item.id;');
  fs.writeFileSync(file, content);
}
