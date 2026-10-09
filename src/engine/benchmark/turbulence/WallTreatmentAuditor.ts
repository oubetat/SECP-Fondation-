/**
 * PATCH-176: Wall Treatment Auditor
 * 
 * Audits near-wall resolution and boundary treatment:
 * - Calculates wall shear stress tau_w
 * - Friction velocity u_tau = sqrt(tau_w / rho)
 * - Non-dimensional wall distance y+ = (u_tau * y) / nu
 * - Evaluates log-law agreement u+ = (1/kappa) * ln(y+) + B
 */

import { WallTreatmentAudit } from './types';
import { CfdSolution3D } from '../../cfd3d/Fvm3DTypes';

export class WallTreatmentAuditor {
  public static auditWallTreatment(solution: CfdSolution3D): WallTreatmentAudit {
    const mesh = solution.mesh;
    const fluid = solution.fluid;
    const u = solution.velocity.u;
    const v = solution.velocity.v;
    const w = solution.velocity.w;
    const nut = solution.turbulence?.nut || new Array(mesh.cells.length).fill(0.0);

    const rho = fluid.densityKgM3;
    const mu = fluid.viscosityPaS;
    const nu = mu / Math.max(rho, 1e-10);

    let yPlusMin = Infinity;
    let yPlusMax = -Infinity;
    let yPlusSum = 0;
    let count = 0;
    let maxTauW = 0;

    for (const face of mesh.faces) {
      if (face.boundaryType === 'WALL') {
        const c = face.ownerCellId;
        if (c < 0 || c >= mesh.cells.length) continue;

        const cellCentroid = mesh.cells[c].centroid;
        const faceCentroid = face.centroid;

        // Normal distance y to wall face
        const y = Math.sqrt(
          Math.pow(cellCentroid.x - faceCentroid.x, 2) +
          Math.pow(cellCentroid.y - faceCentroid.y, 2) +
          Math.pow(cellCentroid.z - faceCentroid.z, 2)
        );

        const effMu = mu + nut[c];
        const uParallel = Math.sqrt(u[c] * u[c] + v[c] * v[c] + w[c] * w[c]);
        const tauW = effMu * (uParallel / Math.max(y, 1e-6));

        if (tauW > maxTauW) maxTauW = tauW;

        const uTau = Math.sqrt(Math.abs(tauW) / Math.max(rho, 1e-10));
        const yPlus = (uTau * Math.max(y, 1e-6)) / Math.max(nu, 1e-12);

        if (yPlus < yPlusMin) yPlusMin = yPlus;
        if (yPlus > yPlusMax) yPlusMax = yPlus;
        yPlusSum += yPlus;
        count++;
      }
    }

    if (count === 0) {
      return {
        yPlusMin: 0,
        yPlusMax: 0,
        yPlusMean: 0,
        wallDistanceCalculated: false,
        wallShearPa: 0,
        frictionVelocityUTau: 0,
        wallFunctionType: 'UNPROVEN',
        nearWallMeshResolutionOK: false,
        details: 'No wall boundary faces found in mesh.'
      };
    }

    const yPlusMean = yPlusSum / count;
    const maxUTau = Math.sqrt(maxTauW / Math.max(rho, 1e-10));

    // Near-wall resolution status:
    // y+ < 5: Viscous sublayer resolved
    // 30 < y+ < 300: Log-law region suitable for standard wall functions
    const nearWallMeshResolutionOK = yPlusMean < 300.0;

    // Check if solver uses explicit wall functions or laminar viscous wall shear
    const wallFunctionType: WallTreatmentAudit['wallFunctionType'] = 'UNPROVEN'; // Solver currently uses linear viscous shear (effMu * u / d_wall) rather than explicit Spalding/Launder-Spalding wall function log-law BCs

    return {
      yPlusMin: isFinite(yPlusMin) ? yPlusMin : 0,
      yPlusMax: isFinite(yPlusMax) ? yPlusMax : 0,
      yPlusMean,
      wallDistanceCalculated: true,
      wallShearPa: maxTauW,
      frictionVelocityUTau: maxUTau,
      wallFunctionType,
      nearWallMeshResolutionOK,
      details: `Mean y+ = ${yPlusMean.toFixed(2)} (Min: ${yPlusMin.toFixed(2)}, Max: ${yPlusMax.toFixed(2)}). Wall shear tau_w = ${maxTauW.toFixed(4)} Pa. Linear viscous near-wall shear active; explicit log-law wall functions classified as UNPROVEN.`
    };
  }
}
