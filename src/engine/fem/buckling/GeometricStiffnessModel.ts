import { Matrix } from "../core/MathUtils";

export class GeometricStiffnessModel {
  /**
   * Computes the 2D Euler-Bernoulli Beam element elastic stiffness matrix (6x6).
   * DOFs: [u1, v1, theta1, u2, v2, theta2]
   */
  static computeBeamElasticStiffness(E: number, A: number, I: number, L: number): Matrix {
    const K = Matrix.zeros(6, 6);
    const k_ax = (E * A) / L;
    const k1 = (12 * E * I) / (L * L * L);
    const k2 = (6 * E * I) / (L * L);
    const k3 = (4 * E * I) / L;
    const k4 = (2 * E * I) / L;

    // u DOFs
    K.set(0, 0, k_ax);  K.set(0, 3, -k_ax);
    K.set(3, 0, -k_ax); K.set(3, 3, k_ax);

    // Bending DOFs
    K.set(1, 1, k1);  K.set(1, 2, k2);   K.set(1, 4, -k1); K.set(1, 5, k2);
    K.set(2, 1, k2);  K.set(2, 2, k3);   K.set(2, 4, -k2); K.set(2, 5, k4);
    K.set(4, 1, -k1); K.set(4, 2, -k2);  K.set(4, 4, k1);  K.set(4, 5, -k2);
    K.set(5, 1, k2);  K.set(5, 2, k4);   K.set(5, 4, -k2); K.set(5, 5, k3);

    return K;
  }

  /**
   * Computes the 2D Beam Geometric Stiffness Matrix (6x6) under axial force P.
   * P > 0 corresponds to axial COMPRESSION.
   * DOFs: [u1, v1, theta1, u2, v2, theta2]
   */
  static computeBeamGeometricStiffness(P: number, L: number): Matrix {
    const KG = Matrix.zeros(6, 6);
    const factor = P / (30 * L);

    const g1 = 36 * factor;
    const g2 = 3 * L * factor;
    const g3 = 4 * L * L * factor;
    const g4 = -L * L * factor;

    // Bending DOFs (v1, theta1, v2, theta2)
    KG.set(1, 1, g1);  KG.set(1, 2, g2);   KG.set(1, 4, -g1); KG.set(1, 5, g2);
    KG.set(2, 1, g2);  KG.set(2, 2, g3);   KG.set(2, 4, -g2); KG.set(2, 5, g4);
    KG.set(4, 1, -g1); KG.set(4, 2, -g2);  KG.set(4, 4, g1);  KG.set(4, 5, -g2);
    KG.set(5, 1, g2);  KG.set(5, 2, g4);   KG.set(5, 4, -g2); KG.set(5, 5, g3);

    return KG;
  }
}
