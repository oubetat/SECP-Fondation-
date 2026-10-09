import { Matrix } from '../core/MathUtils';

export class BAR2Element {
  public static computeStiffness(id: string, coords: number[][], material: any): { Ke: Matrix; stiffnessMatrix: Matrix } {
    const E = material.E;
    if (E <= 0) throw new Error("Invalid Young's Modulus E");
    const A = material.area ?? 1.0;
    const dim = coords[0]?.length ?? 2;

    const dx = coords[1][0] - coords[0][0];
    const dy = dim >= 2 ? (coords[1][1] - coords[0][1]) : 0;
    const dz = dim >= 3 ? (coords[1][2] - coords[0][2]) : 0;

    const L = Math.hypot(dx, dy, dz);
    if (L <= 1e-12) throw new Error("Zero length BAR2 element");
    const k = (E * A) / L;

    let Ke: number[][];

    if (dim === 1) {
      Ke = [
        [k, -k],
        [-k, k]
      ];
    } else if (dim === 2) {
      const c = dx / L;
      const s = dy / L;
      Ke = [
        [k * c * c, k * c * s, -k * c * c, -k * c * s],
        [k * c * s, k * s * s, -k * c * s, -k * s * s],
        [-k * c * c, -k * c * s, k * c * c, k * c * s],
        [-k * c * s, -k * s * s, k * c * s, k * s * s]
      ];
    } else {
      const l = dx / L;
      const m = dy / L;
      const n = dz / L;
      const dir = [l, m, n, -l, -m, -n];
      Ke = Array.from({ length: 6 }, () => new Array(6).fill(0));
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          Ke[i][j] = k * dir[i] * dir[j];
        }
      }
    }

    const n = Ke.length;
    const mat = new Matrix(n, n, Ke);
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
    const dx = coords[1][0] - coords[0][0];
    const dy = (coords[1][1] ?? 0) - (coords[0][1] ?? 0);
    const dz = (coords[1][2] ?? 0) - (coords[0][2] ?? 0);
    const L = Math.hypot(dx, dy, dz) || 1.0;

    const u1 = u_e[0] || 0;
    const u2 = u_e[1] !== undefined ? u_e[1] : (u_e[3] || 0);
    const du = u2 - u1;
    const eps = du / L;
    const sig = E * eps;

    return {
      strain: [eps],
      stress: [sig],
      vonMisesStress: Math.abs(sig)
    };
  }
}
