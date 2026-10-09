import { HomogeneousTransform, Vector3D } from "./types";

export class KinematicMath {
  public static readonly EPSILON = 1e-6;

  /**
   * Creates an identity matrix of 4x4
   */
  public static createIdentity(): HomogeneousTransform {
    return {
      matrix: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Computes the magnitude of a 3D vector.
   */
  public static magnitude(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * Normalizes a 3D vector.
   */
  public static normalize(v: Vector3D): Vector3D {
    const mag = this.magnitude(v);
    if (mag < this.EPSILON) {
      return { x: 0, y: 0, z: 0 };
    }
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }

  /**
   * Creates a homogeneous translation transform.
   */
  public static createTranslation(x: number, y: number, z: number): HomogeneousTransform {
    return {
      matrix: [
        [1, 0, 0, x],
        [0, 1, 0, y],
        [0, 0, 1, z],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Creates a rotation transform around X axis.
   */
  public static createRotationX(rad: number): HomogeneousTransform {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return {
      matrix: [
        [1, 0, 0, 0],
        [0, c, -s, 0],
        [0, s, c, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Creates a rotation transform around Y axis.
   */
  public static createRotationY(rad: number): HomogeneousTransform {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return {
      matrix: [
        [c, 0, s, 0],
        [0, 1, 0, 0],
        [-s, 0, c, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Creates a rotation transform around Z axis.
   */
  public static createRotationZ(rad: number): HomogeneousTransform {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return {
      matrix: [
        [c, -s, 0, 0],
        [s, c, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Computes matrix multiplication of two homogeneous transforms: T_AC = T_AB * T_BC.
   */
  public static multiply(A: HomogeneousTransform, B: HomogeneousTransform): HomogeneousTransform {
    const a = A.matrix;
    const b = B.matrix;
    const res: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 1]
    ];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        res[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c] + a[r][3] * b[3][c];
      }
    }

    return { matrix: res };
  }

  /**
   * Computes the inverse of a rigid body homogeneous transform.
   * Utilizes the fast inverse formulation for SE(3):
   * [R t; 0 1]^-1 = [R^T -R^T*t; 0 1]
   */
  public static invert(T: HomogeneousTransform): HomogeneousTransform {
    const m = T.matrix;
    // Extract rotation transposing it (orthogonal inverse)
    const R_T = [
      [m[0][0], m[1][0], m[2][0]],
      [m[0][1], m[1][1], m[2][1]],
      [m[0][2], m[1][2], m[2][2]]
    ];

    // Extract translation
    const t = [m[0][3], m[1][3], m[2][3]];

    // Compute -R^T * t
    const inv_t = [
      -(R_T[0][0] * t[0] + R_T[0][1] * t[1] + R_T[0][2] * t[2]),
      -(R_T[1][0] * t[0] + R_T[1][1] * t[1] + R_T[1][2] * t[2]),
      -(R_T[2][0] * t[0] + R_T[2][1] * t[1] + R_T[2][2] * t[2])
    ];

    return {
      matrix: [
        [R_T[0][0], R_T[0][1], R_T[0][2], inv_t[0]],
        [R_T[1][0], R_T[1][1], R_T[1][2], inv_t[1]],
        [R_T[2][0], R_T[2][1], R_T[2][2], inv_t[2]],
        [0, 0, 0, 1]
      ]
    };
  }

  /**
   * Computes the determinant of the 3x3 rotation block.
   */
  public static determinant3x3(T: HomogeneousTransform): number {
    const m = T.matrix;
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }

  /**
   * Validates if the 3x3 rotation block is orthogonal and preserves scale (det = 1).
   */
  public static validateRotation(T: HomogeneousTransform, tol: number = 0.005): boolean {
    const m = T.matrix;
    
    // Check determinant
    const det = this.determinant3x3(T);
    if (Math.abs(det - 1.0) > tol) {
      return false;
    }

    // Check R_T * R ≈ I
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += m[k][i] * m[k][j]; // transposing index i
        }
        const expected = i === j ? 1.0 : 0.0;
        if (Math.abs(sum - expected) > tol) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Transforms a 3D vector.
   */
  public static transformVector(T: HomogeneousTransform, v: Vector3D): Vector3D {
    const m = T.matrix;
    return {
      x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z + m[0][3],
      y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z + m[1][3],
      z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z + m[2][3]
    };
  }
}
