/**
 * SECP CAD Kernel — Offset Surface Construction Engine
 */

import { Point, Vector } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface, BRepPoint, BRepVector } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import { SurfaceConstructionError } from './BoundaryLoftSweepTypes';

export class OffsetSurfaceBuilder {
  /**
   * Constructs an Offset Surface from a base surface.
   */
  public static buildOffsetSurface(
    baseSurface: BRepNURBSSurface,
    distance: number
  ): { surface: BRepNURBSSurface; data: NURBSSurfaceData } {
    if (!baseSurface) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Offset requires a base surface.');
    }

    if (distance === 0) {
      return { 
        surface: baseSurface, 
        data: NURBSEngine.toNURBSSurfaceData(baseSurface, `OFFSET_0_${Math.random().toString(36).substring(2, 8)}`) 
      };
    }

    const controlNet = baseSurface.controlPoints;
    const newControlNet: BRepPoint[][] = [];

    // Simple offset: Move control points along approximate normals
    // A better implementation would compute normals at each (u,v) point in the control net
    for (let i = 0; i < controlNet.length; i++) {
      const row: BRepPoint[] = [];
      for (let j = 0; j < controlNet[i].length; j++) {
        const pt = controlNet[i][j];
        
        // Estimate normal at this control point using neighbors
        const n = this.estimateNormal(controlNet, i, j);
        
        row.push(new BRepPoint(
          pt.x + n.x * distance,
          pt.y + n.y * distance,
          pt.z + n.z * distance
        ));
      }
      newControlNet.push(row);
    }

    const surface = new BRepNURBSSurface(
      baseSurface.degreeU,
      baseSurface.degreeV,
      [...baseSurface.knotsU],
      [...baseSurface.knotsV],
      newControlNet,
      baseSurface.weights ? [...baseSurface.weights.map(r => [...r])] : undefined
    );

    const data = NURBSEngine.toNURBSSurfaceData(surface, `OFFSET_${distance.toFixed(2)}_${Math.random().toString(36).substring(2, 8)}`);

    return { surface, data };
  }

  private static estimateNormal(net: BRepPoint[][], i: number, j: number): Vector {
    const ni = net.length;
    const nj = net[0].length;

    const p = net[i][j];
    const pu = i < ni - 1 ? net[i+1][j] : net[i-1][j];
    const pv = j < nj - 1 ? net[i][j+1] : net[i][j-1];

    const vu = { x: pu.x - p.x, y: pu.y - p.y, z: pu.z - p.z };
    const vv = { x: pv.x - p.x, y: pv.y - p.y, z: pv.z - p.z };

    // If we're at the edge, swap signs to keep normal direction consistent
    const sign = (i < ni - 1 && j < nj - 1) ? 1 : -1;

    const normal = {
      x: sign * (vu.y * vv.z - vu.z * vv.y),
      y: sign * (vu.z * vv.x - vu.x * vv.z),
      z: sign * (vu.x * vv.y - vu.y * vv.x)
    };

    const mag = Math.sqrt(normal.x**2 + normal.y**2 + normal.z**2);
    if (mag < 1e-9) return { x: 0, y: 0, z: 1 }; // Default fallback

    return { x: normal.x / mag, y: normal.y / mag, z: normal.z / mag };
  }
}
