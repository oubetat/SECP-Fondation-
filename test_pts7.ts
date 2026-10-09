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
  if (record.originalFaceId === 'box_f_bottom') {
    let has99946 = false;
    for (const oe of record.face.outerLoop!.orientedEdges) {
      const v = oe.edge!.startVertex!.geometry;
      if (v.x.toFixed(4) === '9.9946' && v.y.toFixed(4) === '10.0000') has99946 = true;
    }
    if (has99946) {
      console.log("Vertices of", record.face.id);
      for (const oe of record.face.outerLoop!.orientedEdges) {
        const v = oe.edge!.startVertex!.geometry;
        console.log(`x:${v.x.toFixed(4)}, y:${v.y.toFixed(4)}, z:${v.z.toFixed(4)}`);
      }
    }
  }
}
