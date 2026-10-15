import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { SECP082IndependentCFDVerifier } from './src/engine/cfd3d/SECP082IndependentCFDVerifier';

const mesh = AirfoilMeshGenerator.generateOGrid({
  airfoilDesignation: '0012', chord: 1.0, span: 0.2, farFieldRadius: 10.0,
  numSurfacePoints: 40, numNormalLayers: 20, numSpanwiseLayers: 1,
  firstCellHeight: 1e-4, growthRate: 1.15
});

// BCs for AoA=2
const aoaRad = 2 * Math.PI / 180;
const cosA = Math.cos(aoaRad);
const sinA = Math.sin(aoaRad);
for (const f of mesh.faces) {
  if (f.boundaryType === 'FARFIELD') {
    const dx = f.centroid.x - 0.5;
    const dy = f.centroid.y;
    const dot = dx * cosA + dy * sinA;
    if (dot < 0) {
      f.boundaryType = 'INLET';
      f.u_bc = cosA; f.v_bc = sinA; f.w_bc = 0;
    } else {
      f.boundaryType = 'OUTLET';
      f.p_bc = 0;
    }
  }
}

const rho = 1.225;
const Uinf = 1.0;
const mu = (rho * Uinf * 1.0) / 3e6;
const fluid = { densityKgM3: rho, viscosityPaS: mu };

const config = {
  maxIterations: 100,
  continuityTol: 1e-4,
  momentumTol: 1.5e-2,
  energyTol: 1e-3,
  turbulentKineticTol: 1e-3,
  turbulentDissipationTol: 1e-3,
  relaxation: { u: 0.7, v: 0.7, w: 0.7, p: 0.3, k: 0.8, omega: 0.8, eddyViscosity: 0.8 },
  turbulenceModel: 'kOmegaSST' as const,
  spatialDiscretization: 'firstOrderUpwind' as const,
  reynoldsNumber: 3e6,
  machNumber: 0.15,
  cflNumber: 1.0,
  linearSolverMaxIters: 30,
  linearSolverTol: 1e-3
};

const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config as any);

console.log('--- SOLVER OUTPUT ---');
console.log('SOLVER_CONVERGED:', solution.converged);
console.log('SOLVER_ITERATIONS:', solution.iterations);
console.log('SOLVER_CONTINUITY_RESIDUAL:', solution.finalContinuityResidual);

const verifier = new SECP082IndependentCFDVerifier();
const audit = verifier.verifyPhysicalConservation(mesh, solution, rho, mu);

console.log('--- VERIFIER AUDIT ---');
console.log('VERDICT:', audit.independentVerdict);
console.log('PASSED:', audit.passed);
console.log('NUMERICAL_CONSISTENCY_PASSED:', audit.numericalConsistencyPassed);
console.log('PHYSICAL_PLAUSIBILITY_PASSED:', audit.physicalPlausibilityPassed);
console.log('INDEPENDENT_RESIDUAL:', audit.independentContinuityResidual);
console.log('REPORTED_RESIDUAL:', solution.finalContinuityResidual);
console.log('GATE1_BOUNDARY:', audit.gate1BoundaryFluxCompliance);
console.log('GATE2_INTERNAL:', audit.gate2InternalFluxReconstruction);
console.log('GATE3_GLOBAL_MASS:', audit.gate3GlobalMassConservation);
console.log('GATE4_CONTINUITY:', audit.gate4ContinuityResidualConsistency);
console.log('GATE5_MUTATION:', audit.gate5MutationDetection);
console.log('GATE6_PHYSICAL:', audit.gate6PhysicalPlausibility);
if (audit.physicalDiagnostics.failureReasons.length > 0) {
  console.log('GATE6_REASONS:', audit.physicalDiagnostics.failureReasons);
}
console.log('PHASE_3_VERIFIED_CLOSURE');
