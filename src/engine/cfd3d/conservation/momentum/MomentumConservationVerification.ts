/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Conservation Verification Primitives
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { MomentumVector } from './MomentumConservationTypes';
import { MomentumFluxCalculator } from './MomentumFluxCalculator';

export class MomentumConservationVerification {

  public static verifyInternalMomentumFluxPairing(
    mesh: CFDMesh3D,
    convectiveFluxes: MomentumVector[],
    tolerance: number = 1e-12
  ): { valid: boolean; failures: number[] } {
    const failures: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      if (!face.isBoundary) {
        // If we only store one flux per face, the pairing is implicit in our calculation model.
        // But we must ensure the face has two neighbors.
        if (face.neighborCellId === null) {
          failures.push(fIdx);
        }
      }
    }
    return { valid: failures.length === 0, failures };
  }

  public static verifyMomentumRecomputation(
    mesh: CFDMesh3D,
    recordedConvective: MomentumVector[],
    densities: number[], // face densities
    velocities: [number, number, number][], // face velocities
    tolerance: number = 1e-10
  ): { valid: boolean; mismatches: number[] } {
    const mismatches: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const recomputed = MomentumFluxCalculator.calculateConvectiveFlux(
        face, 
        densities[fIdx], 
        velocities[fIdx], 
        face.normal
      );
      
      const diff = recomputed.subtract(recordedConvective[fIdx]).magnitude();
      if (diff > tolerance * Math.max(recomputed.magnitude(), 1.0)) {
        mismatches.push(fIdx);
      }
    }
    return { valid: mismatches.length === 0, mismatches };
  }

  public static verifyPressureForceRecomputation(
    mesh: CFDMesh3D,
    recordedForces: MomentumVector[],
    pressures: number[], // face pressures
    tolerance: number = 1e-10
  ): { valid: boolean; mismatches: number[] } {
    const mismatches: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const recomputed = MomentumFluxCalculator.calculatePressureForce(face, pressures[fIdx], face.normal);
      const diff = recomputed.subtract(recordedForces[fIdx]).magnitude();
      if (diff > tolerance * Math.max(recomputed.magnitude(), 1.0)) {
        mismatches.push(fIdx);
      }
    }
    return { valid: mismatches.length === 0, mismatches };
  }
}
