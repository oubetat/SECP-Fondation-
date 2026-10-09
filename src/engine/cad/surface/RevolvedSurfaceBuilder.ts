/**
 * SECP CAD Kernel — Revolved Surface Construction Engine
 */

import { Point, Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepRevolvedSurface, BRepLine, BRepPoint, BRepVector, BRepNURBSSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import { SurfaceConstructionError } from './BoundaryLoftSweepTypes';

export class RevolvedSurfaceBuilder {
  /**
   * Constructs a Revolved Surface from a profile and an axis.
   */
  public static buildRevolvedSurface(
    profile: Curve,
    axisOrigin: Point,
    axisDir: { x: number; y: number; z: number },
    angleDeg: number = 360
  ): { surface: BRepRevolvedSurface | BRepNURBSSurface; data: NURBSSurfaceData } {
    if (!profile) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Revolve requires a profile curve.');
    }

    const axis = new BRepLine(
      new BRepPoint(axisOrigin.x, axisOrigin.y, axisOrigin.z),
      new BRepVector(axisDir.x, axisDir.y, axisDir.z)
    );
    
    const angleRad = (angleDeg * Math.PI) / 180;
    const surface = new BRepRevolvedSurface(profile, axis, angleRad);

    // Generate NURBS for rendering
    // Revolve logic: samples along profile, then rotates them
    const numU = 10; // Samples along profile
    const numV = 8;  // Samples around rotation
    const controlNet: BRepPoint[][] = [];

    const dom = profile.domain();
    for (let i = 0; i < numU; i++) {
      const uFrac = i / (numU - 1);
      const pBase = profile.evaluate(dom.uMin + uFrac * (dom.uMax - dom.uMin));
      const row: BRepPoint[] = [];

      for (let j = 0; j < numV; j++) {
        const vFrac = j / (numV - 1);
        const theta = vFrac * angleRad;
        const pRot = this.rotatePointAroundAxis(pBase, axisOrigin, axisDir, theta);
        row.push(new BRepPoint(pRot.x, pRot.y, pRot.z));
      }
      controlNet.push(row);
    }

    const degU = 3;
    const degV = 3;
    const knotsU = NURBSEngine.generateUniformKnots(numU, degU);
    const knotsV = NURBSEngine.generateUniformKnots(numV, degV);

    const nurbsSurface = new BRepNURBSSurface(degU, degV, knotsU, knotsV, controlNet);
    const data = NURBSEngine.toNURBSSurfaceData(nurbsSurface, `REVOLVE_${Math.random().toString(36).substring(2, 8)}`);

    return { surface, data };
  }

  private static rotatePointAroundAxis(p: Point, origin: Point, dir: {x:number, y:number, z:number}, angle: number): Point {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const t = 1 - c;
    const {x, y, z} = dir;

    // Translation to origin
    const px = p.x - origin.x;
    const py = p.y - origin.y;
    const pz = p.z - origin.z;

    // Rotation matrix elements
    const m00 = t*x*x + c;
    const m01 = t*x*y - s*z;
    const m02 = t*x*z + s*y;
    const m10 = t*x*y + s*z;
    const m11 = t*y*y + c;
    const m12 = t*y*z - s*x;
    const m20 = t*x*z - s*y;
    const m21 = t*y*z + s*x;
    const m22 = t*z*z + c;

    return {
      x: m00*px + m01*py + m02*pz + origin.x,
      y: m10*px + m11*py + m12*pz + origin.y,
      z: m20*px + m21*py + m22*pz + origin.z
    };
  }
}
