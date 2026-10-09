/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Continuity Equation (Pressure-Correction)
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { FVMEquationCoefficients } from '../../fvm/FVMTypes';
import { FieldState } from './LaminarSolverTypes';

export class ContinuityEquation {
  /**
   * Assembles the Pressure-Correction equation (A p' = b)
   * Based on the SIMPLE algorithm.
   */
  public static assemble(
    mesh: CFDMesh3D,
    state: FieldState,
    velocityCoeffs: { x: FVMEquationCoefficients[], y: FVMEquationCoefficients[], z: FVMEquationCoefficients[] },
    pressureCoeffs: FVMEquationCoefficients[]
  ): void {
    const cellCount = mesh.cells.length;

    for (const face of mesh.faces) {
      const owner = face.ownerCellId;
      const neighbor = face.neighborCellId;

      if (neighbor === null || neighbor === undefined) continue;

      const area = face.area;
      const normal = face.normal;

      // 1. Calculate d_f = volume_f / aP_f (Interpolated from cell centers)
      const aP_owner = velocityCoeffs.x[owner].aP; // Simplified: use x-component aP
      const aP_neighbor = velocityCoeffs.x[neighbor].aP;
      const d_f = 1.0 / (0.5 * (aP_owner + aP_neighbor)); // Placeholder simplification

      // 2. Off-diagonal coefficients: aN = rho * area^2 * d_f
      const coeff = 1.2 * area * area * d_f; // rho = 1.2

      pressureCoeffs[owner].aP += coeff;
      pressureCoeffs[owner].aN.set(neighbor, (pressureCoeffs[owner].aN.get(neighbor) || 0) - coeff);

      pressureCoeffs[neighbor].aP += coeff;
      pressureCoeffs[neighbor].aN.set(owner, (pressureCoeffs[neighbor].aN.get(owner) || 0) - coeff);

      // 3. Source term: b = sum(rho * u_star . n * area) (Mass imbalance)
      const u_owner = state.velocity[owner];
      const u_neighbor = state.velocity[neighbor];
      const u_face = [
        0.5 * (u_owner[0] + u_neighbor[0]),
        0.5 * (u_owner[1] + u_neighbor[1]),
        0.5 * (u_owner[2] + u_neighbor[2])
      ];

      const massFlux = 1.2 * (u_face[0] * normal[0] + u_face[1] * normal[1] + u_face[2] * normal[2]) * area;
      pressureCoeffs[owner].b -= massFlux;
      pressureCoeffs[neighbor].b += massFlux;
    }
  }
}
