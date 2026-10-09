import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';

const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);
const res = BooleanEngine.execute('UNION', a, b, { model: GeometricTolerance.DEFAULT });

for(const f of res.resultShape!.outerShell.orientedFaces) {
  if (f.face.id.includes('box_a4_f_bottom')) {
    let has10_10_0 = false;
    let has10_99946_0 = false;
    for(const oe of f.face.outerLoop!.orientedEdges) {
      if (oe.edge!.id.includes('10.0000_10.0000_0.0000')) has10_10_0 = true;
      if (oe.edge!.id.includes('10.0000_9.9946_0.0000')) has10_99946_0 = true;
    }
    if (has10_10_0) {
      console.log(`Face ${f.face.id} has (10,10,0). Edges:`);
      for(const oe of f.face.outerLoop!.orientedEdges) console.log(oe.edge!.id);
    }
  }
}
