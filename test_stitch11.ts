import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

const backFaces = splitRes.splitFacesA.filter(f => f.originalFaceId === 'box_f_back');
console.log("Back faces count:", backFaces.length);
for(const f of backFaces) {
  const pts = f.face.outerLoop!.orientedEdges.map(oe => oe.edge.startVertex!.geometry);
  console.log("Face", f.face.id, pts.length, pts);
}
