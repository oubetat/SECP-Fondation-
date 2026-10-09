import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const pts = new Set<string>();
for(const f of b.outerShell.orientedFaces) {
  if (f.face.outerLoop) {
    for(const oe of f.face.outerLoop.orientedEdges) {
      if (oe.edge && oe.edge.startVertex) {
        const v = oe.edge.startVertex.geometry;
        pts.add(`x:${v.x.toFixed(4)}, y:${v.y.toFixed(4)}, z:${v.z.toFixed(4)}`);
      }
    }
  }
}
console.log(Array.from(pts).sort());
