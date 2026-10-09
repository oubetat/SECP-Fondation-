import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const pts = new Set<string>();
for (const f of b.outerShell.orientedFaces) {
  for (const oe of f.face.outerLoop!.orientedEdges) {
    const v = oe.edge!.startVertex!.geometry;
    pts.add(`${v.x.toFixed(4)}_${v.y.toFixed(4)}`);
  }
}
console.log(Array.from(pts).sort());
