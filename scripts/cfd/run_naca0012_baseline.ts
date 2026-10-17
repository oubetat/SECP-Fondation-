
import { BRepKernel } from '../../src/engine/cad-kernel/brep/BRepKernel';
import { AirfoilMeshGenerator } from '../../src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { SECP082IndependentCFDVerifier } from '../../src/engine/cfd3d/SECP082IndependentCFDVerifier';

// NACA 0012 at α=4° — canonical benchmark
const MESH = AirfoilMeshGenerator.generateOGrid({
  airfoilDesignation: '0012',
  chord: 1.0,
  span: 0.2,
  farFieldRadius: 10.0,
  numSurfacePoints: 120,
  numNormalLayers: 60,
  numSpanwiseLayers: 1,
  firstCellHeight: 1e-4,
  growthRate: 1.15,
});

const fluid = { densityKgM3: 1.225, viscosityPaS: 1.7894e-5 };
const config = {
  maxIterations: 1000,
  continuityTol: 1e-5,
  momentumTol: 1e-5,
  underRelaxationVelocity: 0.7,
  underRelaxationPressure: 0.3,
  useTurbulenceModel: true,
  turbulenceScheme: 'SST_K_OMEGA',  
  upwindScheme: 'FIRST_ORDER_UPWIND',
};
const bc = {
  inletVelocityMS: { x: 10 * Math.cos(4 * Math.PI / 180), y: 10 * Math.sin(4 * Math.PI / 180), z: 0 },
  outletPressurePa: 0,
};

const solution = Fvm3DNavierStokesSolver.solve(MESH, fluid, bc, config, 0.1, 10);
const audit = SECP082IndependentCFDVerifier.verifySolution(solution);

console.log(JSON.stringify({
  converged: solution.converged,
  iterations: solution.totalIterations,
  Cl: solution.monitors.liftCoefficientCl,
  Cd: solution.monitors.dragCoefficientCd,
  yPlus_mean: solution.monitors.yPlus?.mean,
  momentumResidual: solution.finalMomentumResidual,
  continuityResidual: solution.finalContinuityResidual,
  verdict: audit.independentVerdict,
  gate6: audit.gate6PhysicalPlausibility,
  failureReasons: audit.physicalDiagnostics.failureReasons,
}, null, 2));
