import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { IndependentTopologyVerifier } from './src/engine/benchmark/boolean/IndependentTopologyVerifier';
import { IndependentGeometricOracle } from './src/engine/benchmark/boolean/IndependentGeometricOracle';

console.log("Creating solids");
const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);

console.log("Evaluating boolean");
console.time('evaluate');
const result = BooleanEngine.execute('UNION', a, b);
console.timeEnd('evaluate');

if (result && result.status === 'SUCCESS' && result.resultShape) {
  const vol = IndependentGeometricOracle.computeVolume(result.resultShape);
  console.log('Volume:', vol);
} else {
  console.log("Status:", result.status);
  for (const d of result.diagnostics) console.log(d.message);
}
