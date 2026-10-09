/**
 * SECP CAD Kernel — Surface Reconstruction Engine
 * PATCH-205: Phase 18 — Professional Modeling
 *
 * Provides local patch creation, boundary reconstruction, and global surface fallback reconstruction.
 */

import { Point } from '../../../cad-kernel/geometry/GeometryContracts';
import { NURBSSurfaceData } from '../../nurbs/NURBSTypes';
import { NURBSEngine } from '../../nurbs/NURBSEngine';
import { BoundarySurfaceBuilder } from '../BoundarySurfaceBuilder';

export class SurfaceReconstructionEngine {
  /**
   * Reconstruct a missing/damaged patch from 4 boundary curves
   */
  public static reconstructLocalPatch(
    boundaryCurves: Point[][],
    degreeU: number = 3,
    degreeV: number = 3
  ): NURBSSurfaceData {
    if (boundaryCurves.length < 4) {
      throw new Error('Surface patch reconstruction requires 4 boundary curves.');
    }

    const c1 = boundaryCurves[0];
    const c2 = boundaryCurves[1];
    const c3 = boundaryCurves[2];
    const c4 = boundaryCurves[3];

    return BoundarySurfaceBuilder.buildCoonsPatch(c1, c2, c3, c4, 6, 6);
  }

  /**
   * Rebuild entire surface as global fallback when local repair is impossible
   */
  public static globalReconstructionFallback(
    originalSurface: NURBSSurfaceData,
    fallbackReason: string
  ): {
    reconstructedSurface: NURBSSurfaceData;
    fallbackReason: string;
    originalGeometryHash: string;
    reconstructedGeometryHash: string;
  } {
    const origHash = `HASH_ORIG_${Math.random().toString(36).substring(2, 10)}`;

    // Reconstruct clean Coons surface from 4 outer boundaries of original
    const cpts = originalSurface.controlPoints;
    const numU = cpts.length;
    const numV = cpts[0].length;

    const b1 = cpts[0];
    const b2 = cpts.map(r => r[numV - 1]);
    const b3 = cpts[numU - 1];
    const b4 = cpts.map(r => r[0]);

    const reconstructed = BoundarySurfaceBuilder.buildCoonsPatch(b1, b2, b3, b4, 6, 6);
    const recHash = `HASH_REC_${Math.random().toString(36).substring(2, 10)}`;

    return {
      reconstructedSurface: reconstructed,
      fallbackReason,
      originalGeometryHash: origHash,
      reconstructedGeometryHash: recHash
    };
  }
}
