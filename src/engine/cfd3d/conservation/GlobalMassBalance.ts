/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Global Mass Balance
 */

import { CFDMesh3D } from '../mesh/CFDMeshTypes';
import { GlobalMassBalanceResult, MassConservationStatus } from './MassConservationTypes';
import { ControlVolumeMassBalance } from './MassConservationTypes';

export class GlobalMassBalance {
  
  public static calculateGlobalBalance(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array,
    cellBalances: ControlVolumeMassBalance[],
    referenceFloor: number = 1e-15
  ): GlobalMassBalanceResult {
    let totalInflow = 0.0;
    let totalOutflow = 0.0;
    let netBoundaryFlux = 0.0;
    let accumulation = 0.0;
    let maxLocalImbalance = 0.0;
    let normalizedMaxLocalImbalance = 0.0;
    let internalFaceImbalance = 0.0;

    // 1. Sum up boundary fluxes
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const flux = faceFluxes[fIdx];

      if (face.isBoundary) {
        netBoundaryFlux += flux;
        if (flux > 0) {
          totalOutflow += flux;
        } else {
          totalInflow += Math.abs(flux);
        }
      } else {
        // Internal face conservation check (analytical)
        // Internal faces are only counted once in faceFluxes array.
        // The conservation is implicit if we use the same value for owner and neighbor.
      }
    }

    // 2. Accumulate local metrics
    for (const balance of cellBalances) {
      accumulation += balance.accumulation;
      if (Math.abs(balance.imbalance) > maxLocalImbalance) {
        maxLocalImbalance = Math.abs(balance.imbalance);
      }
      if (balance.normalizedImbalance > normalizedMaxLocalImbalance) {
        normalizedMaxLocalImbalance = balance.normalizedImbalance;
      }
    }

    const globalMassImbalance = netBoundaryFlux + accumulation;
    const den = Math.max(totalInflow, totalOutflow, referenceFloor);
    const normalizedGlobalImbalance = Math.abs(globalMassImbalance) / den;

    let status = MassConservationStatus.CONSERVATIVE;
    if (normalizedGlobalImbalance > 1e-4 || normalizedMaxLocalImbalance > 1e-2) {
      status = MassConservationStatus.NOT_CONSERVATIVE;
    }

    return {
      totalInflow,
      totalOutflow,
      netBoundaryFlux,
      accumulation,
      globalMassImbalance,
      normalizedGlobalImbalance,
      maxLocalImbalance,
      normalizedMaxLocalImbalance,
      internalFaceImbalance,
      status,
      finite: Number.isFinite(globalMassImbalance)
    };
  }
}
