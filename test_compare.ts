import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';

const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

// run engine
const res = BooleanEngine.execute('UNION', a, b, { model });
for(const f of res.resultShape!.outerShell.orientedFaces) {
  if (f.face.id === 'box_a4_f_bottom_box_a4_f_bottom_s0_a_box_a4_f_bottom_s1_a_box_a4_f_bottom_s2_a_box_a4_f_bottom_s3_a_box_a4_f_bottom_s4_a_box_a4_f_bottom_s15_a') {
    console.log("ENGINE vertices:");
    for (const oe of f.face.outerLoop!.orientedEdges) {
      console.log(oe.edge!.id);
    }
  }
}

// run splitter directly
const a2 = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b2 = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);
const intRes = BooleanIntersector.intersectSolids(a2, b2, model);
const splitRes = BooleanSplitter.splitSolids(a2, b2, intRes.intersectionCurves, model);

for (const record of splitRes.splitFacesA) {
  if (record.face.id === 'box_a4_f_bottom_box_a4_f_bottom_s0_a_box_a4_f_bottom_s1_a_box_a4_f_bottom_s2_a_box_a4_f_bottom_s3_a_box_a4_f_bottom_s4_a_box_a4_f_bottom_s15_a') {
    console.log("SPLITTER vertices:");
    for (const oe of record.face.outerLoop!.orientedEdges) {
      console.log(oe.edge!.id);
    }
  }
}
