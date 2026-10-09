import { Matrix } from '../core/MathUtils';

export class TRI3Element {
  public static computeStiffness(id: string, coords: number[][], material: any): { Ke: Matrix; stiffnessMatrix: Matrix } {
    const E = material?.E || 200e9;
    if (E <= 0) throw new Error("Invalid Young's Modulus E");
    const nu = material?.nu ?? 0.3;
    const t = material?.thickness || 0.01;

    const p1 = coords[0], p2 = coords[1], p3 = coords[2];
    const dx1 = p2[0] - p1[0], dy1 = (p2[1] ?? 0) - (p1[1] ?? 0), dz1 = (p2[2] ?? 0) - (p1[2] ?? 0);
    const dx2 = p3[0] - p1[0], dy2 = (p3[1] ?? 0) - (p1[1] ?? 0), dz2 = (p3[2] ?? 0) - (p1[2] ?? 0);

    const cx = dy1 * dz2 - dz1 * dy2;
    const cy = dz1 * dx2 - dx1 * dz2;
    const cz = dx1 * dy2 - dy1 * dx2;

    const area3D = 0.5 * Math.hypot(cx, cy, cz);
    if (area3D <= 1e-12) throw new Error("Invalid TRI3 element area");

    const doubleArea = Math.abs(cz) > 1e-12 ? cz : 2.0 * area3D;
    const area = area3D;
    const inv2A = 1.0 / doubleArea;

    const x1 = p1[0], y1 = p1[1] ?? 0;
    const x2 = p2[0], y2 = p2[1] ?? 0;
    const x3 = p3[0], y3 = p3[1] ?? 0;

    const b1 = y2 - y3, b2 = y3 - y1, b3 = y1 - y2;
    const c1 = x3 - x2, c2 = x1 - x3, c3 = x2 - x1;

    // B matrix 3 x 6
    const B = [
      [b1 * inv2A, 0, b2 * inv2A, 0, b3 * inv2A, 0],
      [0, c1 * inv2A, 0, c2 * inv2A, 0, c3 * inv2A],
      [c1 * inv2A, b1 * inv2A, c2 * inv2A, b2 * inv2A, c3 * inv2A, b3 * inv2A]
    ];

    // C matrix 3 x 3
    const factor = E / (1.0 - nu * nu);
    const C = [
      [factor, factor * nu, 0],
      [factor * nu, factor, 0],
      [0, 0, (factor * (1.0 - nu)) / 2.0]
    ];

    // Compute CB = C * B (3 x 6)
    const CB: number[][] = Array.from({ length: 3 }, () => new Array(6).fill(0));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        for (let k = 0; k < 3; k++) {
          CB[i][j] += C[i][k] * B[k][j];
        }
      }
    }

    // Ke = B^T * CB * area * t (6 x 6)
    const vol = area * t;
    const Ke: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += B[k][i] * CB[k][j];
        }
        Ke[i][j] = sum * vol;
      }
    }

    const mat = new Matrix(6, 6, Ke);
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
    const E = material?.E || 200e9;
    const nu = material?.nu ?? 0.3;

    const x1 = coords[0][0], y1 = coords[0][1];
    const x2 = coords[1][0], y2 = coords[1][1];
    const x3 = coords[2][0], y3 = coords[2][1];

    const doubleArea = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const inv2A = 1.0 / (doubleArea || 1e-12);

    const b1 = y2 - y3, b2 = y3 - y1, b3 = y1 - y2;
    const c1 = x3 - x2, c2 = x1 - x3, c3 = x2 - x1;

    const B = [
      [b1 * inv2A, 0, b2 * inv2A, 0, b3 * inv2A, 0],
      [0, c1 * inv2A, 0, c2 * inv2A, 0, c3 * inv2A],
      [c1 * inv2A, b1 * inv2A, c2 * inv2A, b2 * inv2A, c3 * inv2A, b3 * inv2A]
    ];

    const strain = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        strain[i] += B[i][j] * (u_e[j] || 0);
      }
    }

    const factor = E / (1.0 - nu * nu);
    const C = [
      [factor, factor * nu, 0],
      [factor * nu, factor, 0],
      [0, 0, (factor * (1.0 - nu)) / 2.0]
    ];

    const stress = [
      C[0][0] * strain[0] + C[0][1] * strain[1] + C[0][2] * strain[2],
      C[1][0] * strain[0] + C[1][1] * strain[1] + C[1][2] * strain[2],
      C[2][0] * strain[0] + C[2][1] * strain[1] + C[2][2] * strain[2]
    ];

    const sxx = stress[0];
    const syy = stress[1];
    const sxy = stress[2];
    const vonMisesStress = Math.sqrt(Math.max(0, sxx * sxx - sxx * syy + syy * syy + 3 * sxy * sxy));

    return {
      strain,
      stress,
      vonMisesStress
    };
  }
}

