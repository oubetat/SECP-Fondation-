/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Conductive Heat Flux Calculator
 */

import { CFDMeshFace3D } from '../../mesh/CFDMeshTypes';
import { ThermalConductivityProvider } from './ThermalConductivityProvider';

export class HeatFluxCalculator {
  /**
   * Calculates conductive heat flux through a face: Q_conductive = -k * (gradT . n) * A
   * Positive = Outflow of thermal energy.
   */
  public static calculateFaceHeatFlux(
    face: CFDMeshFace3D,
    k: number,
    temperatureGradient: [number, number, number],
    normal: [number, number, number]
  ): number {
    if (!Number.isFinite(k) || k < 0) {
      throw new Error(`Invalid thermal conductivity in heat flux calculation: ${k}`);
    }
    if (temperatureGradient.some(g => !Number.isFinite(g))) {
      throw new Error(`Non-finite temperature gradient in heat flux calculation`);
    }

    const gradDotN = temperatureGradient[0] * normal[0] +
                     temperatureGradient[1] * normal[1] +
                     temperatureGradient[2] * normal[2];

    const heatFlux = -k * gradDotN * face.area;
    if (!Number.isFinite(heatFlux)) {
      throw new Error(`Non-finite heat flux calculated: ${heatFlux}`);
    }
    return heatFlux;
  }

  /**
   * Calculates heat flux across an internal face using 1D directional temperature difference
   * Q = -k * (T_neighbor - T_owner) / distance * Area
   */
  public static calculateInternalFaceHeatFlux(
    face: CFDMeshFace3D,
    k: number,
    tOwner: number,
    tNeighbor: number,
    distance: number
  ): number {
    if (!Number.isFinite(distance) || distance <= 0) {
      throw new Error(`Invalid distance between cell centers: ${distance}`);
    }
    const gradApprox = (tNeighbor - tOwner) / distance;
    return -k * gradApprox * face.area;
  }
}
