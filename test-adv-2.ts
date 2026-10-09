import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';
const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_aspect', 1000.0, 0.001, 0.001, 2, 2, 2);
const quality = Fvm3DMeshGenerator.auditMeshQuality(mesh.cells, mesh.faces);
console.log(quality);
