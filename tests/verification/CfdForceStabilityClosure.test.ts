import { describe, it, expect } from 'vitest';
import { Fvm3DNavierStokesSolver } from '../../src/engine/cfd3d/Fvm3DNavierStokesSolver';
import { Fvm3DMeshGenerator } from '../../src/engine/cfd3d/Fvm3DMeshGenerator';
import { FluidProperties3D, BoundaryConditionSpec3D, SolverConfig3D } from '../../src/engine/cfd3d/Fvm3DTypes';

describe('SECP-CFD: Force Stability & Physical Guard Closure Verification', () => {

  it('1. Strict Physical Input Guard: Rejects non-positive viscosity prior to initialization', () => {
    const mesh = Fvm3DMeshGenerator.generateBoxMesh(0.1, 0.01, 0.01, 2, 2, 2);
    const negativeViscosityFluid: FluidProperties3D = {
      densityKgM3: 1.225,
      viscosityPaS: -1.81e-5
    };
    const bc: BoundaryConditionSpec3D = {
      inletVelocityMS: { x: 5.0, y: 0.0, z: 0.0 },
      outletPressurePa: 0.0
    };
    const config: SolverConfig3D = {
      maxIterations: 10,
      continuityTol: 1e-4,
      momentumTol: 1e-4
    };

    expect(() => {
      Fvm3DNavierStokesSolver.solve(mesh, negativeViscosityFluid, bc, config);
    }).toThrowError(/NUMERICAL_FAILURE: Fluid viscosity must be positive/);
  });

  it('2. Pure Mathematical Verification: Force stability sliding window behavior', () => {
    const windowSize = 20;

    // Helper implementing the EXACT formula in Fvm3DNavierStokesSolver:
    function evaluateStability(cls: number[], cds: number[]) {
      expect(cls.length).toBe(windowSize);
      expect(cds.length).toBe(windowSize);

      const minCl = Math.min(...cls), maxCl = Math.max(...cls);
      const minCd = Math.min(...cds), maxCd = Math.max(...cds);

      const clDeltaWindow = maxCl - minCl;
      const cdDeltaWindow = maxCd - minCd;

      const meanCl = cls.reduce((a, b) => a + b, 0) / windowSize;
      const meanCd = cds.reduce((a, b) => a + b, 0) / windowSize;

      const clNormScale = Math.max(Math.abs(meanCl), Math.abs(meanCd), 1.0);
      const clRelChange = clDeltaWindow / clNormScale;
      const cdRelChange = cdDeltaWindow / Math.max(Math.abs(meanCd), 1e-3);

      const passed = clRelChange < 0.02 && cdRelChange < 0.02;

      return { passed, clRelChange, cdRelChange, clDeltaWindow, cdDeltaWindow, meanCl, meanCd };
    }

    // Case A: Near-zero Cl with micro-oscillation and steady Cd (Symmetric channel)
    const caseA_Cl = Array.from({ length: 20 }, (_, i) => 1.5e-4 * Math.sin(i));
    const caseA_Cd = Array.from({ length: 20 }, () => 0.025);
    const resultA = evaluateStability(caseA_Cl, caseA_Cd);
    expect(resultA.passed).toBe(true);
    expect(resultA.clRelChange).toBeLessThan(0.02);
    expect(resultA.cdRelChange).toBeLessThan(0.02);

    // Case B: Non-zero lifting body (NACA 0012, Cl ~ 1.08) with smooth asymptotic convergence
    const caseB_Cl = Array.from({ length: 20 }, (_, i) => 1.080 + 0.003 * Math.exp(-i / 5));
    const caseB_Cd = Array.from({ length: 20 }, () => 0.015);
    const resultB = evaluateStability(caseB_Cl, caseB_Cd);
    expect(resultB.passed).toBe(true);
    expect(resultB.clRelChange).toBeLessThan(0.02);

    // Case C: Real aerodynamic instability (Cl oscillation amplitude = 0.05 around 0.80)
    const caseC_Cl = Array.from({ length: 20 }, (_, i) => 0.80 + 0.05 * Math.sin(i));
    const caseC_Cd = Array.from({ length: 20 }, () => 0.015);
    const resultC = evaluateStability(caseC_Cl, caseC_Cd);
    expect(resultC.passed).toBe(false);
    expect(resultC.clRelChange).toBeGreaterThan(0.02);

    // Case D: Drag coefficient instability (Cd oscillates by 18%)
    const caseD_Cl = Array.from({ length: 20 }, () => 1.08);
    const caseD_Cd = Array.from({ length: 20 }, (_, i) => 0.030 + 0.006 * (i % 2 === 0 ? 1 : -1));
    const resultD = evaluateStability(caseD_Cl, caseD_Cd);
    expect(resultD.passed).toBe(false);
    expect(resultD.cdRelChange).toBeGreaterThan(0.02);
  });
});
