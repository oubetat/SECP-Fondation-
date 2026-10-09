/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Pressure Work & Viscous Work Calculators
 */

import { CFDMeshFace3D } from '../../mesh/CFDMeshTypes';

export class PressureWorkCalculator {
  /**
   * Calculates rate of pressure work done on fluid face: W_p = p * (u . n) * A
   * Positive = Work exported / Outflow of pressure energy
   */
  public static calculatePressureWork(
    face: CFDMeshFace3D,
    pressure: number,
    velocity: [number, number, number],
    normal: [number, number, number]
  ): number {
    if (!Number.isFinite(pressure)) {
      throw new Error(`Invalid non-finite pressure in pressure work calculation: ${pressure}`);
    }
    const uDotN = velocity[0] * normal[0] + velocity[1] * normal[1] + velocity[2] * normal[2];
    const work = pressure * uDotN * face.area;
    if (!Number.isFinite(work)) {
      throw new Error(`Non-finite pressure work calculated`);
    }
    return work;
  }
}

export class ViscousWorkCalculator {
  /**
   * Calculates rate of viscous work on fluid face: W_viscous = ((tau . u) . n) * A
   */
  public static calculateViscousWork(
    face: CFDMeshFace3D,
    viscousStressTensor: number[][], // 3x3
    velocity: [number, number, number],
    normal: [number, number, number]
  ): number {
    // tau . u vector = [ sum_j tau_ij u_j ]
    const tauU = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        tauU[i] += viscousStressTensor[i][j] * velocity[j];
      }
    }
    const work = (tauU[0] * normal[0] + tauU[1] * normal[1] + tauU[2] * normal[2]) * face.area;
    if (!Number.isFinite(work)) {
      throw new Error(`Non-finite viscous work calculated`);
    }
    return work;
  }
}
