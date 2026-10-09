import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';

const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);
const res = BooleanEngine.execute('UNION', a, b, { model: GeometricTolerance.DEFAULT });

console.log(res.status);
if (res.resultShape) {
  for(const f of res.resultShape!.outerShell.orientedFaces) {
    for(const oe of f.face.outerLoop!.orientedEdges) {
      if (oe.edge!.id.includes('9.9946')) {
        console.log(`Face ${f.face.id} has edge ${oe.edge!.id}`);
      }
    }
  }
} else {
  console.log("No result shape");
}
