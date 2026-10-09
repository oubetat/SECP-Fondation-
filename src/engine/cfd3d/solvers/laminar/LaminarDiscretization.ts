/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Discretization Engine
 */

import { CFDMesh3D, CFDMeshFace3D } from '../../mesh/CFDMeshTypes';
import { FVMEquationCoefficients } from '../../fvm/FVMTypes';
import { MaterialProperties, FieldState, Vector3D } from './LaminarSolverTypes';

export class LaminarDiscretization {
  /**
   * Assembles convection and diffusion terms for a face.
   */
  public static assembleFaceFlux(
    face: CFDMeshFace3D,
    rho: number,
    mu: number,
    u_field: readonly Vector3D[],
    p_field: readonly number[],
    coeffs: FVMEquationCoefficients[],
    componentIndex: number // 0 for X, 1 for Y, 2 for Z
  ): void {
    const owner = face.ownerCellId;
    const neighbor = face.neighborCellId;

    if (neighbor === null || neighbor === undefined) return;

    const area = face.area;
    const normal = face.normal;
    
    // 1. Interpolate velocity at face (Central Differencing)
    const u_owner = u_field[owner];
    const u_neighbor = u_field[neighbor];
    const u_face: Vector3D = [
      0.5 * (u_owner[0] + u_neighbor[0]),
      0.5 * (u_owner[1] + u_neighbor[1]),
      0.5 * (u_owner[2] + u_neighbor[2])
    ];

    // 2. Convective Flux: rho * (u . n) * area
    const massFlux = rho * (u_face[0] * normal[0] + u_face[1] * normal[1] + u_face[2] * normal[2]) * area;
    
    // Upwind scheme for stability
    const convectiveCoeffOwner = Math.max(massFlux, 0);
    const convectiveCoeffNeighbor = Math.max(-massFlux, 0);

    // 3. Diffusive Flux: mu * grad(u) . n * area
    // Simplified central difference for orthogonal mesh
    const dist = 1.0; // Assume unit distance for placeholder, should be calculated from centroids
    const diffusiveCoeff = (mu * area) / dist;

    // 4. Matrix updates (A x = b)
    // For cell i (owner): aP * u_i + sum(aN * u_j) = b
    // Flux from owner to neighbor is POSITIVE in the normal direction
    
    // Diffusion contribution
    coeffs[owner].aP += diffusiveCoeff;
    coeffs[owner].aN.set(neighbor, (coeffs[owner].aN.get(neighbor) || 0) - diffusiveCoeff);

    coeffs[neighbor].aP += diffusiveCoeff;
    coeffs[neighbor].aN.set(owner, (coeffs[neighbor].aN.get(owner) || 0) - diffusiveCoeff);

    // Convection contribution (Upwind)
    coeffs[owner].aP += convectiveCoeffOwner;
    coeffs[owner].aN.set(neighbor, (coeffs[owner].aN.get(neighbor) || 0) - convectiveCoeffNeighbor);

    coeffs[neighbor].aP += convectiveCoeffNeighbor;
    coeffs[neighbor].aN.set(owner, (coeffs[neighbor].aN.get(owner) || 0) - convectiveCoeffOwner);
  }

  public static assemblePressureGradient(
    face: CFDMeshFace3D,
    p_field: readonly number[],
    coeffs: FVMEquationCoefficients[],
    componentIndex: number
  ): void {
    const owner = face.ownerCellId;
    const neighbor = face.neighborCellId;

    if (neighbor === null || neighbor === undefined) return;

    const area = face.area;
    const normal = face.normal;
    
    // Pressure force: -grad(p) * volume = -sum(p_face * n * area)
    const p_face = 0.5 * (p_field[owner] + p_field[neighbor]);
    const pressureForce = -p_face * normal[componentIndex] * area;

    coeffs[owner].b += pressureForce;
    coeffs[neighbor].b -= pressureForce; // Opposite direction for neighbor
  }
}
