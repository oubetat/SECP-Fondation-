/**
 * SECP Industrial OS v2 — Flux Imbalance Auditor
 * Phase 16 (PATCH-175)
 *
 * Performs detailed audits across boundary and internal face fluxes,
 * returning a comprehensive multi-physics FluxBalanceReport.
 */

import { FvmMesh3D } from '../../Fvm3DTypes';
import { FluxBalanceReport } from './ConservationEnforcementTypes';

export class FluxImbalanceAuditor {
  public static audit(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    p: number[],
    rho: number,
    mu: number,
    T?: number[]
  ): FluxBalanceReport {
    let massIn = 0, massOut = 0, massWall = 0, massInternalNet = 0;

    let fxIn = 0, fxOut = 0, fxPress = 0, fxVisc = 0;
    let fyIn = 0, fyOut = 0, fyPress = 0, fyVisc = 0;
    let fzIn = 0, fzOut = 0, fzPress = 0, fzVisc = 0;

    let eIn = 0, eOut = 0, eHeat = 0, eWork = 0;
    const cp = 1005.0;

    for (const face of mesh.faces) {
      const ownerId = face.ownerCellId;
      const neighId = face.neighborCellId;

      let faceU = u[ownerId];
      let faceV = v[ownerId];
      let faceW = w[ownerId];
      let faceP = p[ownerId];
      let faceT = T ? T[ownerId] : 300.0;

      if (neighId !== -1) {
        faceU = 0.5 * (u[ownerId] + u[neighId]);
        faceV = 0.5 * (v[ownerId] + v[neighId]);
        faceW = 0.5 * (w[ownerId] + w[neighId]);
        faceP = 0.5 * (p[ownerId] + p[neighId]);
        if (T) faceT = 0.5 * (T[ownerId] + T[neighId]);

        const dotVn = faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
        massInternalNet += rho * face.area * dotVn;
      } else {
        // Boundary face
        if (face.boundaryType === 'INLET' && face.u_bc !== undefined) {
          faceU = face.u_bc;
        }

        const dotVn = faceU * face.normal.x + faceV * face.normal.y + faceW * face.normal.z;
        const mDot = rho * face.area * dotVn;

        if (face.boundaryType === 'INLET') {
          massIn += Math.abs(mDot);
          fxIn += mDot * faceU;
          fyIn += mDot * faceV;
          fzIn += mDot * faceW;
          eIn += Math.abs(mDot) * (cp * faceT + 0.5 * faceU * faceU);
        } else if (face.boundaryType === 'OUTLET' || face.boundaryType === 'PRESSURE_OUTLET') {
          massOut += Math.abs(mDot);
          fxOut += mDot * faceU;
          fyOut += mDot * faceV;
          fzOut += mDot * faceW;
          eOut += Math.abs(mDot) * (cp * faceT + 0.5 * faceU * faceU);
        } else if (face.boundaryType && face.boundaryType.startsWith('WALL')) {
          massWall += Math.abs(mDot);
          const cell = mesh.cells[ownerId];
          const dy = Math.max(1e-6, Math.abs(face.centroid.y - cell.centroid.y));
          const tauW = mu * (u[ownerId] / dy);
          fxVisc -= tauW * face.area;
        }

        fxPress -= faceP * face.area * face.normal.x;
        fyPress -= faceP * face.area * face.normal.y;
        fzPress -= faceP * face.area * face.normal.z;
        eWork += faceP * face.area * dotVn;
      }
    }

    const massImbalance = Math.abs(massIn - massOut);
    const massRelError = massImbalance / Math.max(massIn, massOut, 1e-6);

    const fxImbalance = Math.abs(fxIn - fxOut + fxPress + fxVisc);
    const fyImbalance = Math.abs(fyIn - fyOut + fyPress + fyVisc);
    const fzImbalance = Math.abs(fzIn - fzOut + fzPress + fzVisc);

    const energyImbalance = Math.abs(eIn - eOut + eHeat + eWork);
    const energyRelError = energyImbalance / Math.max(eIn, eOut, 10.0);

    return {
      massBalance: {
        inletFlux: massIn,
        outletFlux: massOut,
        wallFlux: massWall,
        internalNet: massInternalNet,
        sourceNet: 0,
        imbalance: massImbalance,
        relError: massRelError
      },
      momentumBalance: {
        fx_inflow: fxIn,
        fx_outflow: fxOut,
        fx_pressure: fxPress,
        fx_viscous: fxVisc,
        fx_imbalance: fxImbalance,
        fy_inflow: fyIn,
        fy_outflow: fyOut,
        fy_pressure: fyPress,
        fy_viscous: fyVisc,
        fy_imbalance: fyImbalance,
        fz_inflow: fzIn,
        fz_outflow: fzOut,
        fz_pressure: fzPress,
        fz_viscous: fzVisc,
        fz_imbalance: fzImbalance
      },
      energyBalance: {
        inflowEnergy: eIn,
        outflowEnergy: eOut,
        heatAddition: eHeat,
        workDone: eWork,
        imbalance: energyImbalance,
        relError: energyRelError
      }
    };
  }
}
