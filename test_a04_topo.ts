import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { IndependentTopologyVerifier } from './src/engine/benchmark/boolean/IndependentTopologyVerifier';
import { IndependentGeometricOracle } from './src/engine/benchmark/boolean/IndependentGeometricOracle';

const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);

const result = BooleanEngine.execute('UNION', a, b);

if (result && result.status === 'SUCCESS' && result.resultShape) {
  const topo = new IndependentTopologyVerifier().verify(result.resultShape, { expectedBehavior: { canSucceed: true } } as any);
  console.log('Topology:', topo.verdict);
  if (topo.diagnostics) {
    for (const d of topo.diagnostics) console.log(d.message);
  }
}
