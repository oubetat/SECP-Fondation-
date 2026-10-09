import { BooleanTolerance } from './src/engine/cad-kernel/boolean/BooleanTolerance';
import { GeometricTolerance } from './src/engine/cad-kernel/predicates/GeometricTolerance';

const pt = { x: 0, y: 10, z: 0 } as any;
const p2 = { x: 0, y: 10, z: 0 } as any;
console.log("Coincident?", BooleanTolerance.arePointsCoincident(pt, p2, GeometricTolerance.DEFAULT));

