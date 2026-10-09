import { Matrix } from '../core/MathUtils';
import { ConstitutiveEngine } from './ConstitutiveEngine';

export class TET4Element {
  public static computeStiffness(
    id: string,
    coords: number[][],
    material: any
  ): { Ke: Matrix; stiffnessMatrix: Matrix } {
    const E = material?.E ?? 200e9;
    if (E <= 0) throw new Error("Invalid Young's Modulus E");
    const nu = material?.nu ?? 0.3;

    const x1 = coords[0][0], y1 = coords[0][1], z1 = coords[0][2];
    const x2 = coords[1][0], y2 = coords[1][1], z2 = coords[1][2];
    const x3 = coords[2][0], y3 = coords[2][1], z3 = coords[2][2];
    const x4 = coords[3][0], y4 = coords[3][1], z4 = coords[3][2];

    const x21 = x2 - x1, x31 = x3 - x1, x41 = x4 - x1;
    const y21 = y2 - y1, y31 = y3 - y1, y41 = y4 - y1;
    const z21 = z2 - z1, z31 = z3 - z1, z41 = z4 - z1;

    const detJ = x21 * (y31 * z41 - y41 * z31)
               - y21 * (x31 * z41 - x41 * z31)
               + z21 * (x31 * y41 - x41 * y31);

    if (detJ <= 1e-12) throw new Error("Invalid TET4 element volume");
    const volume = detJ / 6.0;
    const inv6V = 1.0 / detJ;

    // Compute b, c, d coefficients for N1, N2, N3, N4
    const b = [
      -(y3 - y2) * (z4 - z2) + (y4 - y2) * (z3 - z2),
       (y3 - y1) * (z4 - z1) - (y4 - y1) * (z3 - z1),
      -(y2 - y1) * (z4 - z1) + (y4 - y1) * (z2 - z1),
       (y2 - y1) * (z3 - z1) - (y3 - y1) * (z2 - z1)
    ];

    const c = [
       (x3 - x2) * (z4 - z2) - (x4 - x2) * (z3 - z2),
      -(x3 - x1) * (z4 - z1) + (x4 - x1) * (z3 - z1),
       (x2 - x1) * (z4 - z1) - (x4 - x1) * (z2 - z1),
      -(x2 - x1) * (z3 - z1) + (x3 - x1) * (z2 - z1)
    ];

    const d = [
      -(x3 - x2) * (y4 - y2) + (x4 - x2) * (y3 - y2),
       (x3 - x1) * (y4 - y1) - (x4 - x1) * (y3 - y1),
      -(x2 - x1) * (y4 - y1) + (x4 - x1) * (y2 - y1),
       (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
    ];

    // Build 6x12 B matrix
    const B = Array.from({ length: 6 }, () => new Array(12).fill(0));
    for (let i = 0; i < 4; i++) {
      const col = i * 3;
      const dNdx = b[i] * inv6V;
      const dNdy = c[i] * inv6V;
      const dNdz = d[i] * inv6V;

      B[0][col]     = dNdx;
      B[1][col + 1] = dNdy;
      B[2][col + 2] = dNdz;

      B[3][col + 1] = dNdz;
      B[3][col + 2] = dNdy;

      B[4][col]     = dNdz;
      B[4][col + 2] = dNdx;

      B[5][col]     = dNdy;
      B[5][col + 1] = dNdx;
    }

    const D_data = ConstitutiveEngine.get3DIsotropicConstitutive(E, nu);

    // Compute DB = D * B (6x12)
    const DB = Array.from({ length: 6 }, () => new Array(12).fill(0));
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 12; col++) {
        let sum = 0;
        for (let k = 0; k < 6; k++) {
          sum += D_data[r][k] * B[k][col];
        }
        DB[r][col] = sum;
      }
    }

    // Ke = B^T * DB * volume (12x12)
    const Ke_data = Array.from({ length: 12 }, () => new Array(12).fill(0));
    for (let r = 0; r < 12; r++) {
      for (let col = 0; col < 12; col++) {
        let sum = 0;
        for (let k = 0; k < 6; k++) {
          sum += B[k][r] * DB[k][col];
        }
        Ke_data[r][col] = sum * volume;
      }
    }

