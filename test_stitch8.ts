import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';
import { BooleanTolerance } from './src/engine/cad-kernel/boolean/BooleanTolerance';
import { BooleanClassifier } from './src/engine/cad-kernel/boolean/BooleanClassifier';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl', 5, 5, 0, 4, 15, 16);
const model = GeometricTolerance.DEFAULT;

const intRes = BooleanIntersector.intersectSolids(a, b, model);

const face = a.outerShell.orientedFaces.find(f => f.face.id === 'box_f_back')!.face;
const pts = BooleanClassifier.getLoopVertices(face.outerLoop!);
console.log("Original pts length:", pts.length);

const allPoints = [];
const splitRes = BooleanSplitter.splitSolids(a, b, intRes.intersectionCurves, model);

const stitchedFace = splitRes.splitFacesA.find(f => f.originalFaceId === 'box_f_back');
if (stitchedFace && stitchedFace.face.outerLoop) {
  const sPts = stitchedFace.face.outerLoop.orientedEdges.map(oe => oe.edge.startVertex!.geometry);
  for(let i = 0; i < sPts.length; i++) {
     console.log(`[${i}]`, sPts[i]);
  }
}
