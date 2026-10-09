/**
 * SECP CAD Kernel — Blend Surface Construction Engine
 */

import { Point } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface, BRepPoint } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import { SurfaceConstructionError } from './BoundaryLoftSweepTypes';

export class BlendSurfaceBuilder {
  /**
   * Constructs a Blend Surface between two surface edges.
   */
  public static buildBlendSurface(
    surfaceA: BRepNURBSSurface,
    surfaceB: BRepNURBSSurface,
    radius: number,
    options: { continuity?: 'G1' | 'G2' } = {}
  ): { surface: BRepNURBSSurface; data: NURBSSurfaceData } {
    if (!surfaceA || !surfaceB) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Blend requires two surfaces.');
    }

    // Simplified implementation: Create a ruled/loft surface between the last edges of A and first edges of B
    // In a real kernel, this would be a rolling ball blend or similar.
    const netA = surfaceA.controlPoints;
    const netB = surfaceB.controlPoints;

    const edgeA = netA[netA.length - 1]; // Last row of A
    const edgeB = netB[0]; // First row of B

    const numU = 2; // Simple blend
    const numV = Math.min(edgeA.length, edgeB.length);
    const controlNet: BRepPoint[][] = [];

    const row1: BRepPoint[] = [];
    const row2: BRepPoint[] = [];

    for (let j = 0; j < numV; j++) {
      row1.push(new BRepPoint(edgeA[j].x, edgeA[j].y, edgeA[j].z));
      row2.push(new BRepPoint(edgeB[j].x, edgeB[j].y, edgeB[j].z));
    }

    controlNet.push(row1);
    controlNet.push(row2);

    const surface = new BRepNURBSSurface(1, 3, [0, 0, 1, 1], NURBSEngine.generateUniformKnots(numV, 3), controlNet);
    const data = NURBSEngine.toNURBSSurfaceData(surface, `BLEND_${Math.random().toString(36).substring(2, 8)}`);

    return { surface, data };
  }
}
