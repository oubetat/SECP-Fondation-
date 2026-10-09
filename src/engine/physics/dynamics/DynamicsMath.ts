/**
 * SECP Engineering Core — Dynamics Math
 * Coordinate transformations and vector utilities.
 */

import { Vector3 } from '../../geometry/GeometryTypes';

export class DynamicsMath {
  /**
   * Transforms a vector from Body Frame to World Frame using Euler angles (Z-Y-X convention).
   * roll (phi), pitch (theta), yaw (psi)
   */
  public static bodyToWorld(v: Vector3, orientation: Vector3): Vector3 {
    const { x: phi, y: theta, z: psi } = orientation;
    
    const s_phi = Math.sin(phi);
    const c_phi = Math.cos(phi);
    const s_the = Math.sin(theta);
    const c_the = Math.cos(theta);
    const s_psi = Math.sin(psi);
    const c_psi = Math.cos(psi);

    // Rotation Matrix R_bw
    // R_z(psi) * R_y(theta) * R_x(phi)
    const x_w = v.x * (c_psi * c_the) + 
                v.y * (c_psi * s_the * s_phi - s_psi * c_phi) + 
                v.z * (c_psi * s_the * c_phi + s_psi * s_phi);
                
    const y_w = v.x * (s_psi * c_the) + 
                v.y * (s_psi * s_the * s_phi + c_psi * c_phi) + 
                v.z * (s_psi * s_the * c_phi - c_psi * s_phi);
                
    const z_w = v.x * (-s_the) + 
                v.y * (c_the * s_phi) + 
                v.z * (c_the * c_phi);

    return { x: x_w, y: y_w, z: z_w };
  }

  /**
   * Transforms a vector from World Frame to Body Frame.
   */
  public static worldToBody(v: Vector3, orientation: Vector3): Vector3 {
    const { x: phi, y: theta, z: psi } = orientation;
    
    const s_phi = Math.sin(phi);
    const c_phi = Math.cos(phi);
    const s_the = Math.sin(theta);
    const c_the = Math.cos(theta);
    const s_psi = Math.sin(psi);
    const c_psi = Math.cos(psi);

    // Transpose of R_bw (R_wb)
    const x_b = v.x * (c_psi * c_the) + 
                v.y * (s_psi * c_the) + 
                v.z * (-s_the);
                
    const y_b = v.x * (c_psi * s_the * s_phi - s_psi * c_phi) + 
                v.y * (s_psi * s_the * s_phi + c_psi * c_phi) + 
                v.z * (c_the * s_phi);
                
    const z_b = v.x * (c_psi * s_the * c_phi + s_psi * s_phi) + 
                v.y * (s_psi * s_the * c_phi - c_psi * s_phi) + 
                v.z * (c_the * c_phi);

    return { x: x_b, y: y_b, z: z_b };
  }

  /**
   * Cross product: a x b
   */
  public static cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  /**
   * Matrix-Vector multiplication: M * v
   */
  public static matVecMul(M: number[][], v: Vector3): Vector3 {
    return {
      x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
      y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
      z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z
    };
  }

  /**
   * 3x3 Matrix inversion (simplified for dynamics)
   */
  public static invert3x3(M: number[][]): number[][] {
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
                M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
                M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    
    if (Math.abs(det) < 1e-12) throw new Error('Singular matrix');

    const invDet = 1 / det;
    const result = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    result[0][0] = (M[1][1] * M[2][2] - M[1][2] * M[2][1]) * invDet;
    result[0][1] = (M[0][2] * M[2][1] - M[0][1] * M[2][2]) * invDet;
    result[0][2] = (M[0][1] * M[1][2] - M[0][2] * M[1][1]) * invDet;
    result[1][0] = (M[1][2] * M[2][0] - M[1][0] * M[2][2]) * invDet;
    result[1][1] = (M[0][0] * M[2][2] - M[0][2] * M[2][0]) * invDet;
    result[1][2] = (M[1][0] * M[0][2] - M[0][0] * M[1][2]) * invDet;
    result[2][0] = (M[1][0] * M[2][1] - M[1][1] * M[2][0]) * invDet;
    result[2][1] = (M[2][0] * M[0][1] - M[0][0] * M[2][1]) * invDet;
    result[2][2] = (M[0][0] * M[1][1] - M[1][0] * M[0][1]) * invDet;

    return result;
  }
}
