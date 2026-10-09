/**
 * SECP Industrial OS v3 — PATCH-180: Assembly Math & Spatial Bounding Utilities
 * High-performance matrix transforms, AABB arithmetic, raycasting, and frustum extraction.
 */

import { Vector3D } from '../../cadKernel';
import { 
  Matrix4x4, 
  BoundingBox3D, 
  BoundingSphere3D, 
  CameraFrustum, 
  Plane3D, 
  Ray3D 
} from './MassiveAssemblyTypes';

export class AssemblyMath {
  public static createIdentityMatrix(): Matrix4x4 {
    const el = new Float32Array(16);
    el[0] = 1; el[5] = 1; el[10] = 1; el[15] = 1;
    return { elements: el };
  }

  public static createTranslationMatrix(x: number, y: number, z: number): Matrix4x4 {
    const el = new Float32Array(16);
    el[0] = 1; el[5] = 1; el[10] = 1; el[15] = 1;
    el[12] = x; el[13] = y; el[14] = z;
    return { elements: el };
  }

  public static createTRSMatrix(
    pos: Vector3D,
    rotDeg: Vector3D,
    scale: Vector3D = { x: 1, y: 1, z: 1 }
  ): Matrix4x4 {
    const rx = (rotDeg.x * Math.PI) / 180;
    const ry = (rotDeg.y * Math.PI) / 180;
    const rz = (rotDeg.z * Math.PI) / 180;

    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    const el = new Float32Array(16);

    // Rotation Euler ZYX * Scale
    el[0] = (cy * cz) * scale.x;
    el[1] = (cy * sz) * scale.x;
    el[2] = (-sy) * scale.x;
    el[3] = 0;

    el[4] = (sx * sy * cz - cx * sz) * scale.y;
    el[5] = (sx * sy * sz + cx * cz) * scale.y;
    el[6] = (sx * cy) * scale.y;
    el[7] = 0;

    el[8] = (cx * sy * cz + sx * sz) * scale.z;
    el[9] = (cx * sy * sz - sx * cz) * scale.z;
    el[10] = (cx * cy) * scale.z;
    el[11] = 0;

    el[12] = pos.x;
    el[13] = pos.y;
    el[14] = pos.z;
    el[15] = 1;

    return { elements: el };
  }

