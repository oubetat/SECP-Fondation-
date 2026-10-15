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
  underRelaxationVelocity: 0.5,
  underRelaxationPressure: 0.2,
  useTurbulenceModel: true,
  turbulenceScheme: 'SST_K_OMEGA' as const,
  upwindScheme: 'FIRST_ORDER_UPWIND' as const
};

const refArea = 0.2;
const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config, refArea, Uinf);

console.log('--- SOLUTION SUMMARY ---');
console.log('CL:', solution.monitors.liftCoefficientCl);
console.log('CD:', solution.monitors.dragCoefficientCd);
console.log('Cm:', solution.monitors.pitchingMomentCm);
console.log('converged:', solution.converged);
console.log('iterations:', solution.totalIterations);
console.log('finalContinuityResidual:', solution.finalContinuityResidual);
console.log('faceFluxes length:', solution.faceFluxes?.length);
console.log('u length:', solution.velocity?.u?.length);

console.log('--- VERIFIER RESULT ---');
const verifier = new SECP082IndependentCFDVerifier();
const result = verifier.verifyPhysicalConservation(mesh, solution, rho, mu);

console.log('VERDICT:', result.independentVerdict);
console.log('PASSED:', result.passed);
console.log('INDEPENDENT_CONTINUITY_RESIDUAL:', result.independentContinuityResidual);
console.log('GATE1_BOUNDARY:', result.gate1BoundaryFluxCompliance);
console.log('GATE2_INTERNAL:', result.gate2InternalFluxReconstruction);
console.log('GATE3_GLOBAL:', result.gate3GlobalMassConservation);
console.log('GATE4_CONTINUITY:', result.gate4ContinuityResidualConsistency);
console.log('GATE5_MUTATION:', result.gate5MutationDetection);
