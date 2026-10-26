import { TwoWayFSICouplingEngine } from './src/engine/cfd3d/coupling/TwoWayFSICouplingEngine';
import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';

const L = 1.0, b = 0.1, h = 0.1, E = 70e9;
const fluidMesh = Fvm3DMeshGenerator.generateBoxMesh(L, b, h, 5, 5, 2);
const pressures = new Array(fluidMesh.cells.length).fill(101325.0);

const res = TwoWayFSICouplingEngine.solveTwoWayFSI(fluidMesh, pressures, E, 1e-4, 15, 10);

const r1 = res.structuralReactions?.find(r => r.nodeId === 1);
const r2 = res.structuralReactions?.find(r => r.nodeId === 2);
const analyticalMoment = (10132.5 * Math.pow(L, 2)) / 2;
const numericalMoment = Math.abs((r1?.fx || 0) - (r2?.fx || 0)) * (h / 2);

console.log('--- REQUALIFICATION VERIFICATION ---');
console.log('Max Displacement (mm):', (res.maxDisplacementM * 1000).toFixed(4));
console.log('Theoretical Displacement (mm):', (2.17125).toFixed(4));
console.log('Displacement Error (%):', ((Math.abs(res.maxDisplacementM - 0.00217125) / 0.00217125) * 100).toFixed(2));
console.log('Analytical Moment (Nm):', analyticalMoment.toFixed(2));
console.log('Numerical Reaction Moment (Nm):', numericalMoment.toFixed(2));
console.log('Moment Error (%):', ((Math.abs(numericalMoment - analyticalMoment) / analyticalMoment) * 100).toFixed(2));
