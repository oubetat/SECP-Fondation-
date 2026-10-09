/**
 * SECP CAD Kernel — Trim Surface Construction Engine
 */

import { Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepTrimmedSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import { SurfaceConstructionError } from './BoundaryLoftSweepTypes';

export class TrimSurfaceBuilder {
  /**
   * Constructs a Trimmed Surface from a base surface and trimming boundaries.
   */
  public static buildTrimSurface(
    baseSurface: any,
    trimTool: Curve | Curve[] | any,
    keepSide: 'LEFT' | 'RIGHT' | 'BOTH' = 'LEFT'
  ): { surface: BRepTrimmedSurface; data: NURBSSurfaceData } {
    if (!baseSurface || !trimTool) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Trim requires a base surface and a trimming tool.');
    }

    // In a real kernel, this would perform intersection in parameter space
    // and create a B-Rep face with loops.
    const trimLoops = Array.isArray(trimTool) ? trimTool : [trimTool];
    
    const surface = new BRepTrimmedSurface(baseSurface, trimLoops, keepSide !== 'RIGHT');

    // For rendering, we might need a tessellated representation of the trimmed surface
    // Here we just proxy the base surface data with trimming metadata
    const baseData = (baseSurface as any).toNURBSData ? (baseSurface as any).toNURBSData() : {};
    const data: NURBSSurfaceData = {
      ...baseData,
      id: `TRIMMED_${Math.random().toString(36).substring(2, 8)}`,
      // Add trimming info to metadata
      metadata: {
        isTrimmed: true,
        trimLoopsCount: trimLoops.length,
        keepSide
      }
    };

    return { surface, data };
  }
}
