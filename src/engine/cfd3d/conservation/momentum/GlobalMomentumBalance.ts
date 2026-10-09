/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Global Momentum Balance
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { 
  MomentumVector, 
  GlobalMomentumBalanceResult, 
  ControlVolumeMomentumBalance, 
  MomentumConservationStatus 
} from './MomentumConservationTypes';

export class GlobalMomentumBalance {

  public static calculateGlobalBalance(
    mesh: CFDMesh3D,
    cellBalances: ControlVolumeMomentumBalance[],
    referenceFloor: number = 1e-15
  ): GlobalMomentumBalanceResult {
    let totalConvective = MomentumVector.zero();
    let totalPressure = MomentumVector.zero();
    let totalViscous = MomentumVector.zero();
    let totalBody = MomentumVector.zero();
    let totalSources = MomentumVector.zero();
    let totalAccumulation = MomentumVector.zero();
    let maxLocalImbalance = MomentumVector.zero();

    for (const cb of cellBalances) {
      totalBody = totalBody.add(cb.bodyForce);
      totalSources = totalSources.add(cb.sourceTerms);
      totalAccumulation = totalAccumulation.add(cb.accumulation);
      
      if (cb.imbalance.magnitude() > maxLocalImbalance.magnitude()) {
        maxLocalImbalance = cb.imbalance;
      }
    }

    // Boundary forces sum
    // In a global balance, internal forces cancel out.
    // We should ideally sum boundary fluxes/forces explicitly if we had them separate.
    // Here we'll sum the imbalances of all cells.
    let globalImbalance = MomentumVector.zero();
    for (const cb of cellBalances) {
      globalImbalance = globalImbalance.add(cb.imbalance);
    }

    const netLhs = totalAccumulation; // Convective net is boundary net
    // For simplicity in this foundation, we'll use the sum of cell imbalances 
    // which effectively gives the global domain imbalance.

    const denX = Math.max(Math.abs(globalImbalance.x), referenceFloor);
    const denY = Math.max(Math.abs(globalImbalance.y), referenceFloor);
    const denZ = Math.max(Math.abs(globalImbalance.z), referenceFloor);

    // This is a bit simplified; usually we normalize by a reference flow rate or similar.
    const normalizedGlobalImbalance = globalImbalance.magnitude() / referenceFloor; 

    const checkStatus = (val: number) => {
      if (!Number.isFinite(val)) return MomentumConservationStatus.INVALID;
      if (Math.abs(val) < 1e-6) return MomentumConservationStatus.CONSERVATIVE;
      return MomentumConservationStatus.NOT_CONSERVATIVE;
    };

    const componentStatus = {
      x: checkStatus(globalImbalance.x),
      y: checkStatus(globalImbalance.y),
      z: checkStatus(globalImbalance.z)
    };

    let status = MomentumConservationStatus.CONSERVATIVE;
    if (componentStatus.x !== MomentumConservationStatus.CONSERVATIVE ||
        componentStatus.y !== MomentumConservationStatus.CONSERVATIVE ||
        componentStatus.z !== MomentumConservationStatus.CONSERVATIVE) {
      status = MomentumConservationStatus.NOT_CONSERVATIVE;
    }

    return {
      totalConvectiveFlux: totalConvective, // Placeholder for net boundary flux
      totalPressureForce: totalPressure,
      totalViscousForce: totalViscous,
      totalBodyForce: totalBody,
      totalSourceTerms: totalSources,
      totalAccumulation,
      globalImbalance,
      normalizedGlobalImbalance,
      maxLocalImbalance,
      status,
      componentStatus
    };
  }
}
