
import { AirfoilMeshGenerator } from './src/engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { initializeAuthorityHandshake } from './src/engine/simulation/SimulationAuthorityInternal';

async function runBenchmark(iterations: number) {
  initializeAuthorityHandshake();
  console.log(`\n[BENCHMARK] Running NACA0012 O-Grid Benchmark (${iterations} iterations)...`);

  const mesh = AirfoilMeshGenerator.generateOGrid({
    airfoilDesignation: '0012',
    chord: 1.0,
    span: 0.2,
    farFieldRadius: 10.0,
    numSurfacePoints: 20,
    numNormalLayers: 10,
    numSpanwiseLayers: 1,
    firstCellHeight: 1e-4,
    growthRate: 1.15
  });

  const fluid = { densityKgM3: 1.225, viscosityPaS: 1.789e-5 };

  // Set BCs
  for (const f of mesh.faces) {
    if (f.boundaryType === 'FARFIELD') {
      if (f.centroid.x < 0.5) {
        f.boundaryType = 'INLET';
        f.u_bc = 100.0; // High speed to test stability
        f.v_bc = 0.0;
        f.w_bc = 0.0;
      } else {
        f.boundaryType = 'OUTLET';
        f.p_bc = 0.0;
      }
    }
  }

  const solverConfig = {
    maxIterations: iterations,
    continuityTol: 1e-6,
    momentumTol: 1e-6,
    underRelaxationVelocity: 0.7,
    underRelaxationPressure: 0.3,
    useTurbulenceModel: true,
    turbulenceScheme: 'K_EPSILON' as const,
    upwindScheme: 'FIRST_ORDER_UPWIND' as const
  };

  const startTime = Date.now();
  const res = Fvm3DNavierStokesSolver.solve(mesh, fluid, solverConfig, 1.0, 100.0);
  const endTime = Date.now();

  console.log(`[BENCHMARK] Completed in ${endTime - startTime}ms`);
  console.log(`[BENCHMARK] Converged: ${res.converged}`);
  console.log(`[BENCHMARK] Reason: ${res.convergenceAudit?.terminationReason}`);
  console.log(`[BENCHMARK] Final Metrics:`, {
    iter: res.convergenceAudit?.iteration,
    contLinf: res.convergenceAudit?.continuity.linf,
    momLinf: res.convergenceAudit?.momentumResidualLinf,
    pressCorr: res.convergenceAudit?.pressureCorrection,
    velCorr: res.convergenceAudit?.velocityCorrection,
    kRes: res.convergenceAudit?.turbulence.kResidual,
    epsRes: res.convergenceAudit?.turbulence.omegaResidual,
    forceStability: res.convergenceAudit?.forceStabilityPassed
  });
}

async function main() {
  await runBenchmark(50);
  await runBenchmark(100);
}

main().catch(console.error);
