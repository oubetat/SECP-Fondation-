/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Flux Assembly
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { FieldState, Vector3D } from './LaminarSolverTypes';

export class LaminarFluxAssembly {
  /**
   * Calculates mass fluxes on all faces for the current velocity field.
   */
  public static calculateMassFluxes(
    mesh: CFDMesh3D,
    state: FieldState,
    rho: number
  ): Float64Array {
    const faceCount = mesh.faces.length;
    const fluxes = new Float64Array(faceCount);

    for (let i = 0; i < faceCount; i++) {
      const face = mesh.faces[i];
      const owner = face.ownerCellId;
      const neighbor = face.neighborCellId;

      const u_owner = state.velocity[owner];
      const u_neighbor = (neighbor !== null && neighbor !== undefined) ? state.velocity[neighbor] : u_owner;
      
      const u_face: Vector3D = [
        0.5 * (u_owner[0] + u_neighbor[0]),
        0.5 * (u_owner[1] + u_neighbor[1]),
        0.5 * (u_owner[2] + u_neighbor[2])
      ];

      const massFlux = rho * (u_face[0] * face.normal[0] + u_face[1] * face.normal[1] + u_face[2] * face.normal[2]) * face.area;
      fluxes[i] = massFlux;
    }

    return fluxes;
  }
}
