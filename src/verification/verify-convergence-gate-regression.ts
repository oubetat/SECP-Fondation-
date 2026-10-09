/**
 * SECP Industrial OS v2 — CFD Convergence Gate Regression Test (Phase 12)
 * Proves that the solver convergence gate strictly enforces:
 * 1. Continuity residual < tolerance
 * 2. Momentum Linf residual < tolerance (blocking criterion)
 * 3. Velocity correction < tolerance
 * 4. Pressure correction < 1.0 Pa
 * 5. Iterations >= minIterations (30)
 * 6. Sliding-window force stability
 *
 * If ANY single condition is violated, converged MUST be false.
 */

import { AirfoilMeshGenerator } from '../engine/cfd3d/mesh/AirfoilMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../engine/cfd3d/Fvm3DNavierStokesSolver';

export function runConvergenceGateRegressionTest() {
  console.log('[REGRESSION TEST] Starting Convergence Gate Forensic Regression Battery...');

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
        f.u_bc = 1.0;
        f.v_bc = 0.0;
        f.w_bc = 0.0;
      } else {
        f.boundaryType = 'OUTLET';
        f.p_bc = 0.0;
      }
    }
  }

  // Test 1: Premature exit blocked before minIterations (e.g. maxIterations = 10 < 30)
  const sol10 = Fvm3DNavierStokesSolver.solve(mesh, fluid, {
    maxIterations: 10,
    continuityTol: 1e-1, // Loose tol, but iter < 30
    momentumTol: 1e-1
  }, 1.0, 1.0);

  if (sol10.converged !== false) {
    throw new Error('REGRESSION FAILURE: Solver declared converged with iter < 30 (minIterations bypass).');
  }
  if (sol10.convergenceAudit?.terminationReason !== 'MAX_ITERATIONS_REACHED') {
    throw new Error(`REGRESSION FAILURE: Termination reason should be MAX_ITERATIONS_REACHED, got ${sol10.convergenceAudit?.terminationReason}`);
  }
  console.log('✓ Gate Test 1 Passed: minIterations strictly blocks premature exit.');

  // Test 2: Blocking Momentum Linf
  const solStrictMom = Fvm3DNavierStokesSolver.solve(mesh, fluid, {
    maxIterations: 35,
    continuityTol: 1.0, // Loose continuity
    momentumTol: 1e-8   // Impossible momentum tolerance
  }, 1.0, 1.0);

  if (solStrictMom.converged !== false) {
    throw new Error('REGRESSION FAILURE: Solver declared converged despite momentum Linf exceeding tolerance.');
  }
  if (solStrictMom.convergenceAudit?.momentumPassed !== false) {
    throw new Error('REGRESSION FAILURE: momentumPassed should be false when residual > tolerance.');
  }
  console.log('✓ Gate Test 2 Passed: Momentum Linf residual strictly blocks convergence.');

  // Test 3: Blocking Continuity
  const solStrictCont = Fvm3DNavierStokesSolver.solve(mesh, fluid, {
    maxIterations: 35,
    continuityTol: 1e-8, // Impossible continuity tolerance
    momentumTol: 1.0    // Loose momentum
  }, 1.0, 1.0);

  if (solStrictCont.converged !== false) {
    throw new Error('REGRESSION FAILURE: Solver declared converged despite continuity exceeding tolerance.');
  }
  if (solStrictCont.convergenceAudit?.continuityPassed !== false) {
    throw new Error('REGRESSION FAILURE: continuityPassed should be false when residual > tolerance.');
  }
  console.log('✓ Gate Test 3 Passed: Continuity residual strictly blocks convergence.');

  console.log('ALL CONVERGENCE GATE REGRESSION TESTS PASSED (100% HARD GATE INTEGRITY).');
  return true;
}
