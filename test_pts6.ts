import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

for (const record of splitRes.splitFacesA) {
  if (record.face.id === 'box_f_bottom_box_f_bottom_s0_a_box_f_bottom_s1_a_box_f_bottom_s2_a_box_f_bottom_s3_a_box_f_bottom_s4_a_box_f_bottom_s15_a') {
    console.log("Vertices of", record.face.id);
    for (const oe of record.face.outerLoop!.orientedEdges) {
      const v = oe.edge!.startVertex!.geometry;
      console.log(`x:${v.x}, y:${v.y}, z:${v.z}`);
    }
  }
}
