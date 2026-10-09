/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Flux Calculator
 */

import { MomentumVector } from './MomentumConservationTypes';
import { CFDMeshFace3D } from '../../mesh/CFDMeshTypes';

export class MomentumFluxCalculator {

  /**
   * Calculates convective momentum flux across a face: F_m = rho * (u . n) * u * A
   */
  public static calculateConvectiveFlux(
    face: CFDMeshFace3D,
    rho: number,
    u: [number, number, number],
    n: [number, number, number]
  ): MomentumVector {
    if (!Number.isFinite(rho) || rho < 0) {
      throw new Error(`Invalid density for momentum flux: ${rho}`);
    }

    const dotProduct = u[0] * n[0] + u[1] * n[1] + u[2] * n[2];
    const scalarFlux = rho * dotProduct * face.area;
    
    return new MomentumVector(
      scalarFlux * u[0],
      scalarFlux * u[1],
      scalarFlux * u[2]
    );
  }

  /**
   * Calculates pressure force on a boundary face: F_p = -p * n * A
   */
  public static calculatePressureForce(
    face: CFDMeshFace3D,
    pressure: number,
    normal: [number, number, number]
  ): MomentumVector {
    const scalar = -pressure * face.area;
    return new MomentumVector(
      scalar * normal[0],
      scalar * normal[1],
      scalar * normal[2]
    );
  }

  /**
   * Calculates viscous force: F_v = tau . n * A
   * Foundation for Newtonian stress: tau = mu * (grad(u) + grad(u)^T)
   * This is a simplified placeholder as per PATCH-058 requirements (foundation).
   */
  public static calculateViscousForce(
    face: CFDMeshFace3D,
    mu: number,
    uGradient: number[][], // 3x3 tensor
    normal: [number, number, number]
  ): MomentumVector {
    // tau_ij = mu * (du_i/dx_j + du_j/dx_i)
    const tau = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        tau[i][j] = mu * (uGradient[i][j] + uGradient[j][i]);
      }
    }

    // F_i = sum_j (tau_ij * n_j) * Area
    const force = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        force[i] += tau[i][j] * normal[j];
      }
      force[i] *= face.area;
    }

    return new MomentumVector(force[0], force[1], force[2]);
  }
}
