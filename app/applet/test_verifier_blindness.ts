import { SECP082IndependentCFDVerifier } from './src/engine/cfd3d/SECP082IndependentCFDVerifier';
import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';

const mesh = AirfoilMeshGenerator.generateOGrid({
  airfoilDesignation: '0012', chord: 1.0, span: 0.2, farFieldRadius: 10.0,
  numSurfacePoints: 20, numNormalLayers: 10, numSpanwiseLayers: 1,
  firstCellHeight: 1e-4, growthRate: 1.15
});

const numCells = mesh.cells.length;
const numFaces = mesh.faces.length;

const corrupted = {
  u: new Array(numCells).fill(1.0),
  v: new Array(numCells).fill(0.0),
  w: new Array(numCells).fill(0.0),
  p: new Array(numCells).fill(10.0),
  faceFluxes: new Array(numFaces).fill(0.0),
  finalContinuityResidual: 0.0,
  converged: true,
};

const verifier = new SECP082IndependentCFDVerifier();
const result = verifier.verifyPhysicalConservation(mesh, corrupted, 1.225, 1.8e-5);

console.log('VERDICT:', result.independentVerdict);
console.log('PASSED:', result.passed);
console.log('INDEPENDENT_CONTINUITY_RESIDUAL:', result.independentContinuityResidual);
console.log('GATE1_BOUNDARY:', result.gate1BoundaryFluxCompliance);
console.log('GATE2_INTERNAL:', result.gate2InternalFluxReconstruction);
console.log('GATE5_MUTATION:', result.gate5MutationDetection);
