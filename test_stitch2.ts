import { BooleanSplitter } from './src/engine/cad-kernel/boolean/BooleanSplitter';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';
import { BooleanIntersector } from './src/engine/cad-kernel/boolean/BooleanIntersector';
import { BooleanClassifier } from './src/engine/cad-kernel/boolean/BooleanClassifier';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);

const backFace = a.outerShell.orientedFaces.find(f => f.face.id === 'box_f_back');
if (backFace && backFace.face.outerLoop) {
  const pts = BooleanClassifier.getLoopVertices(backFace.face.outerLoop);
  for(let i = 0; i < pts.length; i++) {
     console.log("Original", i, pts[i].x, pts[i].y, pts[i].z);
  }
}
