/**
 * PATCH-176: Turbulent Quantities Auditor
 * 
 * Audits k, epsilon, nut fields for:
 * - NaN / Infinity
 * - Positivity bounds (k >= 0, eps > 0)
 * - Physical viscosity upper bounds (nut / mu <= 10^5)
 * - Decoupling from solver core
 */

import { TurbulentQuantitiesReport } from './types';
import { CfdSolution3D } from '../../cfd3d/Fvm3DTypes';

export class TurbulenceQuantitiesAuditor {
  public static auditSolution(solution: CfdSolution3D): TurbulentQuantitiesReport {
    const turb = solution.turbulence;
    if (!turb || !turb.k || turb.k.length === 0) {
      return {
        kMin: 0, kMax: 0, kMean: 0,
        epsMin: 0, epsMax: 0, epsMean: 0,
        nutMin: 0, nutMax: 0, nutMean: 0,
        turbulentToLaminarViscosityRatioMax: 0,
        hasNaN: false,
        hasInf: false,
        hasNegativeK: false,
        hasNegativeEps: false,
        isPhysicallyBounded: false,
        isDecoupledFromSolver: true
      };
    }

    const { k, epsilon: eps, nut } = turb;
    const mu = solution.fluid.viscosityPaS;

    let kMin = Infinity, kMax = -Infinity, kSum = 0;
    let epsMin = Infinity, epsMax = -Infinity, epsSum = 0;
    let nutMin = Infinity, nutMax = -Infinity, nutSum = 0;
    let hasNaN = false;
    let hasInf = false;
    let hasNegativeK = false;
    let hasNegativeEps = false;

    for (let i = 0; i < k.length; i++) {
      const vk = k[i];
      const ve = eps[i];
      const vn = nut[i];

      if (isNaN(vk) || isNaN(ve) || isNaN(vn)) hasNaN = true;
      if (!isFinite(vk) || !isFinite(ve) || !isFinite(vn)) hasInf = true;

      if (vk < 0) hasNegativeK = true;
      if (ve <= 0) hasNegativeEps = true;

      if (vk < kMin) kMin = vk;
      if (vk > kMax) kMax = vk;
      kSum += vk;

      if (ve < epsMin) epsMin = ve;
      if (ve > epsMax) epsMax = ve;
      epsSum += ve;

      if (vn < nutMin) nutMin = vn;
      if (vn > nutMax) nutMax = vn;
      nutSum += vn;
    }

    const n = k.length;
    const kMean = kSum / n;
    const epsMean = epsSum / n;
    const nutMean = nutSum / n;

    const maxViscosityRatio = mu > 0 ? nutMax / mu : 0;
    const isPhysicallyBounded = !hasNaN && !hasInf && !hasNegativeK && !hasNegativeEps && maxViscosityRatio < 1e5;

    // Decoupling test: check if nut was actually applied to the solution's wall shear or viscous forces
    const isDecoupledFromSolver = solution.monitors.viscousDragForceN === 0 && nutMax > 0;

    return {
      kMin, kMax, kMean,
      epsMin, epsMax, epsMean,
      nutMin, nutMax, nutMean,
      turbulentToLaminarViscosityRatioMax: maxViscosityRatio,
      hasNaN,
      hasInf,
      hasNegativeK,
      hasNegativeEps,
      isPhysicallyBounded,
      isDecoupledFromSolver
    };
  }
}
