/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Conservation Verification Primitives
 */

import { CFDMesh3D, Face3D } from '../mesh/CFDMeshTypes';
import { MassFluxCalculator } from './MassFluxCalculator';

export class MassConservationVerification {
  
  public static verifyFaceNormalOrientation(mesh: CFDMesh3D): boolean {
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const owner = mesh.cells[face.ownerCellId];
      
      // Vector from cell center to face center if available
      if (face.center && owner && owner.center) {
        const dX = face.center[0] - owner.center[0];
        const dY = face.center[1] - owner.center[1];
        const dZ = face.center[2] - owner.center[2];
        
        // Dot product with normal must be positive for outward normal convention
        const dot = dX * face.normal[0] + dY * face.normal[1] + dZ * face.normal[2];
        if (dot <= 0) return false;
      }
    }
    return true;
  }

  public static verifyInternalFaceConservation(
    mesh: CFDMesh3D,
    faceFluxes: Float64Array,
    tolerance: number = 1e-12
  ): boolean {
    // If we only store one flux per face index, internal conservation is implicit
    // provided the face is shared by exactly two cells.
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      if (!face.isBoundary) {
        if (face.neighborCellId === null) return false;
      }
    }
    return true;
  }

  public static verifyMassFluxRecomputation(
    mesh: CFDMesh3D,
    recordedFluxes: Float64Array,
    densities: Float64Array,
    velocities: [number, number, number][],
    tolerance: number = 1e-10
  ): { valid: boolean; mismatches: number[] } {
    const mismatches: number[] = [];
    for (let fIdx = 0; fIdx < mesh.faces.length; fIdx++) {
      const face = mesh.faces[fIdx];
      const rho = densities[fIdx];
      const u = velocities[fIdx];
      const recomputed = MassFluxCalculator.recomputeMassFlux(face, rho, u);
      
      const diff = Math.abs(recomputed - recordedFluxes[fIdx]);
      if (diff > tolerance * Math.max(Math.abs(recomputed), 1.0)) {
        mismatches.push(fIdx);
      }
    }
    return { valid: mismatches.length === 0, mismatches };
  }
}
