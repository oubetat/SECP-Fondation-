/**
 * SECP Industrial OS v2 — CFD Diagnostics
 * Force Integration for Airfoils
 */

import { FvmMesh3D, Vector3D } from '../Fvm3DTypes';

export interface ForceResult {
  lift: number;
  drag: number;
  cl: number;
  cd: number;
  pressureForces: Vector3D;
  viscousForces: Vector3D;
}

export class ForceIntegration {
  public static calculate(
    mesh: FvmMesh3D,
    pressure: number[],
    velocity: Vector3D[],
    mu: number,
    muT: number[],
    aoaDeg: number,
    rho: number,
    Uinf: number,
    chord: number,
    span: number
  ): ForceResult {
    let fx_p = 0;
    let fy_p = 0;
    let fx_v = 0;
    let fy_v = 0;

    const alpha = (aoaDeg * Math.PI) / 180.0;

    for (const face of mesh.faces) {
      if (face.boundaryType === 'WALL') {
        const owner = face.ownerCellId;
        
        // 1. Pressure Force
        const p = pressure[owner];
        fx_p += -p * face.normal.x * face.area;
        fy_p += -p * face.normal.y * face.area;

        // 2. Viscous Force (Simplified Wall Shear Stress)
        // tau = (mu + muT) * du/dn
        const dist = Math.sqrt(
          Math.pow(face.centroid.x - mesh.cells[owner].centroid.x, 2) +
          Math.pow(face.centroid.y - mesh.cells[owner].centroid.y, 2)
        );
        
        const u_wall = { x: 0, y: 0, z: 0 };
        const du_dn = {
          x: (velocity[owner].x - u_wall.x) / dist,
          y: (velocity[owner].y - u_wall.y) / dist
        };

        const muEff = mu + muT[owner];
        fx_v += muEff * du_dn.x * face.area;
        fy_v += muEff * du_dn.y * face.area;
      }
    }

    const totalFx = fx_p + fx_v;
    const totalFy = fy_p + fy_v;

    // Transform to Lift/Drag axes
    const lift = totalFy * Math.cos(alpha) - totalFx * Math.sin(alpha);
    const drag = totalFy * Math.sin(alpha) + totalFx * Math.cos(alpha);

    const q = 0.5 * rho * Uinf * Uinf * chord * span;
    const cl = lift / q;
    const cd = drag / q;

    return {
      lift,
      drag,
      cl,
      cd,
      pressureForces: { x: fx_p, y: fy_p, z: 0 },
      viscousForces: { x: fx_v, y: fy_v, z: 0 }
    };
  }
}
