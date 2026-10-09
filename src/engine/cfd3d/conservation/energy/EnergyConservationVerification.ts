/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Conservation Verification Primitives
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { EnergyState } from './EnergyState';
import { EnergyFormulation, EnergyConservationStatus } from './EnergyConservationTypes';
import { EnergyFluxCalculator } from './EnergyFluxCalculator';
import { HeatFluxCalculator } from './HeatFluxCalculator';

export class EnergyConservationVerification {
  public static verifyEnergyState(state: EnergyState): boolean {
    return Number.isFinite(state.temperature) &&
           state.temperature > 0 &&
           Number.isFinite(state.density) &&
           state.density > 0 &&
           Number.isFinite(state.specificHeatCv) &&
           state.specificHeatCv > 0 &&
           Number.isFinite(state.specificHeatCp) &&
           state.specificHeatCp > 0 &&
           state.velocity.every(v => Number.isFinite(v));
  }

  public static verifyInternalEnergyFluxPairing(
    mesh: CFDMesh3D,
    convectiveFluxes: number[],
    tolerance: number = 1e-12
  ): { valid: boolean; failures: number[] } {
    const failures: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      if (!face.isBoundary) {
        if (face.neighborCellId === null) {
          failures.push(fIdx);
        }
      }
    }
    return { valid: failures.length === 0, failures };
  }

  public static verifyNoDoubleCounting(
    formulation: EnergyFormulation,
    includesPressureWorkInConvective: boolean,
    separatePressureWorkAdded: boolean
  ): { valid: boolean; reason?: string } {
    if (formulation === EnergyFormulation.TOTAL_ENERGY || formulation === EnergyFormulation.TOTAL_ENTHALPY) {
      if (includesPressureWorkInConvective && separatePressureWorkAdded) {
        return {
          valid: false,
          reason: 'Pressure work is double-counted: present in total energy/enthalpy flux and added separately'
        };
      }
    }
    return { valid: true };
  }

  public static verifyEnergyRecomputation(
    mesh: CFDMesh3D,
    recordedConvectiveFluxes: number[],
    densities: number[],
    energyValues: number[],
    velocities: [number, number, number][],
    tolerance: number = 1e-10
  ): { valid: boolean; mismatches: number[] } {
    const mismatches: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const recomputed = EnergyFluxCalculator.recomputeConvectiveEnergyFlux(
        face,
        densities[fIdx],
        energyValues[fIdx],
        velocities[fIdx],
        face.normal
      );

      const diff = Math.abs(recomputed - recordedConvectiveFluxes[fIdx]);
      if (diff > tolerance * Math.max(Math.abs(recomputed), 1.0)) {
        mismatches.push(fIdx);
      }
    }
    return { valid: mismatches.length === 0, mismatches };
  }

  public static verifyHeatFluxRecomputation(
    mesh: CFDMesh3D,
    recordedHeatFluxes: number[],
    conductivities: number[],
    tempGradients: [number, number, number][],
    tolerance: number = 1e-10
  ): { valid: boolean; mismatches: number[] } {
    const mismatches: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const recomputed = HeatFluxCalculator.calculateFaceHeatFlux(
        face,
        conductivities[fIdx],
        tempGradients[fIdx],
        face.normal
      );

      const diff = Math.abs(recomputed - recordedHeatFluxes[fIdx]);
      if (diff > tolerance * Math.max(Math.abs(recomputed), 1.0)) {
        mismatches.push(fIdx);
      }
    }
    return { valid: mismatches.length === 0, mismatches };
  }
}
