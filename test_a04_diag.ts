import { BooleanEngine } from './src/engine/cad-kernel/boolean/BooleanEngine';
import { AdversarialSolidFactory } from './src/engine/benchmark/boolean/AdversarialSolidFactory';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';

const a = AdversarialSolidFactory.createBox('box_a4', 0, 0, 0, 10, 10, 10);
const b = AdversarialSolidFactory.createFacetedCylinder('cyl_b4', 5, 5, 0, 4, 15, 16);
const res = BooleanEngine.execute('UNION', a, b, { model: GeometricTolerance.DEFAULT });

console.log(JSON.stringify(res.diagnostics, null, 2));
