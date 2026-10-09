/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Global Energy Balance
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import {
  ControlVolumeEnergyBalance,
  GlobalEnergyBalanceResult,
  EnergyConservationStatus,
  EnergyFormulation
} from './EnergyConservationTypes';

export class GlobalEnergyBalance {
  public static calculateGlobalBalance(
    mesh: CFDMesh3D,
    cellBalances: ControlVolumeEnergyBalance[],
    formulation: EnergyFormulation,
    referenceFloor: number = 1e-12,
    localTolerance: number = 1e-4,
    globalTolerance: number = 1e-6
  ): GlobalEnergyBalanceResult {
    let totalConvective = 0;
    let totalPressureWork = 0;
    let totalViscousWork = 0;
    let totalConductive = 0;
    let totalHeatSource = 0;
    let totalBodyPower = 0;
    let totalAccumulation = 0;
    let globalImbalance = 0;
    let maxLocalImbalance = 0;
    let normalizedMaxLocal = 0;
    let allFinite = true;

    for (const cb of cellBalances) {
      if (!cb.finite) allFinite = false;

      totalConvective += cb.netConvectiveFlux;
      totalPressureWork += cb.pressureWork;
      totalViscousWork += cb.viscousWork;
      totalConductive += cb.conductiveHeatFlux;
      totalHeatSource += cb.volumetricHeatSource;
      totalBodyPower += cb.bodyForcePower;
      totalAccumulation += cb.accumulation;

      globalImbalance += cb.imbalance;

      const absLocal = Math.abs(cb.imbalance);
      if (absLocal > maxLocalImbalance) {
        maxLocalImbalance = absLocal;
      }
      if (cb.normalizedImbalance > normalizedMaxLocal) {
        normalizedMaxLocal = cb.normalizedImbalance;
      }
    }

    const den = Math.max(
      Math.abs(totalAccumulation),
      Math.abs(totalConvective),
      Math.abs(totalConductive),
      Math.abs(totalHeatSource),
      referenceFloor
    );

    const normalizedGlobalImbalance = Math.abs(globalImbalance) / den;

    let status = EnergyConservationStatus.CONSERVATIVE;

    if (!allFinite) {
      status = EnergyConservationStatus.INVALID;
    } else if (normalizedGlobalImbalance > globalTolerance || normalizedMaxLocal > localTolerance) {
      status = EnergyConservationStatus.NOT_CONSERVATIVE;
    }

    return {
      totalConvectiveFlux: totalConvective,
      totalPressureWork,
      totalViscousWork,
      totalConductiveHeatFlux: totalConductive,
      totalVolumetricHeatSource: totalHeatSource,
      totalBodyForcePower: totalBodyPower,
      totalAccumulation,
      globalImbalance,
      normalizedGlobalImbalance,
      maxLocalImbalance,
      normalizedMaxLocalImbalance: normalizedMaxLocal,
      internalFaceImbalance: 0,
      status,
      formulation,
      finite: allFinite
    };
  }
}
