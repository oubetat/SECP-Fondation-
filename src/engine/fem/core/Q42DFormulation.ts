/**
 * SECP Industrial OS — Engineering Truth OS
 * Q42DFormulation.ts
 * 
 * SECP-FEM-UPGRADE-004: 4-Node Bilinear Quadrilateral Continuum Element (Q4_2D).
 * 4 nodes per element counter-clockwise, 2 DOFs per node [UX, UY] (8 DOFs total).
 * Bilinear natural-coordinate shape functions N1..N4.
 * Standard 2x2 Gauss-Legendre quadrature numerical integration (4 integration points).
 * Computes strain-displacement B-matrix from actual element geometry via Jacobian J.
 * Supports Plane Stress material model and integration-point stress/strain field recovery.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel, IntegrationPointResult } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class Q42DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY];
  }

  /**
   * Evaluates bilinear shape functions N_1 .. N_4 at natural coordinates (xi, eta).
   */
  public evaluateShapeFunctions(xi: number, eta: number): number[] {
    return [
      0.25 * (1 - xi) * (1 - eta), // N1 (-1, -1)
      0.25 * (1 + xi) * (1 - eta), // N2 (+1, -1)
      0.25 * (1 + xi) * (1 + eta), // N3 (+1, +1)
      0.25 * (1 - xi) * (1 + eta)  // N4 (-1, +1)
    ];
  }

  /**
   * Evaluates derivatives of shape functions w.r.t. natural coordinates (xi, eta).
   */
  public evaluateShapeDerivatives(xi: number, eta: number): { dN_dxi: number[]; dN_deta: number[] } {
    const dN_dxi = [
      -0.25 * (1 - eta), // dN1/dxi
       0.25 * (1 - eta), // dN2/dxi
       0.25 * (1 + eta), // dN3/dxi
      -0.25 * (1 + eta)  // dN4/dxi
    ];

    const dN_deta = [
      -0.25 * (1 - xi),  // dN1/deta
      -0.25 * (1 + xi),  // dN2/deta
       0.25 * (1 + xi),  // dN3/deta
       0.25 * (1 - xi)   // dN4/deta
    ];

    return { dN_dxi, dN_deta };
  }

  /**
   * 2x2 Gauss-Legendre quadrature rule for quadrilateral [-1, 1] x [-1, 1].
   */
  public getGaussPoints(): { xi: number; eta: number; weight: number }[] {
    const g = 1 / Math.sqrt(3); // 0.5773502691896258
    return [
      { xi: -g, eta: -g, weight: 1.0 },
      { xi:  g, eta: -g, weight: 1.0 },
      { xi:  g, eta:  g, weight: 1.0 },
      { xi: -g, eta:  g, weight: 1.0 }
    ];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    if (!element.nodeIds || element.nodeIds.length < 4) {
      throw new Error(`[INVALID_ELEMENT_NODES] Q4 element '${element.elementId}' requires 4 nodes.`);
    }

    const nodes = element.nodeIds.map(id => model.nodes.get(id));
    if (nodes.some(n => !n)) {
      throw new Error(`[ELEMENT_NODE_MISSING] Missing node definition for Q4 element '${element.elementId}'`);
    }

    const material = model.materials.get(element.materialId);
    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Young's modulus E=${material?.E} for element '${element.elementId}'`);
    }
    if (material.nu < -1 || material.nu >= 0.5 || !Number.isFinite(material.nu)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Poisson ratio nu=${material?.nu} for element '${element.elementId}'`);
    }

    const section = model.sections.get(element.sectionId);
    if (!section || !section.thickness || section.thickness <= 0) {
      throw new Error(`[INVALID_SECTION] Q4 element '${element.elementId}' requires valid positive section thickness`);
    }

    const t = section.thickness;
    const E = material.E;
    const nu = material.nu;

    // Plane Stress constitutive matrix D (3x3)
    const factor = E / (1 - nu * nu);
    const D = new Matrix(3, 3, [
      [1,  nu, 0],
      [nu, 1,  0],
      [0,  0,  (1 - nu) / 2]
    ]).scale(factor);

    const x = nodes.map(n => n!.x);
    const y = nodes.map(n => n!.y);

    const Ke = new Matrix(8, 8);
    const gaussPoints = this.getGaussPoints();

    for (const gp of gaussPoints) {
      const { dN_dxi, dN_deta } = this.evaluateShapeDerivatives(gp.xi, gp.eta);

      // Compute Jacobian matrix J = [ dx/dxi  dy/dxi ; dx/deta dy/deta ]
      let J11 = 0, J12 = 0, J21 = 0, J22 = 0;
      for (let i = 0; i < 4; i++) {
        J11 += dN_dxi[i] * x[i];
        J12 += dN_dxi[i] * y[i];
        J21 += dN_deta[i] * x[i];
        J22 += dN_deta[i] * y[i];
      }

      const detJ = J11 * J22 - J12 * J21;
      if (detJ <= 1e-12 || !Number.isFinite(detJ)) {
        throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] Non-positive or degenerate Jacobian (detJ=${detJ}) in Q4 element '${element.elementId}'`);
      }

      const invJ11 = J22 / detJ;
      const invJ12 = -J12 / detJ;
      const invJ21 = -J21 / detJ;
      const invJ22 = J11 / detJ;

      // Construct B matrix (3x8)
      const B = new Matrix(3, 8);
      for (let i = 0; i < 4; i++) {
        const dNi_dx = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i];
        const dNi_dy = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i];

        B.set(0, 2 * i,     dNi_dx);
        B.set(1, 2 * i + 1, dNi_dy);
        B.set(2, 2 * i,     dNi_dy);
        B.set(2, 2 * i + 1, dNi_dx);
      }

      // Ke_gp = B^T * D * B * detJ * t * weight
      const Bt = B.transpose();
      const BtD = Bt.multiply(D);
      const BtDB = BtD.multiply(B);
      const scale = detJ * t * gp.weight;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          Ke.add(r, c, BtDB.get(r, c) * scale);
        }
      }
    }

    const globalDOFs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const nodeId = element.nodeIds[i];
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX);
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY);
      if (!dofX || !dofY) {
        throw new Error(`[DOF_NOT_FOUND] Missing degrees of freedom for Q4 element node '${nodeId}'`);
      }
      globalDOFs.push(dofX.globalId);
      globalDOFs.push(dofY.globalId);
    }

    return { Ke, Fe: new Array(8).fill(0), globalDOFs };
  }

  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E}`);
    }
    if (material.nu < -1 || material.nu >= 0.5 || !Number.isFinite(material.nu)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Poisson ratio nu=${material?.nu}`);
    }
    if (!section || !section.thickness || section.thickness <= 0) {
      throw new Error("[INVALID_SECTION] Q4 element requires valid positive thickness");
    }

    const t = section.thickness;
    const E = material.E;
    const nu = material.nu;

    const factor = E / (1 - nu * nu);
    const D = new Matrix(3, 3, [
      [1,  nu, 0],
      [nu, 1,  0],
      [0,  0,  (1 - nu) / 2]
    ]).scale(factor);

    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);

    const u_e = new Float64Array(8);
    for (let i = 0; i < 4; i++) {
      const dofX = dofManager.getDOF(nodes[i].nodeId, DOFComponent.UX)!;
      const dofY = dofManager.getDOF(nodes[i].nodeId, DOFComponent.UY)!;
      u_e[2 * i] = U[dofX.globalId];
      u_e[2 * i + 1] = U[dofY.globalId];
    }

    const gaussPoints = this.getGaussPoints();
    const integrationResults: IntegrationPointResult[] = [];

    let sumEpsilonX = 0, sumEpsilonY = 0, sumGammaXY = 0;
    let sumSigmaX = 0, sumSigmaY = 0, sumTauXY = 0;
    let sumVonMises = 0;
    let totalArea = 0;
    let strainEnergy = 0;

    for (let g = 0; g < gaussPoints.length; g++) {
      const gp = gaussPoints[g];
      const N = this.evaluateShapeFunctions(gp.xi, gp.eta);
      const { dN_dxi, dN_deta } = this.evaluateShapeDerivatives(gp.xi, gp.eta);

      let J11 = 0, J12 = 0, J21 = 0, J22 = 0;
      let physX = 0, physY = 0;
      for (let i = 0; i < 4; i++) {
        J11 += dN_dxi[i] * x[i];
        J12 += dN_dxi[i] * y[i];
        J21 += dN_deta[i] * x[i];
        J22 += dN_deta[i] * y[i];
        physX += N[i] * x[i];
        physY += N[i] * y[i];
      }

      const detJ = J11 * J22 - J12 * J21;
      if (detJ <= 1e-12) {
        throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] Non-positive Jacobian in Q4 element`);
      }

      const invJ11 = J22 / detJ;
      const invJ12 = -J12 / detJ;
      const invJ21 = -J21 / detJ;
      const invJ22 = J11 / detJ;

      const B = new Matrix(3, 8);
      for (let i = 0; i < 4; i++) {
        const dNi_dx = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i];
        const dNi_dy = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i];

        B.set(0, 2 * i,     dNi_dx);
        B.set(1, 2 * i + 1, dNi_dy);
        B.set(2, 2 * i,     dNi_dy);
        B.set(2, 2 * i + 1, dNi_dx);
      }

      const strainVec = B.multiplyVector(Array.from(u_e));
      const eps_x = strainVec[0];
      const eps_y = strainVec[1];
      const gam_xy = strainVec[2];

      const stressVec = D.multiplyVector(strainVec);
      const sig_x = stressVec[0];
      const sig_y = stressVec[1];
      const tau_xy = stressVec[2];

      const vmSq = sig_x * sig_x - sig_x * sig_y + sig_y * sig_y + 3 * tau_xy * tau_xy;
      const vm = Math.sqrt(Math.max(0, vmSq));

      const wArea = detJ * gp.weight;
      totalArea += wArea;

      sumEpsilonX += eps_x * wArea;
      sumEpsilonY += eps_y * wArea;
      sumGammaXY += gam_xy * wArea;

      sumSigmaX += sig_x * wArea;
      sumSigmaY += sig_y * wArea;
      sumTauXY += tau_xy * wArea;
      sumVonMises += vm * wArea;

      strainEnergy += 0.5 * (sig_x * eps_x + sig_y * eps_y + tau_xy * gam_xy) * wArea * t;

      integrationResults.push({
        pointIndex: g,
        xi: gp.xi,
        eta: gp.eta,
        weight: gp.weight,
        physicalLocation: { x: physX, y: physY },
        strain: { epsilon_x: eps_x, epsilon_y: eps_y, gamma_xy: gam_xy },
        stress: { sigma_x: sig_x, sigma_y: sig_y, tau_xy: tau_xy },
        vonMisesStress: vm
      });
    }

    const avgEpsX = sumEpsilonX / totalArea;
    const avgEpsY = sumEpsilonY / totalArea;
    const avgGamXY = sumGammaXY / totalArea;

    const avgSigX = sumSigmaX / totalArea;
    const avgSigY = sumSigmaY / totalArea;
    const avgTauXY = sumTauXY / totalArea;
    const avgVm = sumVonMises / totalArea;

    const sigma_avg = (avgSigX + avgSigY) / 2;
    const radius = Math.sqrt(((avgSigX - avgSigY) / 2) ** 2 + avgTauXY ** 2);

    return {
      elementId: element.elementId,
      formulationId: "Q4_2D",
      strain: { epsilon_x: avgEpsX, epsilon_y: avgEpsY, gamma_xy: avgGamXY },
      stress: { sigma_x: avgSigX, sigma_y: avgSigY, tau_xy: avgTauXY },
      integrationPoints: integrationResults,
      vonMisesStress: avgVm,
      principalStresses: { sigma_1: sigma_avg + radius, sigma_2: sigma_avg - radius },
      strainEnergy,
      location: 'INTEGRATION_POINTS',
      units: { strain: 'dimensionless', stress: 'MPa', strainEnergy: 'N*mm' }
    };
  }
}
