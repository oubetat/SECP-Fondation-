/**
 * SECP Industrial OS — Engineering Truth OS
 * TET4LargeDeformationFormulation.ts
 *
 * SECP-PHYSICS-EXPANSION-001: 4-Node Tetrahedral Solid Element for Large Deformation Mechanics.
 * Total Lagrangian continuum formulation supporting finite deformation, large rotations,
 * Green-Lagrange strain, 2nd Piola-Kirchhoff stress, true Cauchy stress push-forward,
 * and exact tangent stiffness decomposition:
 *   K_t = K_material + K_geometric
 *
 * Compatible with NonlinearEquilibriumSolver (Newton-Raphson) and HyperelasticNeoHookean3D.
 */

import { Matrix } from "./MathUtils";
import {
  DOFComponent,
  ElementMatrixResult,
  ElementNonlinearResult,
  ElementStressStrainResult,
  FEMElement,
  FEMModel,
  IntegrationPointResult
} from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { MaterialStateManager } from "./MaterialStateManager";
import { ConstitutiveModel } from "./ConstitutiveModel";
import { HyperelasticNeoHookean3D } from "./HyperelasticNeoHookean3D";

export class TET4LargeDeformationFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY, DOFComponent.UZ];
  }

  /**
   * Reference tetrahedral shape function derivatives w.r.t reference coordinates X, Y, Z.
   */
  public computeReferenceDerivatives(nodes: { x: number; y: number; z: number }[]): {
    dNdX: number[];
    dNdY: number[];
    dNdZ: number[];
    detJ0: number;
    volume0: number;
  } {
    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    // Reference Jacobian matrix J0 = [ X2-X1 Y2-Y1 Z2-Z1 ; X3-X1 Y3-Y1 Z3-Z1 ; X4-X1 Y4-Y1 Z4-Z1 ]
    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];

    const detJ0 = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);

    if (detJ0 <= 1e-14 || !Number.isFinite(detJ0)) {
      throw new Error(`[DEGENERATE_REFERENCE_TET] TET4 reference tetrahedron is degenerate (detJ0 = ${detJ0}).`);
    }

    const invDetJ0 = 1.0 / detJ0;
    const invJ11 = (J22 * J33 - J23 * J32) * invDetJ0;
    const invJ12 = (J13 * J32 - J12 * J33) * invDetJ0;
    const invJ13 = (J12 * J23 - J13 * J22) * invDetJ0;

    const invJ21 = (J23 * J31 - J21 * J33) * invDetJ0;
    const invJ22 = (J11 * J33 - J13 * J31) * invDetJ0;
    const invJ23 = (J13 * J21 - J11 * J23) * invDetJ0;

    const invJ31 = (J21 * J32 - J22 * J31) * invDetJ0;
    const invJ32 = (J12 * J31 - J11 * J32) * invDetJ0;
    const invJ33 = (J11 * J22 - J12 * J21) * invDetJ0;

    // Local parametric shape derivatives
    const dN_dxi = [-1, 1, 0, 0];
    const dN_deta = [-1, 0, 1, 0];
    const dN_dzeta = [-1, 0, 0, 1];

    const dNdX: number[] = new Array(4);
    const dNdY: number[] = new Array(4);
    const dNdZ: number[] = new Array(4);

    for (let i = 0; i < 4; i++) {
      dNdX[i] = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i] + invJ13 * dN_dzeta[i];
      dNdY[i] = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i] + invJ23 * dN_dzeta[i];
      dNdZ[i] = invJ31 * dN_dxi[i] + invJ32 * dN_deta[i] + invJ33 * dN_dzeta[i];
    }

    return {
      dNdX,
      dNdY,
      dNdZ,
      detJ0,
      volume0: detJ0 / 6.0
    };
  }

  /**
   * Computes Deformation Gradient F (3x3) given nodal displacements u_e (12x1).
   * F_ij = delta_ij + sum_a u_{i,a} * dNa/dX_j
   */
  public computeDeformationGradient(
    u_e: Float64Array | number[],
    dNdX: number[],
    dNdY: number[],
    dNdZ: number[]
  ): number[][] {
    const F: number[][] = [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0]
    ];

    for (let a = 0; a < 4; a++) {
      const ua = u_e[3 * a];
      const va = u_e[3 * a + 1];
      const wa = u_e[3 * a + 2];

      const dX = dNdX[a];
      const dY = dNdY[a];
      const dZ = dNdZ[a];

      // Row 0 (x):
      F[0][0] += ua * dX;
      F[0][1] += ua * dY;
      F[0][2] += ua * dZ;

      // Row 1 (y):
      F[1][0] += va * dX;
      F[1][1] += va * dY;
      F[1][2] += va * dZ;

      // Row 2 (z):
      F[2][0] += wa * dX;
      F[2][1] += wa * dY;
      F[2][2] += wa * dZ;
    }

    return F;
  }

  /**
   * Constructs the 6x12 non-linear strain-displacement matrix B_L(u).
   * Voigt ordering: 0:11, 1:22, 2:33, 3:12, 4:23, 5:13
   */
  public computeBL(
    F: number[][],
    dNdX: number[],
    dNdY: number[],
    dNdZ: number[]
  ): Matrix {
    const BL = new Matrix(6, 12);

    for (let a = 0; a < 4; a++) {
      const col = 3 * a;
      const dX = dNdX[a];
      const dY = dNdY[a];
      const dZ = dNdZ[a];

      // E11 = F_11*u1,X + F_21*u2,X + F_31*u3,X
      BL.set(0, col,     F[0][0] * dX);
      BL.set(0, col + 1, F[1][0] * dX);
      BL.set(0, col + 2, F[2][0] * dX);

      // E22 = F_12*u1,Y + F_22*u2,Y + F_32*u3,Y
      BL.set(1, col,     F[0][1] * dY);
      BL.set(1, col + 1, F[1][1] * dY);
      BL.set(1, col + 2, F[2][1] * dY);

      // E33 = F_13*u1,Z + F_23*u2,Z + F_33*u3,Z
      BL.set(2, col,     F[0][2] * dZ);
      BL.set(2, col + 1, F[1][2] * dZ);
      BL.set(2, col + 2, F[2][2] * dZ);

      // 2*E12 = F_11*u1,Y + F_12*u1,X + ...
      BL.set(3, col,     F[0][0] * dY + F[0][1] * dX);
      BL.set(3, col + 1, F[1][0] * dY + F[1][1] * dX);
      BL.set(3, col + 2, F[2][0] * dY + F[2][1] * dX);

      // 2*E23 = F_12*u1,Z + F_13*u1,Y + ...
      BL.set(4, col,     F[0][1] * dZ + F[0][2] * dY);
      BL.set(4, col + 1, F[1][1] * dZ + F[1][2] * dY);
      BL.set(4, col + 2, F[2][1] * dZ + F[2][2] * dY);

      // 2*E13 = F_11*u1,Z + F_13*u1,X + ...
      BL.set(5, col,     F[0][0] * dZ + F[0][2] * dX);
      BL.set(5, col + 1, F[1][0] * dZ + F[1][2] * dX);
      BL.set(5, col + 2, F[2][0] * dZ + F[2][2] * dX);
    }

    return BL;
  }

  /**
   * Computes the 12x12 geometric stiffness matrix K_geo:
   * K_geo_ab = (nabla N_a . S . nabla N_b) * volume0 * I_3x3
   */
  public computeGeometricStiffness(
    S_tensor: number[][],
    dNdX: number[],
    dNdY: number[],
    dNdZ: number[],
    volume0: number
  ): Matrix {
    const Kgeo = new Matrix(12, 12);

    for (let a = 0; a < 4; a++) {
      const gradNa = [dNdX[a], dNdY[a], dNdZ[a]];

      for (let b = 0; b < 4; b++) {
        const gradNb = [dNdX[b], dNdY[b], dNdZ[b]];

        // S_dot_gradNb = S * gradNb
        let s_ab = 0;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            s_ab += gradNa[i] * S_tensor[i][j] * gradNb[j];
          }
        }
        const coeff = s_ab * volume0;

        // Populate 3x3 block diagonal with coeff
        const row = 3 * a;
        const col = 3 * b;
        Kgeo.set(row,     col,     coeff);
        Kgeo.set(row + 1, col + 1, coeff);
        Kgeo.set(row + 2, col + 2, coeff);
      }
    }

    return Kgeo;
  }

  /**
   * Small-displacement linear stiffness matrix for initial step or fallback.
   */
  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;
    const { dNdX, dNdY, dNdZ, volume0 } = this.computeReferenceDerivatives(nodes);

    // Initial linear B0 = BL at F = I
    const I3 = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const B0 = this.computeBL(I3, dNdX, dNdY, dNdZ);

    const hyper = new HyperelasticNeoHookean3D({ E: material.E, nu: material.nu });
    const { C_mat } = hyper.computeStressAndTangent(I3);

    // Ke = B0^T * C_mat * B0 * volume0
    const Bt = B0.transpose();
    const BtC = Bt.multiply(C_mat);
    const Ke = BtC.multiply(B0).scale(volume0);

    const globalDOFs: number[] = [];
    for (const nodeId of element.nodeIds) {
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX)!;
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY)!;
      const dofZ = dofManager.getDOF(nodeId, DOFComponent.UZ)!;
      globalDOFs.push(dofX.globalId, dofY.globalId, dofZ.globalId);
    }

    return {
      Ke,
      Fe: new Array(12).fill(0),
      globalDOFs
    };
  }

  /**
   * Computes nonlinear tangent stiffness matrix Kt and internal force vector Fint
   * for Newton-Raphson iterations.
   */
  computeNonlinearMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array,
    _stateManager?: MaterialStateManager,
    materialModel?: ConstitutiveModel
  ): ElementNonlinearResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;

    const { dNdX, dNdY, dNdZ, volume0 } = this.computeReferenceDerivatives(nodes);

    const u_e = new Float64Array(12);
    const globalDOFs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const nodeId = element.nodeIds[i];
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX)!;
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY)!;
      const dofZ = dofManager.getDOF(nodeId, DOFComponent.UZ)!;

      globalDOFs.push(dofX.globalId, dofY.globalId, dofZ.globalId);
      u_e[3 * i]     = U[dofX.globalId];
      u_e[3 * i + 1] = U[dofY.globalId];
      u_e[3 * i + 2] = U[dofZ.globalId];
    }

    const F = this.computeDeformationGradient(u_e, dNdX, dNdY, dNdZ);

    const hyper = (materialModel instanceof HyperelasticNeoHookean3D)
      ? materialModel
      : new HyperelasticNeoHookean3D({ E: material.E, nu: material.nu });

    const { S_tensor, S_voigt, C_mat } = hyper.computeStressAndTangent(F);

    const BL = this.computeBL(F, dNdX, dNdY, dNdZ);

    // Fint = BL^T * S_voigt * volume0
    const BLt = BL.transpose();
    const BLt_S = BLt.multiplyVector(S_voigt);
    const Fint = BLt_S.map(v => v * volume0);

    // K_material = BL^T * C_mat * BL * volume0
    const BLtC = BLt.multiply(C_mat);
    const K_mat = BLtC.multiply(BL).scale(volume0);

    // K_geometric
    const K_geo = this.computeGeometricStiffness(S_tensor, dNdX, dNdY, dNdZ, volume0);

    // Total tangent stiffness Kt = K_mat + K_geo
    const Kt = new Matrix(12, 12);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        Kt.set(r, c, K_mat.get(r, c) + K_geo.get(r, c));
      }
    }

    return {
      Kt,
      Fint,
      globalDOFs
    };
  }

  /**
   * Recovers large-deformation Green-Lagrange strain, 2nd Piola-Kirchhoff stress,
   * push-forward Cauchy stress, and equivalent von Mises stress.
   */
  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;
    const { dNdX, dNdY, dNdZ, volume0 } = this.computeReferenceDerivatives(nodes);

    const u_e = new Float64Array(12);
    for (let i = 0; i < 4; i++) {
      const nodeId = element.nodeIds[i];
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX)!;
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY)!;
      const dofZ = dofManager.getDOF(nodeId, DOFComponent.UZ)!;

      u_e[3 * i]     = U[dofX.globalId];
      u_e[3 * i + 1] = U[dofY.globalId];
      u_e[3 * i + 2] = U[dofZ.globalId];
    }

    const F = this.computeDeformationGradient(u_e, dNdX, dNdY, dNdZ);
    const hyper = new HyperelasticNeoHookean3D({ E: material.E, nu: material.nu });
    const { S_tensor, J, strainEnergy } = hyper.computeStressAndTangent(F);

    // Green-Lagrange strain E = 0.5 * (F^T * F - I)
    const C: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += F[k][i] * F[k][j];
        C[i][j] = sum;
      }
    }

    const eps_x = 0.5 * (C[0][0] - 1.0);
    const eps_y = 0.5 * (C[1][1] - 1.0);
    const eps_z = 0.5 * (C[2][2] - 1.0);
    const gam_xy = C[0][1]; // 2*E12
    const gam_yz = C[1][2]; // 2*E23
    const gam_xz = C[0][2]; // 2*E13

    // Push-forward Cauchy stress: sigma = (1 / J) * F * S * F^T
    const sigma: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    const invJ = 1.0 / J;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          for (let l = 0; l < 3; l++) {
            sum += F[i][k] * S_tensor[k][l] * F[j][l];
          }
        }
        sigma[i][j] = sum * invJ;
      }
    }

    const sig_x = sigma[0][0];
    const sig_y = sigma[1][1];
    const sig_z = sigma[2][2];
    const tau_xy = sigma[0][1];
    const tau_yz = sigma[1][2];
    const tau_xz = sigma[0][2];

    const vmSq = 0.5 * (
      (sig_x - sig_y) ** 2 +
      (sig_y - sig_z) ** 2 +
      (sig_z - sig_x) ** 2 +
      6.0 * (tau_xy ** 2 + tau_yz ** 2 + tau_xz ** 2)
    );
    const vonMisesStress = Math.sqrt(Math.max(0, vmSq));

    const centroidX = (nodes[0].x + nodes[1].x + nodes[2].x + nodes[3].x) / 4.0;
    const centroidY = (nodes[0].y + nodes[1].y + nodes[2].y + nodes[3].y) / 4.0;
    const centroidZ = (nodes[0].z + nodes[1].z + nodes[2].z + nodes[3].z) / 4.0;

    const integrationPoint: IntegrationPointResult = {
      pointIndex: 0,
      xi: 0.25,
      eta: 0.25,
      weight: 1.0,
      physicalLocation: { x: centroidX, y: centroidY, z: centroidZ },
      strain: { epsilon_x: eps_x, epsilon_y: eps_y, epsilon_z: eps_z, gamma_xy: gam_xy, gamma_yz: gam_yz, gamma_xz: gam_xz },
      stress: { sigma_x: sig_x, sigma_y: sig_y, sigma_z: sig_z, tau_xy: tau_xy, tau_yz: tau_yz, tau_xz: tau_xz },
      vonMisesStress
    };

    return {
      elementId: element.elementId,
      formulationId: "TET4_LARGE_DEFORM",
      strain: { epsilon_x: eps_x, epsilon_y: eps_y, epsilon_z: eps_z, gamma_xy: gam_xy, gamma_yz: gam_yz, gamma_xz: gam_xz },
      stress: { sigma_x: sig_x, sigma_y: sig_y, sigma_z: sig_z, tau_xy: tau_xy, tau_yz: tau_yz, tau_xz: tau_xz },
      integrationPoints: [integrationPoint],
      vonMisesStress,
      strainEnergy: strainEnergy * volume0,
      location: 'CENTROID',
      units: { strain: 'dimensionless (Green-Lagrange)', stress: 'MPa (Cauchy)', strainEnergy: 'N*mm' }
    };
  }
}
