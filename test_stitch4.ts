import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';
import { BooleanTolerance } from './src/engine/cad-kernel/boolean/BooleanTolerance';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

const backFace = splitRes.splitFacesA.find(f => f.originalFaceId === 'box_f_back');
if (backFace && backFace.face.outerLoop) {
  const pts = backFace.face.outerLoop.orientedEdges.map(oe => oe.edge.startVertex!.geometry);
  for(let i = 0; i < pts.length; i++) {
     const p1 = pts[i];
     const p2 = pts[(i+1)%pts.length];
     const d = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
     console.log(i, d);
  }
}
