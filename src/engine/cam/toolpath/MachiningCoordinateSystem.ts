/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Machining Coordinate System & WCS Transformations
 */

import { Vector3D, WorkCoordinateSystem } from './ToolpathTypes';

export class MachiningCoordinateSystem {
  /**
   * Transforms a 3D coordinate from CAD global space to Setup WCS local space
   */
  public static cadToWcs(pt: Vector3D, wcs: WorkCoordinateSystem): Vector3D {
    // 1. Translation
    const tx = pt.x - wcs.origin.x;
    const ty = pt.y - wcs.origin.y;
    const tz = pt.z - wcs.origin.z;

    // 2. Rotation around Z axis if defined
    if (Math.abs(wcs.rotationDegZ) > 1e-6) {
      const rad = (-wcs.rotationDegZ * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      return {
        x: tx * cosA - ty * sinA,
        y: tx * sinA + ty * cosA,
        z: tz,
      };
    }

    return { x: tx, y: ty, z: tz };
  }

  /**
   * Transforms a 3D coordinate from Setup WCS local space back to CAD global space
   */
  public static wcsToCad(pt: Vector3D, wcs: WorkCoordinateSystem): Vector3D {
    let rx = pt.x;
    let ry = pt.y;
    const rz = pt.z;

    // 1. Inverse Rotation around Z
    if (Math.abs(wcs.rotationDegZ) > 1e-6) {
      const rad = (wcs.rotationDegZ * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      rx = pt.x * cosA - pt.y * sinA;
      ry = pt.x * sinA + pt.y * cosA;
    }

    // 2. Inverse Translation
    return {
      x: rx + wcs.origin.x,
      y: ry + wcs.origin.y,
      z: rz + wcs.origin.z,
    };
  }

  /**
   * Creates a default top-machining WCS aligned with stock bounding box top-center or corner
   */
  public static createDefaultWcs(
    id: string = 'G54',
    name: string = 'Top Clamp Setup WCS',
    stockBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
    referenceLocation: 'TOP_CENTER' | 'TOP_LEFT_CORNER' | 'CAD_ORIGIN' = 'TOP_LEFT_CORNER'
  ): WorkCoordinateSystem {
    let origin: Vector3D = { x: 0, y: 0, z: 0 };

    if (referenceLocation === 'TOP_CENTER') {
      origin = {
        x: (stockBounds.minX + stockBounds.maxX) / 2,
        y: (stockBounds.minY + stockBounds.maxY) / 2,
        z: stockBounds.maxZ,
      };
    } else if (referenceLocation === 'TOP_LEFT_CORNER') {
      origin = {
        x: stockBounds.minX,
        y: stockBounds.maxY,
        z: stockBounds.maxZ,
      };
    }

    return {
      id,
      name,
      origin,
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
      rotationDegZ: 0,
    };
  }
}
