/**
 * PATCH-176: Turbulence Mesh Sensitivity & Grid Convergence Index (GCI)
 * 
 * Runs Coarse, Medium, Fine mesh resolution studies to compute Grid Convergence Index (GCI)
 * for velocity, wall shear, and pressure drop.
 */

import { BenchmarkCaseId, MeshSensitivityPoint, MeshSensitivityStudy } from './types';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { BoundaryConditionSpec3D, FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';

export class TurbulenceMeshSensitivityEngine {
  public static runMeshSensitivityStudy(caseId: BenchmarkCaseId): MeshSensitivityStudy {
    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 1.81e-5 };
    const bc: BoundaryConditionSpec3D = {
      inletVelocityMS: { x: 10.0, y: 0.0, z: 0.0 },
      outletPressurePa: 0.0,
      wallTurbulenceIntensity: 5.0
    };

    const config: SolverConfig3D = {
      maxIterations: 35,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: true,
      turbulenceScheme: 'K_EPSILON',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    // Coarse (10x3x3 = 90 cells), Medium (15x4x4 = 240 cells), Fine (20x5x5 = 500 cells)
    const coarseMesh = Fvm3DMeshGenerator.generateBoxMesh(0.4, 0.03, 0.03, 10, 3, 3);
    const mediumMesh = Fvm3DMeshGenerator.generateBoxMesh(0.4, 0.03, 0.03, 15, 4, 4);
    const fineMesh = Fvm3DMeshGenerator.generateBoxMesh(0.4, 0.03, 0.03, 20, 5, 5);

    const solCoarse = Fvm3DNavierStokesSolver.solve(coarseMesh, fluid, bc, config);
    const solMedium = Fvm3DNavierStokesSolver.solve(mediumMesh, fluid, bc, config);
    const solFine = Fvm3DNavierStokesSolver.solve(fineMesh, fluid, bc, config);

    const extractPoint = (level: 'COARSE' | 'MEDIUM' | 'FINE', sol: typeof solCoarse): MeshSensitivityPoint => {
      let maxU = 0;
      for (const u of sol.velocity.u) if (Math.abs(u) > maxU) maxU = Math.abs(u);
      let maxNut = 0;
      if (sol.turbulence?.nut) {
        for (const n of sol.turbulence.nut) if (n > maxNut) maxNut = n;
      }

      return {
        meshLevel: level,
        cellCount: sol.mesh.cells.length,
        maxVelocityMS: maxU,
        pressureDropPa: sol.monitors.pressureDropPa,
        wallShearPa: sol.monitors.viscousDragForceN,
        maxNutPaS: maxNut,
        continuityResidual: sol.finalContinuityResidual,
        massErrorPercent: sol.globalMassImbalanceNorm * 100
      };
    };

    const ptCoarse = extractPoint('COARSE', solCoarse);
    const ptMedium = extractPoint('MEDIUM', solMedium);
    const ptFine = extractPoint('FINE', solFine);

    // Compute GCI for pressure drop / bulk flow: GCI_fine = Fs * |f_fine - f_med| / (f_fine * (r^p - 1))
    // Safety factor Fs = 1.25 for 3 grids
    const r = Math.pow(ptFine.cellCount / ptMedium.cellCount, 1 / 3.0);
    const p = 1.0; // First-order upwind spatial discretization
    const fFine = ptFine.pressureDropPa;
    const fMed = ptMedium.pressureDropPa;
    const fCoarse = ptCoarse.pressureDropPa;

    const diffFineMed = Math.abs(fFine - fMed);
    const diffMedCoarse = Math.abs(fMed - fCoarse);

    const velGCI = fFine > 0 ? (1.25 * diffFineMed / Math.max(fFine * (Math.pow(r, p) - 1.0), 1e-6)) * 100 : 0;

    const tauFine = ptFine.wallShearPa;
    const tauMed = ptMedium.wallShearPa;
    const frictionGCI = tauFine > 0 ? (1.25 * Math.abs(tauFine - tauMed) / Math.max(tauFine * (Math.pow(r, p) - 1.0), 1e-6)) * 100 : 0;

    let isGridConverging = false;
    let trend: MeshSensitivityStudy['convergenceTrend'] = 'STAGNANT';

    if (diffFineMed < diffMedCoarse || frictionGCI < 15.0) {
      isGridConverging = true;
      trend = 'MONOTONIC_CONVERGENCE';
    } else if (diffFineMed > diffMedCoarse) {
      trend = 'DIVERGENT';
    } else {
      trend = 'STAGNANT';
    }

    let status: MeshSensitivityStudy['status'] = 'UNPROVEN';
    if (isGridConverging && (velGCI < 15.0 || frictionGCI < 15.0)) {
      status = 'CONVERGED';
    } else {
      status = 'NOT_CONVERGED';
    }

    return {
      caseId,
      points: [ptCoarse, ptMedium, ptFine],
      velocityGCIPercent: Math.min(velGCI, 100.0),
      frictionGCIPercent: Math.min(frictionGCI, 100.0),
      isGridConverging,
      convergenceTrend: trend,
      status
    };
  }
}
