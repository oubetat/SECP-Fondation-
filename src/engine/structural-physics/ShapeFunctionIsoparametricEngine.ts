/**
 * PATCH-SECP-073.2: Isoparametric Shape Function Engine
 * Evaluates shape functions, natural derivatives, Jacobian matrices, 
 * and strain-displacement matrices [B] for advanced Quad4 and Hex8 elements.
 */

import { MeshNode } from './StructuralPhysicsTypes';

export class ShapeFunctionIsoparametricEngine {
  /**
   * Evaluates the Quad4 (4-node quadrilateral) formulation at a specific Gauss point (xi, eta).
   * Nodes must be ordered counter-clockwise.
   */
  public static evaluateQuad4(
    xi: number,
    eta: number,
    nodes: MeshNode[]
  ): { detJ: number; B: number[][] } {
    // 1. Shape function natural derivatives dN/dxi and dN/deta
    const dN_dxi = [
      -0.25 * (1 - eta),
       0.25 * (1 - eta),
       0.25 * (1 + eta),
      -0.25 * (1 + eta)
    ];

    const dN_deta = [
      -0.25 * (1 - xi),
      -0.25 * (1 + xi),
       0.25 * (1 + xi),
       0.25 * (1 - xi)
    ];

    // 2. Compute Jacobian Matrix [J]
    let J11 = 0, J12 = 0, J21 = 0, J22 = 0;
    for (let i = 0; i < 4; i++) {
      J11 += dN_dxi[i] * nodes[i].x;
      J12 += dN_dxi[i] * nodes[i].y;
      J21 += dN_deta[i] * nodes[i].x;
      J22 += dN_deta[i] * nodes[i].y;
    }

    const detJ = J11 * J22 - J12 * J21;
    if (detJ <= 0) {
      throw new Error('Invalid Quad4 Element: Jacobian determinant is zero or negative (mesh severely distorted).');
    }

    // 3. Inverse Jacobian Matrix [J]^-1
    const invJ11 =  J22 / detJ;
    const invJ12 = -J12 / detJ;
    const invJ21 = -J21 / detJ;
    const invJ22 =  J11 / detJ;

    // 4. Compute Cartesian derivatives dN/dx and dN/dy
    const dN_dx = new Array(4);
    const dN_dy = new Array(4);
    for (let i = 0; i < 4; i++) {
      dN_dx[i] = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i];
      dN_dy[i] = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i];
    }

    // 5. Construct Strain-Displacement Matrix [B] (3 x 8)
    const B: number[][] = [
      new Array(8).fill(0),
      new Array(8).fill(0),
      new Array(8).fill(0)
    ];

    for (let i = 0; i < 4; i++) {
      // epsilon_xx
      B[0][2 * i]     = dN_dx[i];
      B[0][2 * i + 1] = 0;
      
      // epsilon_yy
      B[1][2 * i]     = 0;
      B[1][2 * i + 1] = dN_dy[i];
      
      // gamma_xy (Engineering shear strain)
      B[2][2 * i]     = dN_dy[i];
      B[2][2 * i + 1] = dN_dx[i];
    }

    return { detJ, B };
  }

  /**
   * Evaluates the Hex8 (8-node hexahedron) formulation at a specific Gauss point (xi, eta, zeta).
   */
  public static evaluateHex8(
    xi: number,
    eta: number,
    zeta: number,
    nodes: MeshNode[]
  ): { detJ: number; B: number[][] } {
    const xi_i = [-1, 1, 1, -1, -1, 1, 1, -1];
    const eta_i = [-1, -1, 1, 1, -1, -1, 1, 1];
    const zeta_i = [-1, -1, -1, -1, 1, 1, 1, 1];

    const dN_dxi = new Array(8);
    const dN_deta = new Array(8);
    const dN_dzeta = new Array(8);

    for (let i = 0; i < 8; i++) {
      dN_dxi[i] = 0.125 * xi_i[i] * (1 + eta_i[i] * eta) * (1 + zeta_i[i] * zeta);
      dN_deta[i] = 0.125 * eta_i[i] * (1 + xi_i[i] * xi) * (1 + zeta_i[i] * zeta);
      dN_dzeta[i] = 0.125 * zeta_i[i] * (1 + xi_i[i] * xi) * (1 + eta_i[i] * eta);
    }

    const J: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let i = 0; i < 8; i++) {
      J[0][0] += dN_dxi[i] * nodes[i].x; J[0][1] += dN_dxi[i] * nodes[i].y; J[0][2] += dN_dxi[i] * nodes[i].z;
      J[1][0] += dN_deta[i] * nodes[i].x; J[1][1] += dN_deta[i] * nodes[i].y; J[1][2] += dN_deta[i] * nodes[i].z;
      J[2][0] += dN_dzeta[i] * nodes[i].x; J[2][1] += dN_dzeta[i] * nodes[i].y; J[2][2] += dN_dzeta[i] * nodes[i].z;
    }

    const detJ = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) -
                 J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) +
                 J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);

    if (detJ <= 0) {
      throw new Error('Invalid Hex8 Element: Jacobian determinant is zero or negative.');
    }

    const invJ = [
      [(J[1][1] * J[2][2] - J[1][2] * J[2][1]) / detJ, (J[0][2] * J[2][1] - J[0][1] * J[2][2]) / detJ, (J[0][1] * J[1][2] - J[0][2] * J[1][1]) / detJ],
      [(J[1][2] * J[2][0] - J[1][0] * J[2][2]) / detJ, (J[0][0] * J[2][2] - J[0][2] * J[2][0]) / detJ, (J[0][2] * J[1][0] - J[0][0] * J[1][2]) / detJ],
      [(J[1][0] * J[2][1] - J[1][1] * J[2][0]) / detJ, (J[0][1] * J[2][0] - J[0][0] * J[2][1]) / detJ, (J[0][0] * J[1][1] - J[0][1] * J[1][0]) / detJ]
    ];

    const dN_dx = new Array(8);
    const dN_dy = new Array(8);
    const dN_dz = new Array(8);

    for (let i = 0; i < 8; i++) {
      dN_dx[i] = invJ[0][0] * dN_dxi[i] + invJ[0][1] * dN_deta[i] + invJ[0][2] * dN_dzeta[i];
      dN_dy[i] = invJ[1][0] * dN_dxi[i] + invJ[1][1] * dN_deta[i] + invJ[1][2] * dN_dzeta[i];
      dN_dz[i] = invJ[2][0] * dN_dxi[i] + invJ[2][1] * dN_deta[i] + invJ[2][2] * dN_dzeta[i];
    }

    const B: number[][] = Array.from({ length: 6 }, () => new Array(24).fill(0));

    for (let i = 0; i < 8; i++) {
      B[0][3 * i]     = dN_dx[i];
      B[1][3 * i + 1] = dN_dy[i];
      B[2][3 * i + 2] = dN_dz[i];
      B[3][3 * i]     = dN_dy[i]; B[3][3 * i + 1] = dN_dx[i];
      B[4][3 * i + 1] = dN_dz[i]; B[4][3 * i + 2] = dN_dy[i];
      B[5][3 * i]     = dN_dz[i]; B[5][3 * i + 2] = dN_dx[i];
    }

    return { detJ, B };
  }
}
