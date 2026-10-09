/**
 * SECP Industrial OS v2 — FVM Assembly
 * PATCH-052: Finite Volume Core
 */

import { CFDMesh } from '../mesh/CFDMeshTypes';
import { 
  FVMControlVolume, 
  FVMFace, 
  FVMEquationCoefficients, 
  FVMField,
  FieldLocation
} from './FVMTypes';
import { FVMGeometryCore } from './FVMGeometry';

export class FVMAssembly {
  /**
   * Assembles the discrete algebraic equation for a single control volume.
   */
  public static assembleCell(
    cv: FVMControlVolume,
    mesh: CFDMesh,
    phi_old: FVMField<number> | null,
    dt: number,
    rho: number = 1.0 // Simple constant for infrastructure
  ): FVMEquationCoefficients {
    const aN = new Map<number, number>();
    let aP = 0;
    let b = 0;
    let transientContribution = 0;

    // 1. Transient term (if dt > 0)
    if (dt > 0 && phi_old && phi_old.location === FieldLocation.CELL) {
      const idx = mesh.cells.findIndex(c => c.id === cv.cellId);
      const phi_p_old = phi_old.values[idx];
      
      const storageCoeff = (rho * cv.volume) / dt;
      aP += storageCoeff;
      b += storageCoeff * phi_p_old;
      transientContribution = storageCoeff * phi_p_old;
    }

    // Note: Diffusion and Convection fluxes (aN and aP additions) 
    // are scheme-dependent and belong to PATCH-053.
    // PATCH-052 provides the infrastructure to map these.

    return {
      aP,
      aN,
      b,
      transientContribution,
      boundaryContribution: 0
    };
  }

  /**
   * Verifies internal face antisymmetry: ownerContribution + neighborContribution ≈ 0
   */
  public static verifyInternalConservation(
    face: FVMFace,
    ownerFlux: number,
    neighborFlux: number,
    tolerance: number
  ): boolean {
    if (face.neighborCellId === null) return true; // Boundary face
    const sum = ownerFlux + neighborFlux;
    return Math.abs(sum) <= tolerance;
  }
}
