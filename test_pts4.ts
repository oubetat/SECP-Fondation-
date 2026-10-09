import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

const pointSet = new Set<string>();
for (const record of splitRes.splitFacesA) {
  if (record.face.outerLoop) {
    for (const oe of record.face.outerLoop.orientedEdges) {
      if (oe.edge && oe.edge.startVertex) {
        const v = oe.edge.startVertex.geometry;
        if(v.y.toFixed(4) === '10.0000' && v.z.toFixed(4) === '0.0000') {
          pointSet.add(BooleanSplitter['getCanonicalVertexId'](v));
        }
      }
    }
  }
}
console.log("y=10, z=0:", Array.from(pointSet).sort());
