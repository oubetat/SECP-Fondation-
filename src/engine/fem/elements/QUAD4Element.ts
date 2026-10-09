import { Matrix } from '../core/MathUtils';

export class QUAD4Element {
  public static computeStiffness(
    id: string,
    coords: number[][],
    material: any
  ): { Ke: Matrix; stiffnessMatrix: Matrix } {
    const E = material.E ?? 200e9;
    if (E <= 0) throw new Error("Invalid Young's Modulus E");
    const nu = material.nu ?? 0.3;
    const t = material.thickness ?? 1.0;

    // Plane stress D matrix (3x3)
    const factor = E / (1 - nu * nu);
    const D = [
      [factor, factor * nu, 0],
      [factor * nu, factor, 0],
      [0, 0, factor * (1 - nu) / 2]
    ];

    const Ke = Array.from({ length: 8 }, () => new Array(8).fill(0));

    // Gauss integration points and weights (2x2)
    const g = 1 / Math.sqrt(3);
    const gaussPts = [
      { xi: -g, eta: -g, w: 1 },
      { xi:  g, eta: -g, w: 1 },
      { xi:  g, eta:  g, w: 1 },
      { xi: -g, eta:  g, w: 1 }
    ];

    const xi_i = [-1, 1, 1, -1];
    const eta_i = [-1, -1, 1, 1];

    for (const pt of gaussPts) {
      const xi = pt.xi;
      const eta = pt.eta;

      // dN_dxi and dN_deta
      const dN_dxi = new Array(4);
      const dN_deta = new Array(4);

      for (let i = 0; i < 4; i++) {
        dN_dxi[i] = 0.25 * xi_i[i] * (1 + eta_i[i] * eta);
        dN_deta[i] = 0.25 * eta_i[i] * (1 + xi_i[i] * xi);
      }

      // Compute Jacobian J (2x2)
      let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
      for (let i = 0; i < 4; i++) {
        const x = coords[i][0];
        const y = coords[i][1];
        j11 += dN_dxi[i] * x;
        j12 += dN_dxi[i] * y;
        j21 += dN_deta[i] * x;
        j22 += dN_deta[i] * y;
      }

      const detJ = j11 * j22 - j12 * j21;
      if (detJ <= 1e-12) throw new Error("Invalid QUAD4 Jacobian determinant");

      const invJ11 = j22 / detJ;
      const invJ12 = -j12 / detJ;
      const invJ21 = -j21 / detJ;
      const invJ22 = j11 / detJ;

      // Compute dN/dx, dN/dy
      const dN_dx = new Array(4);
      const dN_dy = new Array(4);
      for (let i = 0; i < 4; i++) {
        dN_dx[i] = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i];
        dN_dy[i] = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i];
      }

      // Build B matrix (3x8)
      const B = Array.from({ length: 3 }, () => new Array(8).fill(0));
      for (let i = 0; i < 4; i++) {
        const c = i * 2;
        B[0][c]     = dN_dx[i];
        B[1][c + 1] = dN_dy[i];
        B[2][c]     = dN_dy[i];
        B[2][c + 1] = dN_dx[i];
      }

      // DB = D * B (3x8)
      const DB = Array.from({ length: 3 }, () => new Array(8).fill(0));
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) {
            sum += D[r][k] * B[k][c];
          }
          DB[r][c] = sum;
        }
      }

      // Ke += B^T * DB * detJ * w * t
      const weightFactor = detJ * pt.w * t;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          let bt_db = 0;
          for (let k = 0; k < 3; k++) {
            bt_db += B[k][r] * DB[k][c];
          }
          Ke[r][c] += bt_db * weightFactor;
        }
      }
    }

    const mat = new Matrix(8, 8, Ke);
    return {
      Ke: mat,
      stiffnessMatrix: mat
    };
  }

  public static computeStrainStress(
    coords: number[][],
    u_e: number[],
    material: any
  ): { strain: number[]; stress: number[]; vonMisesStress: number } {
    const E = material?.E ?? 200e9;
    const nu = material?.nu ?? 0.3;

    // Evaluate strain at center (xi=0, eta=0)
    const xi_i = [-1, 1, 1, -1];
    const eta_i = [-1, -1, 1, 1];

    const dN_dxi = xi_i.map(xi => 0.25 * xi);
    const dN_deta = eta_i.map(eta => 0.25 * eta);

    let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
    for (let i = 0; i < 4; i++) {
      const x = coords[i][0];
      const y = coords[i][1];
      j11 += dN_dxi[i] * x;
      j12 += dN_dxi[i] * y;
      j21 += dN_deta[i] * x;
      j22 += dN_deta[i] * y;
    }

    const detJ = j11 * j22 - j12 * j21;
    const invJ11 = detJ > 1e-15 ? j22 / detJ : 1;
    const invJ12 = detJ > 1e-15 ? -j12 / detJ : 0;
    const invJ21 = detJ > 1e-15 ? -j21 / detJ : 0;
    const invJ22 = detJ > 1e-15 ? j11 / detJ : 1;

    let exx = 0, eyy = 0, gxy = 0;
    for (let i = 0; i < 4; i++) {
      const dN_dx = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i];
      const dN_dy = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i];

      const ux = u_e[i * 2] ?? 0;
      const uy = u_e[i * 2 + 1] ?? 0;

      exx += dN_dx * ux;
      eyy += dN_dy * uy;
      gxy += dN_dy * ux + dN_dx * uy;
    }

    const factor = E / (1 - nu * nu);
    const sxx = factor * (exx + nu * eyy);
    const syy = factor * (nu * exx + eyy);
    const sxy = (E / (2 * (1 + nu))) * gxy;

    const vm = Math.sqrt(sxx * sxx - sxx * syy + syy * syy + 3 * sxy * sxy);

    return {
      strain: [exx, eyy, gxy],
      stress: [sxx, syy, sxy],
      vonMisesStress: vm
    };
  }
}
