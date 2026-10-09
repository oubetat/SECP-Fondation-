/**
 * PATCH-176: Turbulence Model Comparator Engine
 * 
 * Compares models (Laminar vs K_EPSILON) side-by-side on canonical benchmark cases.
 */

import { ModelComparisonResult } from './types';
import { TurbulenceCaseRegistry } from './TurbulenceCaseRegistry';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';

export class TurbulenceModelComparator {
  public static compareModelsOnCases(): ModelComparisonResult[] {
    const results: ModelComparisonResult[] = [];
    const cases = TurbulenceCaseRegistry.getCanonicalCases();

    for (const c of cases) {
      // 1. Laminar Run with isolated mesh clone
      const meshLam = Fvm3DMeshGenerator.cloneMesh(c.mesh);
      const laminarConfig = { ...c.solverConfig, useTurbulenceModel: false, turbulenceScheme: 'LAMINAR' as const };
      const solLam = Fvm3DNavierStokesSolver.solve(meshLam, c.fluid, c.boundaryConditions, laminarConfig);

      let maxNutLam = 0;
      if (solLam.turbulence?.nut) {
        for (const val of solLam.turbulence.nut) if (val > maxNutLam) maxNutLam = val;
      }

      results.push({
        caseId: c.caseId,
        model: 'LAMINAR',
        iterationsToConverge: solLam.iterationHistory.length,
        finalContinuityResidual: solLam.finalContinuityResidual,
        massImbalancePercent: solLam.globalMassImbalanceNorm * 100,
        pressureDropPa: solLam.monitors.pressureDropPa,
        wallShearPa: solLam.monitors.viscousDragForceN,
        maxNutPaS: maxNutLam,
        referenceFrictionErrorPercent: 0, // N/A for laminar
        convergenceStatus: solLam.converged ? 'CONVERGED' : 'NOT_CONVERGED'
      });

      // 2. K-Epsilon Run with isolated fresh mesh clone
      const meshKEps = Fvm3DMeshGenerator.cloneMesh(c.mesh);
      const kEpsConfig = { ...c.solverConfig, useTurbulenceModel: true, turbulenceScheme: 'K_EPSILON' as const };
      const solKEps = Fvm3DNavierStokesSolver.solve(meshKEps, c.fluid, c.boundaryConditions, kEpsConfig);

      let maxNutKEps = 0;
      if (solKEps.turbulence?.nut) {
        for (const val of solKEps.turbulence.nut) if (val > maxNutKEps) maxNutKEps = val;
      }

      // Compute friction factor error vs reference if available
      let refErr = 0;
      if (c.referenceFrictionFactor) {
        // Darcy friction factor f = (2 * Delta P * D) / (rho * U^2 * L)
        const L = 0.4;
        const D = c.characteristicLength * 2.0;
        const U = c.boundaryConditions.inletVelocityMS.x;
        const rho = c.fluid.densityKgM3;
        const dp = solKEps.monitors.pressureDropPa;

        const calculatedF = (2.0 * dp * D) / Math.max(rho * U * U * L, 1e-10);
        refErr = Math.abs((calculatedF - c.referenceFrictionFactor) / c.referenceFrictionFactor) * 100;
      }

      results.push({
        caseId: c.caseId,
        model: 'K_EPSILON',
        iterationsToConverge: solKEps.iterationHistory.length,
        finalContinuityResidual: solKEps.finalContinuityResidual,
        massImbalancePercent: solKEps.globalMassImbalanceNorm * 100,
        pressureDropPa: solKEps.monitors.pressureDropPa,
        wallShearPa: solKEps.monitors.viscousDragForceN,
        maxNutPaS: maxNutKEps,
        referenceFrictionErrorPercent: Math.min(refErr, 100.0),
        convergenceStatus: solKEps.converged ? 'CONVERGED' : 'NOT_CONVERGED'
      });
    }

    return results;
  }
}
