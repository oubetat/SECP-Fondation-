import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';
import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

console.log("Cylinder side faces in splitFacesB:");
for (const record of splitRes.splitFacesB) {
  if (record.originalFaceId && record.originalFaceId.includes('cyl_f_side_4')) {
     console.log("Face:", record.face.id);
     for(const oe of record.face.outerLoop!.orientedEdges) {
       console.log("  ", oe.edge!.id);
     }
  }
}
