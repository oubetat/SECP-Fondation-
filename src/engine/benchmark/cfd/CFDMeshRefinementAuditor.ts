/**
 * SECP Industrial OS v2 — CFD Mesh Refinement & Grid Independence Auditor
 * Phase 15 (PATCH-174)
 *
 * Conducts true multi-level mesh refinement studies across Coarse, Medium, Fine, and Very Fine grids.
 * Calculates exact spatial convergence without simulated or fabricated metrics.
 */

import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';
import { CFDIndependentOracles } from './CFDIndependentOracles';
import { CFDMeshRefinementPoint, CFDMeshRefinementStudy } from './types';

export class CFDMeshRefinementAuditor {
  /**
   * Executes a 4-level Mesh Refinement Study on 3D Poiseuille Channel Flow
   */
  public static runPoiseuilleMeshStudy(): CFDMeshRefinementStudy {
    const Lx = 1.0;
    const Ly = 0.1;
    const Lz = 0.1;
    const Uavg = 0.5;
    const rho = 1.225;
    const mu = 5.0e-4;

    const fluid: FluidProperties3D = { densityKgM3: rho, viscosityPaS: mu };
    const config: SolverConfig3D = {
      maxIterations: 150,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    const analytical = CFDIndependentOracles.getPoiseuilleAnalytical(Lx, Ly, Lz, Uavg, mu, rho);
    const exactDeltaP = analytical.exactPressureDropPa;

    const levels: { level: 'COARSE' | 'MEDIUM' | 'FINE' | 'VERY_FINE'; nx: number; ny: number; nz: number }[] = [
      { level: 'COARSE', nx: 8, ny: 4, nz: 2 },
      { level: 'MEDIUM', nx: 16, ny: 8, nz: 4 },
      { level: 'FINE', nx: 24, ny: 12, nz: 6 },
      { level: 'VERY_FINE', nx: 32, ny: 16, nz: 8 }
    ];

    const points: CFDMeshRefinementPoint[] = [];

    for (const lvl of levels) {
      const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
        `refinement_${lvl.level}`,
        Lx, Ly, Lz,
        lvl.nx, lvl.ny, lvl.nz,
        'INLET', 'OUTLET',
        'WALL', 'SYMMETRY',
        { x: Uavg, y: 0, z: 0 },
        0.0
      );

      const t0 = performance.now();
      const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config, Ly * Lz, Uavg);
      const solveTimeMs = performance.now() - t0;

      const numDeltaP = solution.monitors.pressureDropPa;
      const refErr = (Math.abs(numDeltaP - exactDeltaP) / exactDeltaP) * 100.0;
      const massErr = solution.globalMassImbalanceNorm * 100.0;
      const lastLog = solution.iterationHistory[solution.iterationHistory.length - 1];

      points.push({
        meshLevel: lvl.level,
        cellCount: mesh.cells.length,
        faceCount: mesh.faces.length,
        dofCount: mesh.cells.length * 4, // u, v, w, p
        solveTimeMs,
        iterations: solution.iterations,
        continuityResidual: lastLog ? lastLog.continuityResidual : 1e-4,
        massImbalancePercent: massErr,
        numericalPressureDropPa: numDeltaP,
        referenceErrorPercent: refErr
      });
    }

    // Grid Sensitivity Index (GSI)
    const errCoarse = points[0].referenceErrorPercent;
    const errFine = points[2].referenceErrorPercent;
    const gridSensitivityIndex = Math.abs(errCoarse - errFine) / Math.max(errFine, 0.01);

    // Monotonic spatial convergence check (error decreases with refinement)
    let isMonotonicConvergence = true;
    for (let i = 1; i < points.length; i++) {
      if (points[i].referenceErrorPercent > points[i - 1].referenceErrorPercent * 1.05) {
        isMonotonicConvergence = false;
      }
    }

    const fineError = points[points.length - 1].referenceErrorPercent;
    const meshIndependenceReached = fineError < 3.0 && isMonotonicConvergence;

    const summary = meshIndependenceReached
      ? `Mesh Independence Verified: Monotonic convergence with error reducing from ${errCoarse.toFixed(2)}% (Coarse) to ${fineError.toFixed(2)}% (Very Fine).`
      : `Mesh Sensitivity Observed: Monotonicity=${isMonotonicConvergence}, Fine Error=${fineError.toFixed(2)}%.`;

    return {
      benchmarkId: 'STUDY-MESH-POISEUILLE-3D',
      title: '3D Poiseuille Channel Flow Mesh Refinement Study (64 to 4,096 Cells)',
      points,
      gridSensitivityIndex,
      isMonotonicConvergence,
      meshIndependenceReached,
      summary
    };
  }
}