  public static multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
    const ae = a.elements;
    const be = b.elements;
    const out = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      const a0 = ae[i], a1 = ae[i + 4], a2 = ae[i + 8], a3 = ae[i + 12];
      out[i] = a0 * be[0] + a1 * be[1] + a2 * be[2] + a3 * be[3];
      out[i + 4] = a0 * be[4] + a1 * be[5] + a2 * be[6] + a3 * be[7];
      out[i + 8] = a0 * be[8] + a1 * be[9] + a2 * be[10] + a3 * be[11];
      out[i + 12] = a0 * be[12] + a1 * be[13] + a2 * be[14] + a3 * be[15];
    }

    return { elements: out };
  }

  public static transformPoint(mat: Matrix4x4, p: Vector3D): Vector3D {
    const e = mat.elements;
    const x = p.x, y = p.y, z = p.z;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1.0;
    return {
      x: (e[0] * x + e[4] * y + e[8] * z + e[12]) / w,
      y: (e[1] * x + e[5] * y + e[9] * z + e[13]) / w,
      z: (e[2] * x + e[6] * y + e[10] * z + e[14]) / w,
    };
  }

  public static createAABB(min: Vector3D, max: Vector3D): BoundingBox3D {
    const center = {
      x: (min.x + max.x) * 0.5,
      y: (min.y + max.y) * 0.5,
      z: (min.z + max.z) * 0.5
    };
    const extents = {
      x: Math.abs(max.x - min.x) * 0.5,
      y: Math.abs(max.y - min.y) * 0.5,
      z: Math.abs(max.z - min.z) * 0.5
    };
    return { min, max, center, extents };
  }

  public static transformAABB(box: BoundingBox3D, mat: Matrix4x4): BoundingBox3D {
    const e = mat.elements;
    const center = box.center;
    const extents = box.extents;

    // Transform center
    const newCenterX = e[0] * center.x + e[4] * center.y + e[8] * center.z + e[12];
    const newCenterY = e[1] * center.x + e[5] * center.y + e[9] * center.z + e[13];
    const newCenterZ = e[2] * center.x + e[6] * center.y + e[10] * center.z + e[14];

    // Compute new extents by summing absolute value projections
    const newExtentX = Math.abs(e[0]) * extents.x + Math.abs(e[4]) * extents.y + Math.abs(e[8]) * extents.z;
    const newExtentY = Math.abs(e[1]) * extents.x + Math.abs(e[5]) * extents.y + Math.abs(e[9]) * extents.z;
    const newExtentZ = Math.abs(e[2]) * extents.x + Math.abs(e[6]) * extents.y + Math.abs(e[10]) * extents.z;

    const min: Vector3D = {
      x: newCenterX - newExtentX,
      y: newCenterY - newExtentY,
      z: newCenterZ - newExtentZ
    };
    const max: Vector3D = {
      x: newCenterX + newExtentX,
      y: newCenterY + newExtentY,
      z: newCenterZ + newExtentZ
    };

    return {
      min,
      max,
      center: { x: newCenterX, y: newCenterY, z: newCenterZ },
      extents: { x: newExtentX, y: newExtentY, z: newExtentZ }
    };
  }

  public static unionAABB(a: BoundingBox3D, b: BoundingBox3D): BoundingBox3D {
    const min: Vector3D = {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z)
    };
    const max: Vector3D = {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z)
    };
    return this.createAABB(min, max);
  }

  public static aabbToSphere(box: BoundingBox3D): BoundingSphere3D {
    const radius = Math.hypot(box.extents.x, box.extents.y, box.extents.z);
    return {
      center: { ...box.center },
      radius
    };
  }

  /**
   * Fast Frustum vs AABB intersection test
   * Returns: true if box is inside or intersects frustum, false if completely outside
   */
  public static testAABBFrustum(box: BoundingBox3D, frustum: CameraFrustum): boolean {
    const planes = [
      frustum.planes.near,
      frustum.planes.far,
      frustum.planes.left,
      frustum.planes.right,
      frustum.planes.top,
      frustum.planes.bottom
    ];

    const c = box.center;
    const e = box.extents;

    for (let i = 0; i < 6; i++) {
      const p = planes[i];
      // Compute projected radius along plane normal
      const r = e.x * Math.abs(p.normal.x) + e.y * Math.abs(p.normal.y) + e.z * Math.abs(p.normal.z);
      // Distance from box center to plane
      const dist = p.normal.x * c.x + p.normal.y * c.y + p.normal.z * c.z + p.distance;

      if (dist < -r) {
        // Completely outside this plane
        return false;
      }
    }

    return true;
  }

  /**
   * Fast Ray vs AABB intersection test using slab method
   */
  public static raycastAABB(ray: Ray3D, box: BoundingBox3D): { hit: boolean; distance: number } {
    let tmin = (box.min.x - ray.origin.x) / (ray.direction.x || 1e-9);
    let tmax = (box.max.x - ray.origin.x) / (ray.direction.x || 1e-9);

    if (tmin > tmax) { const temp = tmin; tmin = tmax; tmax = temp; }

    let tymin = (box.min.y - ray.origin.y) / (ray.direction.y || 1e-9);
    let tymax = (box.max.y - ray.origin.y) / (ray.direction.y || 1e-9);

    if (tymin > tymax) { const temp = tymin; tymin = tymax; tymax = temp; }

    if (tmin > tymax || tymin > tmax) return { hit: false, distance: Infinity };

    if (tymin > tmin) tmin = tymin;
    if (tymax < tmax) tmax = tymax;

    let tzmin = (box.min.z - ray.origin.z) / (ray.direction.z || 1e-9);
    let tzmax = (box.max.z - ray.origin.z) / (ray.direction.z || 1e-9);

    if (tzmin > tzmax) { const temp = tzmin; tzmin = tzmax; tzmax = temp; }

    if (tmin > tzmax || tzmin > tmax) return { hit: false, distance: Infinity };

    if (tzmin > tmin) tmin = tzmin;
    if (tzmax < tmax) tmax = tzmax;

    if (tmax < 0) return { hit: false, distance: Infinity };

    return { hit: true, distance: tmin > 0 ? tmin : tmax };
  }

  /**
   * Extracts 6 frustum planes from a typical camera setup
   */
  public static computeFrustum(
    cameraPos: Vector3D,
    target: Vector3D,
    fovDeg: number,
    aspect: number,
    near: number,
    far: number,
    viewportHeightPx: number = 800
  ): CameraFrustum {
    const fovRad = (fovDeg * Math.PI) / 180;
    const fwd = this.normalize({
      x: target.x - cameraPos.x,
      y: target.y - cameraPos.y,
      z: target.z - cameraPos.z
    });

    const up = { x: 0, y: 0, z: 1 };
    const right = this.normalize(this.cross(fwd, up));
    const realUp = this.cross(right, fwd);

    const halfVSide = far * Math.tan(fovRad * 0.5);
    const halfHSide = halfVSide * aspect;
    const fwdFar = { x: fwd.x * far, y: fwd.y * far, z: fwd.z * far };

    // 6 Planes definition
    const nearPlane: Plane3D = {
      normal: fwd,
      distance: -(fwd.x * (cameraPos.x + fwd.x * near) + fwd.y * (cameraPos.y + fwd.y * near) + fwd.z * (cameraPos.z + fwd.z * near))
    };

    const farPlane: Plane3D = {
      normal: { x: -fwd.x, y: -fwd.y, z: -fwd.z },
      distance: (fwd.x * (cameraPos.x + fwdFar.x) + fwd.y * (cameraPos.y + fwdFar.y) + fwd.z * (cameraPos.z + fwdFar.z))
    };

    // Approximate lateral planes
    const leftNormal = this.normalize({
      x: right.x * far - fwd.x * halfHSide,
      y: right.y * far - fwd.y * halfHSide,
      z: right.z * far - fwd.z * halfHSide
    });
    const leftPlane: Plane3D = {
      normal: leftNormal,
      distance: -(leftNormal.x * cameraPos.x + leftNormal.y * cameraPos.y + leftNormal.z * cameraPos.z)
    };

    const rightNormal = this.normalize({
      x: -right.x * far - fwd.x * halfHSide,
      y: -right.y * far - fwd.y * halfHSide,
      z: -right.z * far - fwd.z * halfHSide
    });
    const rightPlane: Plane3D = {
      normal: rightNormal,
      distance: -(rightNormal.x * cameraPos.x + rightNormal.y * cameraPos.y + rightNormal.z * cameraPos.z)
    };

    const topNormal = this.normalize({
      x: -realUp.x * far - fwd.x * halfVSide,
      y: -realUp.y * far - fwd.y * halfVSide,
      z: -realUp.z * far - fwd.z * halfVSide
    });
    const topPlane: Plane3D = {
      normal: topNormal,
      distance: -(topNormal.x * cameraPos.x + topNormal.y * cameraPos.y + topNormal.z * cameraPos.z)
    };

    const bottomNormal = this.normalize({
      x: realUp.x * far - fwd.x * halfVSide,
      y: realUp.y * far - fwd.y * halfVSide,
      z: realUp.z * far - fwd.z * halfVSide
    });
    const bottomPlane: Plane3D = {
      normal: bottomNormal,
      distance: -(bottomNormal.x * cameraPos.x + bottomNormal.y * cameraPos.y + bottomNormal.z * cameraPos.z)
    };

    return {
      planes: {
        near: nearPlane,
        far: farPlane,
        left: leftPlane,
        right: rightPlane,
        top: topPlane,
        bottom: bottomPlane
      },
      position: cameraPos,
      target,
      fovDeg,
      aspect,
      near,
      far,
      viewportHeightPx
    };
  }

  private static normalize(v: Vector3D): Vector3D {
    const m = Math.hypot(v.x, v.y, v.z) || 1.0;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  }

  private static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
}
