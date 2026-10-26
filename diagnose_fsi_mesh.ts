import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';

const L = 1.0, b = 0.1, h = 0.1;
const fluidMesh = Fvm3DMeshGenerator.generateBoxMesh(L, b, h, 5, 5, 2);

console.log('Bounding Box Min:', fluidMesh.boundingBox.min);
console.log('Bounding Box Max:', fluidMesh.boundingBox.max);

const interfaceFaces = fluidMesh.faces.filter(
  f => f.boundaryType === 'WALL' && Math.abs(f.centroid.y - fluidMesh.boundingBox.min.y) < 0.01 * (fluidMesh.boundingBox.max.y - fluidMesh.boundingBox.min.y)
);

console.log('Total Interface Faces found:', interfaceFaces.length);
if (interfaceFaces.length > 0) {
    console.log('First Face Centroid:', interfaceFaces[0].centroid);
    console.log('First Face Area:', interfaceFaces[0].area);
    console.log('First Face Normal:', interfaceFaces[0].normal);
}
