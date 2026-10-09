import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
for (const f of b.outerShell.orientedFaces) {
  if (f.face.id === 'cyl_f_side_4' || f.face.id === 'cyl_f_side_5') {
    for (const oe of f.face.outerLoop!.orientedEdges) {
      console.log(oe.edge!.startVertex!.geometry);
    }
  }
}
