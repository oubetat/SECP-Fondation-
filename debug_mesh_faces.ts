import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';

const mesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 0.1, 0.1, 2, 2, 2);
console.log('Boundary faces:');
mesh.faces.forEach(f => {
  if (f.boundaryType !== 'INTERNAL') {
    console.log(`Face ${f.faceId}: boundaryType=${f.boundaryType}, centroid=(${f.centroid.x}, ${f.centroid.y}, ${f.centroid.z}), normal=(${f.normal.x}, ${f.normal.y}, ${f.normal.z}), owner=${f.ownerCellId}`);
  }
});
