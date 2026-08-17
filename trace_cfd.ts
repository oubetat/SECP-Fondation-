import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { FluidProperties3D, SolverConfig3D } from './src/engine/cfd3d/Fvm3DTypes';

const Lx = 1.0, Ly = 0.1, Lz = 0.1, Uavg = 1.0;
const rho = 1.225;
const mu = 1.81e-5;
const fluid: FluidProperties3D = { densityKgM3: rho, viscosityPaS: mu };

const config: SolverConfig3D = {
  maxIterations: 100,
  continuityTol: 1e-4,
  momentumTol: 1e-4,
  underRelaxationVelocity: 0.7,
  underRelaxationPressure: 0.3,
  useTurbulenceModel: false,
  turbulenceScheme: 'LAMINAR',
  upwindScheme: 'FIRST_ORDER_UPWIND'
};

const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('poiseuille_mesh', Lx, Ly, Lz, 16, 8, 4, 'INLET', 'OUTLET', 'WALL', 'WALL', { x: Uavg, y: 0, z: 0 });

try {
  const sol = Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
  console.log("Iteration log details:");
  sol.iterationHistory.forEach(it => {
    console.log(`Iter ${it.iteration}: ContRes=${it.continuityResidual.toExponential(4)}, MomRes=${it.uMomentumResidual.toExponential(4)}, MaxV=${it.maxVelocityMS.toFixed(4)}, PressChange=${it.pressureChange.toExponential(4)}`);
  });
} catch (e) {
  console.error("Solver error:", e);
}
