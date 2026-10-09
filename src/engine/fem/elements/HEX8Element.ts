import { Matrix } from "../core/MathUtils";
import { ConstitutiveEngine } from "./ConstitutiveEngine";
import { IntegrationEngine } from "./IntegrationEngine";
import { JacobianEngine } from "./JacobianEngine";
import { ShapeFunctions } from "./ShapeFunctions";
import { ElementComputedStiffness, ElementStrainStressResult, MaterialProperties } from "./types";

export class HEX8Element {
  static readonly formulationVersion = "HEX8-ISO-v1";
  static readonly elementTypeId = "HEX8";

  /**
   * Compute 3D 8-node Trilinear Isoparametric Hexahedral stiffness matrix (24x24)
   * Using 2x2x2 Gauss numerical integration (8 Gauss points).
   */
  static computeStiffness(
    elementId: string,
    nodeCoords: number[][],
    material: MaterialProperties,
    integrationRuleId = "GAUSS_HEX_2X2X2"
  ): ElementComputedStiffness {
    if (nodeCoords.length !== 8) {
      throw new Error(`HEX8 requires exactly 8 nodes, got ${nodeCoords.length}`);
    }
    if ((material?.E ?? 200e9) <= 0) {
      throw new Error("Invalid Young's Modulus E");
    }

    const D_data = ConstitutiveEngine.get3DIsotropicConstitutive(material.E, material.nu ?? 0.3);
    const D = new Matrix(6, 6, D_data);
    const rule = IntegrationEngine.getRule(integrationRuleId);
    const Ke = Matrix.zeros(24, 24);

    for (const pt of rule.points) {
      const xi = pt.xi;
      const eta = pt.eta ?? 0;
      const zeta = pt.zeta ?? 0;

      const sf = ShapeFunctions.hex8(xi, eta, zeta);
      const jac = JacobianEngine.compute3D(sf.dN_dxi, sf.dN_deta!, sf.dN_dzeta!, nodeCoords);

      if (!jac.isValid || jac.det <= 1e-14) {
        throw new Error(`INVALID_ELEMENT: Non-positive Jacobian det(J)=${jac.det} at point (${xi.toFixed(2)}, ${eta.toFixed(2)}, ${zeta.toFixed(2)}) in HEX8`);
      }

      const { dN_dx, dN_dy, dN_dz } = JacobianEngine.computeSpatialDerivatives3D(
        sf.dN_dxi,
        sf.dN_deta!,
        sf.dN_dzeta!,
        jac.inverse
      );

      // Build 6x24 B matrix
      const B = new Matrix(6, 24);
      for (let i = 0; i < 8; i++) {
        const c = i * 3;
        B.set(0, c,     dN_dx[i]);
        B.set(1, c + 1, dN_dy[i]);
        B.set(2, c + 2, dN_dz[i]);
        B.set(3, c + 1, dN_dz[i]);
        B.set(3, c + 2, dN_dy[i]);
        B.set(4, c,     dN_dz[i]);
        B.set(4, c + 2, dN_dx[i]);
        B.set(5, c,     dN_dy[i]);
        B.set(5, c + 1, dN_dx[i]);
      }

      const dV = jac.det * pt.weight;
      const BT = B.transpose();
      const BT_D = BT.multiply(D);
      const BT_D_B = BT_D.multiply(B);

      for (let r = 0; r < 24; r++) {
        for (let c = 0; c < 24; c++) {
          Ke.add(r, c, BT_D_B.get(r, c) * dV);
        }
      }
    }

    const matrixHash = `HEX8_24x24_E${material.E}_NU${material.nu ?? 0.3}_${rule.points.length}GP`;

    return {
      elementId,
      elementTypeId: this.elementTypeId,
      formulationVersion: this.formulationVersion,
      Ke,
      stiffnessMatrix: Ke,
      integrationRuleId,
      dofCount: 24,
      matrixHash
    };
  }

  /**
   * Compute 3D strain and stress at natural coordinate (xi, eta, zeta)
   */
  static computeStrainStress(
    nodeCoords: number[][],
    displacements: number[],
    material: MaterialProperties,
    xi = 0,
    eta = 0,
    zeta = 0
  ): ElementStrainStressResult {
    if (displacements.length !== 24) throw new Error(`HEX8 requires 24 displacement DOFs, got ${displacements.length}`);

    const sf = ShapeFunctions.hex8(xi, eta, zeta);
    const jac = JacobianEngine.compute3D(sf.dN_dxi, sf.dN_deta!, sf.dN_dzeta!, nodeCoords);
    if (!jac.isValid) throw new Error("Invalid HEX8 geometry");

    const { dN_dx, dN_dy, dN_dz } = JacobianEngine.computeSpatialDerivatives3D(
      sf.dN_dxi,
      sf.dN_deta!,
      sf.dN_dzeta!,
      jac.inverse
    );

    const B = new Matrix(6, 24);
    for (let i = 0; i < 8; i++) {
      const c = i * 3;
      B.set(0, c,     dN_dx[i]);
      B.set(1, c + 1, dN_dy[i]);
      B.set(2, c + 2, dN_dz[i]);
      B.set(3, c + 1, dN_dz[i]);
      B.set(3, c + 2, dN_dy[i]);
      B.set(4, c,     dN_dz[i]);
      B.set(4, c + 2, dN_dx[i]);
      B.set(5, c,     dN_dy[i]);
      B.set(5, c + 1, dN_dx[i]);
    }

    const D_data = ConstitutiveEngine.get3DIsotropicConstitutive(material.E, material.nu ?? 0.3);
    const D = new Matrix(6, 6, D_data);
    const strain = B.multiplyVector(displacements);
    const stress = D.multiplyVector(strain);
    const vonMisesStress = ConstitutiveEngine.computeVonMisesStress3D(stress);

    return {
      strain,
      stress,
      vonMisesStress,
      location: { xi, eta, zeta }
    };
  }
}
