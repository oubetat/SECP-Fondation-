/**
 * SECP-260 — Stock Coordinate Transform Engine
 * Provides deterministic 4x4 matrix transformations between:
 * - CAD Coordinates (Part Model Datum)
 * - CAM Work Coordinate System (WCS G54/G55)
 * - Machine Coordinates (MCS)
 * - Stock Coordinates (Raw Stock Origin)
 */

import { Vector3D, vec3, StockCoordinateSystem } from './StockTypes';

export class StockCoordinateTransform {
  /**
   * Creates an identity 4x4 transform matrix
   */
  public static identity(): number[][] {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Multiplies two 4x4 matrices
   */
  public static multiplyMatrices(a: number[][], b: number[][]): number[][] {
    const result: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 1]
    ];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[r][k] * b[k][c];
        }
        result[r][c] = sum;
      }
    }
    return result;
  }

  /**
   * Inverts a standard rigid 4x4 transformation matrix [R | T]
   */
  public static invertRigid(m: number[][]): number[][] {
    const inv: number[][] = [
      [m[0][0], m[1][0], m[2][0], 0],
      [m[0][1], m[1][1], m[2][1], 0],
      [m[0][2], m[1][2], m[2][2], 0],
      [0, 0, 0, 1]
    ];

    const tx = m[0][3];
    const ty = m[1][3];
    const tz = m[2][3];

    inv[0][3] = -(inv[0][0] * tx + inv[0][1] * ty + inv[0][2] * tz);
    inv[1][3] = -(inv[1][0] * tx + inv[1][1] * ty + inv[1][2] * tz);
    inv[2][3] = -(inv[2][0] * tx + inv[2][1] * ty + inv[2][2] * tz);

    return inv;
  }

  /**
   * Transforms a 3D point using a 4x4 matrix
   */
  public static transformPoint(p: Vector3D, m: number[][]): Vector3D {
    const x = p.x * m[0][0] + p.y * m[0][1] + p.z * m[0][2] + m[0][3];
    const y = p.x * m[1][0] + p.y * m[1][1] + p.z * m[1][2] + m[1][3];
    const z = p.x * m[2][0] + p.y * m[2][1] + p.z * m[2][2] + m[2][3];
    return vec3(x, y, z);
  }

  /**
   * Transforms a 3D vector (direction, without translation)
   */
  public static transformVector(v: Vector3D, m: number[][]): Vector3D {
    const x = v.x * m[0][0] + v.y * m[0][1] + v.z * m[0][2];
    const y = v.x * m[1][0] + v.y * m[1][1] + v.z * m[1][2];
    const z = v.x * m[2][0] + v.y * m[2][1] + v.z * m[2][2];
    const len = Math.hypot(x, y, z);
    if (len < 1e-9) return vec3(0, 0, 1);
    return vec3(x / len, y / len, z / len);
  }

  /**
   * Builds coordinate system from Origin and orthogonal Axes
   */
  public static createCoordinateSystem(origin: Vector3D, xAxis: Vector3D, yAxis: Vector3D, zAxis: Vector3D): StockCoordinateSystem {
    const matrix: number[][] = [
      [xAxis.x, yAxis.x, zAxis.x, origin.x],
      [xAxis.y, yAxis.y, zAxis.y, origin.y],
      [xAxis.z, yAxis.z, zAxis.z, origin.z],
      [0, 0, 0, 1]
    ];

    return {
      origin,
      xAxis,
      yAxis,
      zAxis,
      matrix4x4: matrix
    };
  }

  /**
   * Creates a transformation from Stock Frame to Work Coordinate System (WCS)
   */
  public static stockToWcs(pointInStock: Vector3D, stockCoord: StockCoordinateSystem): Vector3D {
    return this.transformPoint(pointInStock, stockCoord.matrix4x4);
  }

  /**
   * Creates a transformation from Work Coordinate System (WCS) to Stock Frame
   */
  public static wcsToStock(pointInWcs: Vector3D, stockCoord: StockCoordinateSystem): Vector3D {
    const inv = this.invertRigid(stockCoord.matrix4x4);
    return this.transformPoint(pointInWcs, inv);
  }
}
