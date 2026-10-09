import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
for (const curve of intRes.intersectionCurves) {
  if (curve.segments) {
    for (const seg of curve.segments) {
      if (Math.abs(seg.start.x - 3.469) < 0.01) {
        console.log(`Curve on ${curve.faceA.id} and ${curve.faceB.id}:`);
        console.log(`  start: x=${seg.start.x}, y=${seg.start.y}, z=${seg.start.z}`);
      }
    }
  }
}
