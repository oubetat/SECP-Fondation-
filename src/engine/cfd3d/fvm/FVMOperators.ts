/**
 * SECP Industrial OS v2 — FVM Operators
 * PATCH-052: Finite Volume Core
 */

import { CFDMesh } from '../mesh/CFDMeshTypes';
import { FVMField, FVMControlVolume, FVMFace } from './FVMTypes';
import { FVMGeometryCore } from './FVMGeometry';
import { ToleranceEngine } from '../../cad-kernel/tolerance/ToleranceModel';

export class FVMOperators {
  /**
   * Finite Volume Divergence: (1/V) * sum( Flux_face . normal_face * Area_face )
   * F_face is a vector field at faces.
   */
  public static calculateDivergence(
    cv: FVMControlVolume,
    faceFluxes: Map<number, [number, number, number]>, // faceId -> vector flux
    mesh: CFDMesh
  ): number {
    if (cv.volume <= 0) return NaN;

    let sum = 0;
    const faceMap = new Map(mesh.faces.map(f => [f.id, f]));

    for (const fId of cv.faceIds) {
      const face = faceMap.get(fId);
      if (!face) continue;

      const fvmFace = FVMGeometryCore.buildFVMFace(face, mesh, cv.cellId);
      const flux = faceFluxes.get(fId);
      if (!flux) continue;

      // dot product: flux . normal
      const dot = flux[0] * fvmFace.normal[0] + flux[1] * fvmFace.normal[1] + flux[2] * fvmFace.normal[2];
      sum += dot * fvmFace.area;
    }

    return sum / cv.volume;
  }

  /**
   * Basic Green-Gauss Gradient for cell-centered scalars.
   * grad(phi) = (1/V) * sum( phi_face * normal_face * Area_face )
   * At PATCH-052, we assume face values are provided (e.g. via interpolation).
   */
  public static calculateGradient(
    cv: FVMControlVolume,
    faceValues: Map<number, number>, // faceId -> scalar value
    mesh: CFDMesh
  ): [number, number, number] {
    if (cv.volume <= 0) return [NaN, NaN, NaN];

    let gx = 0, gy = 0, gz = 0;
    const faceMap = new Map(mesh.faces.map(f => [f.id, f]));

    for (const fId of cv.faceIds) {
      const face = faceMap.get(fId);
      if (!face) continue;

      const fvmFace = FVMGeometryCore.buildFVMFace(face, mesh, cv.cellId);
      const phi_f = faceValues.get(fId) ?? 0;

      gx += phi_f * fvmFace.normal[0] * fvmFace.area;
      gy += phi_f * fvmFace.normal[1] * fvmFace.area;
      gz += phi_f * fvmFace.normal[2] * fvmFace.area;
    }

    return [gx / cv.volume, gy / cv.volume, gz / cv.volume];
  }

  /**
   * Volume Integral: sum( phi_cell * V_cell )
   */
  public static integrateVolume(
    cvs: FVMControlVolume[],
    cellField: FVMField<number>
  ): number {
    let total = 0;
    for (let i = 0; i < cvs.length; i++) {
      total += cellField.values[i] * cvs[i].volume;
    }
    return total;
  }
}
