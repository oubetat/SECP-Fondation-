import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';

const alpha = 10 * Math.PI / 180;
const mesh = AirfoilMeshGenerator.generateOGrid({
  airfoilDesignation: '0012', chord: 1.0, span: 0.2,
  farFieldRadius: 10.0, numSurfacePoints: 120, numNormalLayers: 60,
  numSpanwiseLayers: 1, firstCellHeight: 1e-4, growthRate: 1.15
});

const wallFaces = mesh.faces.filter(f => f.boundaryType === 'WALL');
console.log('Total wall faces:', wallFaces.length);

let upperCount = 0;
let lowerCount = 0;

for (const f of wallFaces) {
  const isUpper = f.centroid.y >= 0;
  if (isUpper) upperCount++; else lowerCount++;
  
  const nx = f.normal.x;
  const ny = f.normal.y;
  
  if (isUpper && upperCount <= 5) {
    console.log(`Upper face x=${f.centroid.x.toFixed(4)}, y=${f.centroid.y.toFixed(4)}, nx=${nx.toFixed(4)}, ny=${ny.toFixed(4)}, nx<0: ${nx < 0}`);
  } else if (!isUpper && lowerCount <= 5) {
    console.log(`Lower face x=${f.centroid.x.toFixed(4)}, y=${f.centroid.y.toFixed(4)}, nx=${nx.toFixed(4)}, ny=${ny.toFixed(4)}, nx>0: ${nx > 0}`);
  }
}
console.log(`Upper faces: ${upperCount}, Lower faces: ${lowerCount}`);