    const stiffnessMatrix = new Matrix(12, 12, Ke_data);

    return {
      Ke: stiffnessMatrix,
      stiffnessMatrix
    };
  }

  public static computeStrainStress(
    coords: number[][],
    u_e: number[],
    material: any
  ): { strain: number[]; stress: number[]; vonMisesStress: number } {
    const E = material?.E ?? 200e9;
    const nu = material?.nu ?? 0.3;

    const x1 = coords[0][0], y1 = coords[0][1], z1 = coords[0][2];
    const x2 = coords[1][0], y2 = coords[1][1], z2 = coords[1][2];
    const x3 = coords[2][0], y3 = coords[2][1], z3 = coords[2][2];
    const x4 = coords[3][0], y4 = coords[3][1], z4 = coords[3][2];

    const x21 = x2 - x1, x31 = x3 - x1, x41 = x4 - x1;
    const y21 = y2 - y1, y31 = y3 - y1, y41 = y4 - y1;
    const z21 = z2 - z1, z31 = z3 - z1, z41 = z4 - z1;

    const detJ = x21 * (y31 * z41 - y41 * z31)
               - y21 * (x31 * z41 - x41 * z31)
               + z21 * (x31 * y41 - x41 * y31);

    const inv6V = 1.0 / (detJ || 1e-12);

    const b = [
      -(y3 - y2) * (z4 - z2) + (y4 - y2) * (z3 - z2),
       (y3 - y1) * (z4 - z1) - (y4 - y1) * (z3 - z1),
      -(y2 - y1) * (z4 - z1) + (y4 - y1) * (z2 - z1),
       (y2 - y1) * (z3 - z1) - (y3 - y1) * (z2 - z1)
    ];

    const c = [
       (x3 - x2) * (z4 - z2) - (x4 - x2) * (z3 - z2),
      -(x3 - x1) * (z4 - z1) + (x4 - x1) * (z3 - z1),
       (x2 - x1) * (z4 - z1) - (x4 - x1) * (z2 - z1),
      -(x2 - x1) * (z3 - z1) + (x3 - x1) * (z2 - z1)
    ];

    const d = [
      -(x3 - x2) * (y4 - y2) + (x4 - x2) * (y3 - y2),
       (x3 - x1) * (y4 - y1) - (x4 - x1) * (y3 - y1),
      -(x2 - x1) * (y4 - y1) + (x4 - x1) * (y2 - y1),
       (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)
    ];

    let exx = 0, eyy = 0, ezz = 0, gyz = 0, gxz = 0, gxy = 0;
    for (let i = 0; i < 4; i++) {
      const dNdx = b[i] * inv6V;
      const dNdy = c[i] * inv6V;
      const dNdz = d[i] * inv6V;

      const ux = u_e[i * 3] ?? 0;
      const uy = u_e[i * 3 + 1] ?? 0;
      const uz = u_e[i * 3 + 2] ?? 0;

      exx += dNdx * ux;
      eyy += dNdy * uy;
      ezz += dNdz * uz;

      gyz += dNdz * uy + dNdy * uz;
      gxz += dNdz * ux + dNdx * uz;
      gxy += dNdy * ux + dNdx * uy;
    }

    const D_data = ConstitutiveEngine.get3DIsotropicConstitutive(E, nu);
    const strain = [exx, eyy, ezz, gyz, gxz, gxy];
    const stress = new Array(6).fill(0);
    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 6; col++) {
        stress[r] += D_data[r][col] * strain[col];
      }
    }

    const [sxx, syy, szz, syz, sxz, sxy] = stress;
    const vm = Math.sqrt(
      0.5 * ((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2 + 6 * (syz ** 2 + sxz ** 2 + sxy ** 2))
    );

    return {
      strain,
      stress,
      vonMisesStress: vm
    };
  }
}
