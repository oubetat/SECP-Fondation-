import { Matrix } from "../core/MathUtils";

export interface JacobianResult {
  matrix: Matrix;
  det: number;
  inverse: Matrix;
  isValid: boolean;
}

export class JacobianEngine {
  /**
   * 1D Jacobian: J = dx/dxi
   */
  static compute1D(dN_dxi: number[], coords: number[][]): JacobianResult {
    let dx_dxi = 0;
    for (let i = 0; i < dN_dxi.length; i++) {
      dx_dxi += dN_dxi[i] * coords[i][0];
    }
    const det = dx_dxi;
    const isValid = det > 1e-14;
    const matrix = new Matrix(1, 1, [[dx_dxi]]);
    const inverse = isValid ? new Matrix(1, 1, [[1 / dx_dxi]]) : Matrix.zeros(1, 1);
    return { matrix, det, inverse, isValid };
  }

  /**
   * 2D Jacobian:
   * J = [ [dx/dxi,  dy/dxi ],
   *       [dx/deta, dy/deta] ]
   */
  static compute2D(dN_dxi: number[], dN_deta: number[], coords: number[][]): JacobianResult {
    let dx_dxi = 0, dy_dxi = 0;
    let dx_deta = 0, dy_deta = 0;

    for (let i = 0; i < coords.length; i++) {
      const x = coords[i][0];
      const y = coords[i][1];
      dx_dxi  += dN_dxi[i] * x;
      dy_dxi  += dN_dxi[i] * y;
      dx_deta += dN_deta[i] * x;
      dy_deta += dN_deta[i] * y;
    }

    const det = dx_dxi * dy_deta - dy_dxi * dx_deta;
    const isValid = det > 1e-14;
    const matrix = new Matrix(2, 2, [
      [dx_dxi, dy_dxi],
      [dx_deta, dy_deta]
    ]);

    let inverse: Matrix;
    if (isValid) {
      const invDet = 1 / det;
      inverse = new Matrix(2, 2, [
        [ dy_deta * invDet, -dy_dxi * invDet],
        [-dx_deta * invDet,  dx_dxi * invDet]
      ]);
    } else {
      inverse = Matrix.zeros(2, 2);
    }

    return { matrix, det, inverse, isValid };
  }

  /**
   * 3D Jacobian:
   * J = [ [dx/dxi,   dy/dxi,   dz/dxi  ],
   *       [dx/deta,  dy/deta,  dz/deta ],
   *       [dx/dzeta, dy/dzeta, dz/dzeta] ]
   */
  static compute3D(dN_dxi: number[], dN_deta: number[], dN_dzeta: number[], coords: number[][]): JacobianResult {
    let dx_dxi = 0, dy_dxi = 0, dz_dxi = 0;
    let dx_deta = 0, dy_deta = 0, dz_deta = 0;
    let dx_dzeta = 0, dy_dzeta = 0, dz_dzeta = 0;

    for (let i = 0; i < coords.length; i++) {
      const x = coords[i][0];
      const y = coords[i][1];
      const z = coords[i][2];

      dx_dxi += dN_dxi[i] * x;
      dy_dxi += dN_dxi[i] * y;
      dz_dxi += dN_dxi[i] * z;

      dx_deta += dN_deta[i] * x;
      dy_deta += dN_deta[i] * y;
      dz_deta += dN_deta[i] * z;

      dx_dzeta += dN_dzeta[i] * x;
      dy_dzeta += dN_dzeta[i] * y;
      dz_dzeta += dN_dzeta[i] * z;
    }

    const matrix = new Matrix(3, 3, [
      [dx_dxi,   dy_dxi,   dz_dxi],
      [dx_deta,  dy_deta,  dz_deta],
      [dx_dzeta, dy_dzeta, dz_dzeta]
    ]);

    const det = matrix.determinant();
    const isValid = det > 1e-14;
    let inverse: Matrix;
    if (isValid) {
      inverse = matrix.inverse();
    } else {
      inverse = Matrix.zeros(3, 3);
    }

    return { matrix, det, inverse, isValid };
  }

  /**
   * Compute spatial derivatives dN/dx, dN/dy, dN/dz using J^-1 * dN/d_natural
   */
  static computeSpatialDerivatives2D(dN_dxi: number[], dN_deta: number[], J_inv: Matrix): { dN_dx: number[]; dN_dy: number[] } {
    const count = dN_dxi.length;
    const dN_dx = new Array(count).fill(0);
    const dN_dy = new Array(count).fill(0);

    for (let i = 0; i < count; i++) {
      // [dN/dx, dN/dy]^T = J^-1 * [dN/dxi, dN/deta]^T
      dN_dx[i] = J_inv.get(0, 0) * dN_dxi[i] + J_inv.get(0, 1) * dN_deta[i];
      dN_dy[i] = J_inv.get(1, 0) * dN_dxi[i] + J_inv.get(1, 1) * dN_deta[i];
    }
    return { dN_dx, dN_dy };
  }

  static computeSpatialDerivatives3D(dN_dxi: number[], dN_deta: number[], dN_dzeta: number[], J_inv: Matrix): { dN_dx: number[]; dN_dy: number[]; dN_dz: number[] } {
    const count = dN_dxi.length;
    const dN_dx = new Array(count).fill(0);
    const dN_dy = new Array(count).fill(0);
    const dN_dz = new Array(count).fill(0);

    for (let i = 0; i < count; i++) {
      // [dN/dx, dN/dy, dN/dz]^T = J^-1 * [dN/dxi, dN/deta, dN/dzeta]^T
      dN_dx[i] = J_inv.get(0, 0) * dN_dxi[i] + J_inv.get(0, 1) * dN_deta[i] + J_inv.get(0, 2) * dN_dzeta[i];
      dN_dy[i] = J_inv.get(1, 0) * dN_dxi[i] + J_inv.get(1, 1) * dN_deta[i] + J_inv.get(1, 2) * dN_dzeta[i];
      dN_dz[i] = J_inv.get(2, 0) * dN_dxi[i] + J_inv.get(2, 1) * dN_deta[i] + J_inv.get(2, 2) * dN_dzeta[i];
    }
    return { dN_dx, dN_dy, dN_dz };
  }
}
