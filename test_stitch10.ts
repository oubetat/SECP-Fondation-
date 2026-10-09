import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { BooleanClassifier } from './src/engine/cad-kernel/boolean/BooleanClassifier';

const a = AdversarialSolidFactory.createBox('box', 0, 0, 0, 10, 10, 10);
const face = a.outerShell.orientedFaces.find(f => f.face.id === 'box_f_back')!.face;
const pts = BooleanClassifier.getLoopVertices(face.outerLoop!);
for(let i=0; i<pts.length; i++) {
  console.log(`original[${i}]`, pts[i]);
}
