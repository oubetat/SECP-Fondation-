import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';

async function testGrid(nx: number, ny: number, iters: number, refArea: number) {
  console.log(`\nTesting grid nx=${nx}, ny=${ny}, iters=${iters}, refArea=${refArea}`);
  const span = 0.2;
  const chord = 1.0;
  const fvmMesh = AirfoilMeshGenerator.generateOGrid({
    airfoilDesignation: '0012',
    chord: chord,
    span: span,
    farFieldRadius: 10.0,
    numSurfacePoints: nx,
    numNormalLayers: ny,
    numSpanwiseLayers: 1,
    firstCellHeight: 1e-4,
    growthRate: 1.15
  });

  const aoaRad = (10 * Math.PI) / 180;
  const cosA = Math.cos(aoaRad);
  const sinA = Math.sin(aoaRad);

  for (const f of fvmMesh.faces) {
    if (f.boundaryType === 'FARFIELD') {
      const dx = f.centroid.x - 0.5;
      const dy = f.centroid.y;
      const dot = dx * cosA + dy * sinA;
      if (dot < 0) {
        f.boundaryType = 'INLET';
        f.u_bc = cosA;
        f.v_bc = sinA;
        f.w_bc = 0;
      } else {
        f.boundaryType = 'OUTLET';
        f.p_bc = 0;
      }
    }
  }

  const rho = 1.225;
  const Uinf = 1.0;
  const mu = (rho * Uinf * chord) / 6e6;
  const fluid = { densityKgM3: rho, viscosityPaS: mu };

  const config = {
    maxIterations: iters,
    continuityTol: 1e-4,
    momentumTol: 1.5e-2,
    underRelaxationVelocity: 0.5,
    underRelaxationPressure: 0.2,
    useTurbulenceModel: true,
    turbulenceScheme: 'SST_K_OMEGA' as const,
    upwindScheme: 'FIRST_ORDER_UPWIND' as const
  };

  const solution = Fvm3DNavierStokesSolver.solve(fvmMesh, fluid, config, refArea, Uinf);
  console.log(`Result: CL=${solution.monitors.liftCoefficientCl.toFixed(4)}, CD=${solution.monitors.dragCoefficientCd.toFixed(4)}, Cm=${solution.monitors.pitchingMomentCm.toFixed(4)}, Iters=${solution.totalIterations}, Converged=${solution.converged}`);
}

async function main() {
  console.log("--- BASELINE (refArea = 1.0) ---");
  await testGrid(80, 40, 50, 1.0);
  console.log("--- WITH CORRECT REF AREA (refArea = 0.2) ---");
  await testGrid(80, 40, 50, 0.2);
}

main().catch(console.error);
