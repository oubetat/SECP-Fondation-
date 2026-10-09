/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Mass Flux Calculator
 */

import { CFDMesh3D, Face3D } from '../mesh/CFDMeshTypes';

export interface DensityProvider {
  getDensityAtFace(faceIdx: number): number;
  getDensityAtCell(cellIdx: number): number;
}

export class MassFluxCalculator {
  
  /**
   * Computes discrete mass flux for a face: ṁ_f ≈ ρ_f (u_f · n_f) A_f
   * Outward normal convention: positive flux is OUTFLOW relative to owner cell.
   */
  public static calculateFaceMassFlux(
    face: Face3D,
    rhoF: number,
    uF: [number, number, number],
    nF: [number, number, number]
  ): number {
    if (!Number.isFinite(rhoF) || rhoF < 0) {
      throw new Error(`Invalid density for mass flux calculation: ${rhoF}`);
    }

    const dotProduct = uF[0] * nF[0] + uF[1] * nF[1] + uF[2] * nF[2];
    const mDot = rhoF * dotProduct * face.area;

    if (!Number.isFinite(mDot)) {
      throw new Error('Non-finite mass flux calculated');
    }

    return mDot;
  }

  /**
   * Recomputes mass flux independently from field data
   */
  public static recomputeMassFlux(
    face: Face3D,
    density: number,
    velocity: [number, number, number]
  ): number {
    return this.calculateFaceMassFlux(face, density, velocity, face.normal);
  }
}
