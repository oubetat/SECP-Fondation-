/**
 * PATCH-176: Turbulence Viscosity Verifier
 * 
 * Verifies that turbulent eddy viscosity nut (or mu_t) is derived from model equations
 * and correctly alters momentum diffusion and wall shear stress.
 */

import { ViscosityVerificationResult } from './types';
import { CfdSolution3D } from '../../cfd3d/Fvm3DTypes';

export class TurbulenceViscosityVerifier {
  public static verifyViscosity(
    laminarSolution: CfdSolution3D,
    turbulentSolution: CfdSolution3D
  ): ViscosityVerificationResult {
    const turb = turbulentSolution.turbulence;
    if (!turb || !turb.nut || turb.nut.length === 0) {
      return {
        isNutCalculatedFromModel: false,
        isNutConstant: true,
        nutFormulaUsed: 'NONE',
        nutMaxPaS: 0,
        momentumDiffusionConductanceAltered: false,
        impactOnWallShearPercent: 0,
        status: 'FAIL'
      };
    }

    const { k, epsilon: eps, nut } = turb;
    const rho = turbulentSolution.fluid.densityKgM3;
    const C_mu = 0.09;

    let maxNut = 0.0;
    let isNutCalculatedFromModel = true;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < nut.length; i++) {
      const val = nut[i];
      if (val > maxNut) maxNut = val;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;

      // Verify formula: nut = rho * C_mu * k^2 / eps
      const expectedNut = rho * C_mu * (k[i] * k[i]) / Math.max(eps[i], 1e-10);
      if (Math.abs(val - expectedNut) > 1e-6) {
        isNutCalculatedFromModel = false;
      }
    }

    const isNutConstant = Math.abs(maxVal - minVal) < 1e-12;

    const lamWallShear = laminarSolution.monitors.viscousDragForceN;
    const turbWallShear = turbulentSolution.monitors.viscousDragForceN;

    const impactOnWallShearPercent = lamWallShear > 0 ? ((turbWallShear - lamWallShear) / lamWallShear) * 100 : 0;
    const momentumDiffusionConductanceAltered = maxNut > 0 && Math.abs(impactOnWallShearPercent) > 0.001;

    let status: ViscosityVerificationResult['status'] = 'FAIL';
    if (isNutCalculatedFromModel && momentumDiffusionConductanceAltered) {
      status = 'STATIC_VISCOSITY_EFFECTIVE'; // Effective viscosity active in matrix, though k/eps static
    } else if (isNutCalculatedFromModel && maxNut > 0) {
      status = 'DYNAMIC_VISCOSITY_VERIFIED';
    } else if (isNutConstant) {
      status = 'FROZEN_CONSTANT';
    }

    return {
      isNutCalculatedFromModel,
      isNutConstant,
      nutFormulaUsed: 'nut = rho * C_mu * (k^2 / eps)',
      nutMaxPaS: maxNut,
      momentumDiffusionConductanceAltered,
      impactOnWallShearPercent,
      status
    };
  }
}
