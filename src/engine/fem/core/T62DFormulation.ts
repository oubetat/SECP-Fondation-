/**
 * SECP Industrial OS — Engineering Truth OS
 * T62DFormulation.ts
 * 
 * SECP-FEM-UPGRADE-004: 6-Node Quadratic Triangular Continuum Element (T6_2D).
 * 6 nodes per element, 2 DOFs per node [UX, UY] (12 DOFs total).
 * Quadratic area-coordinate shape functions N1..N6.
 * Exact 3-point Gauss-Legendre quadrature numerical integration for triangles.
 * Computes strain-displacement B-matrix from actual element geometry via Jacobian J.
 * Supports Plane Stress material model and integration-point stress/strain field recovery.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel, IntegrationPointResult } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class T62DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY];
  }

  /**
   * Evaluates quadratic shape functions N_1 .. N_6 at natural coordinates (xi, eta).
   */
  public evaluateShapeFunctions(xi: number, eta: number): number[] {
    const L1 = 1 - xi - eta;
    const L2 = xi;
    const L3 = eta;

    return [
      L1 * (2 * L1 - 1), // N1 (corner 1)
      L2 * (2 * L2 - 1), // N2 (corner 2)
      L3 * (2 * L3 - 1), // N3 (corner 3)
      4 * L1 * L2,       // N4 (midedge 1-2)
      4 * L2 * L3,       // N5 (midedge 2-3)
      4 * L3 * L1        // N6 (midedge 3-1)
    ];
  }

  /**
   * Evaluates derivatives of shape functions w.r.t. natural coordinates (xi, eta).
   * Returns array of [dN_dxi, dN_deta] for each node i = 0..5.
   */
  public evaluateShapeDerivatives(xi: number, eta: number): { dN_dxi: number[]; dN_deta: number[] } {
    const dN_dxi = [
      4 * xi + 4 * eta - 3, // dN1/dxi
      4 * xi - 1,          // dN2/dxi
      0,                   // dN3/dxi
      4 - 8 * xi - 4 * eta,// dN4/dxi
      4 * eta,             // dN5/dxi
      -4 * eta             // dN6/dxi
    ];

    const dN_deta = [
      4 * xi + 4 * eta - 3, // dN1/deta
      0,                   // dN2/deta
      4 * eta - 1,         // dN3/deta
      -4 * xi,             // dN4/deta
      4 * xi,              // dN5/deta
      4 - 4 * xi - 8 * eta // dN6/deta
    ];

    return { dN_dxi, dN_deta };
  }

  /**
   * 3-point Gauss quadrature rule for standard unit triangle (0 <= xi + eta <= 1).
   */
  public getGaussPoints(): { xi: number; eta: number; weight: number }[] {
    return [
      { xi: 1 / 6, eta: 1 / 6, weight: 1 / 6 },
      { xi: 2 / 3, eta: 1 / 6, weight: 1 / 6 },
      { xi: 1 / 6, eta: 2 / 3, weight: 1 / 6 }
    ];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    if (!element.nodeIds || element.nodeIds.length < 6) {
      throw new Error(`[INVALID_ELEMENT_NODES] T6 element '${element.elementId}' requires 6 nodes.`);
    }

    const nodes = element.nodeIds.map(id => model.nodes.get(id));
    if (nodes.some(n => !n)) {
      throw new Error(`[ELEMENT_NODE_MISSING] Missing node definition for T6 element '${element.elementId}'`);
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
      throw new Error(`[INVALID_SECTION] T6 element '${element.elementId}' requires valid positive section thickness`);
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

    const Ke = new Matrix(12, 12);
    const gaussPoints = this.getGaussPoints();

    for (const gp of gaussPoints) {
      const { dN_dxi, dN_deta } = this.evaluateShapeDerivatives(gp.xi, gp.eta);

      // Compute Jacobian matrix J = [ dx/dxi  dy/dxi ; dx/deta dy/deta ]
      let J11 = 0, J12 = 0, J21 = 0, J22 = 0;
      for (let i = 0; i < 6; i++) {
        J11 += dN_dxi[i] * x[i];
        J12 += dN_dxi[i] * y[i];
        J21 += dN_deta[i] * x[i];
        J22 += dN_deta[i] * y[i];
      }

      const detJ = J11 * J22 - J12 * J21;
      if (detJ <= 1e-12 || !Number.isFinite(detJ)) {
        throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] Non-positive or degenerate Jacobian (detJ=${detJ}) in T6 element '${element.elementId}'`);
      }

      const invJ11 = J22 / detJ;
      const invJ12 = -J12 / detJ;
      const invJ21 = -J21 / detJ;
      const invJ22 = J11 / detJ;

      // Construct B matrix (3x12)
      const B = new Matrix(3, 12);
      for (let i = 0; i < 6; i++) {
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

      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 12; c++) {
          Ke.add(r, c, BtDB.get(r, c) * scale);
        }
      }
    }

    const globalDOFs: number[] = [];
    for (let i = 0; i < 6; i++) {
      const nodeId = element.nodeIds[i];
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX);
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY);
      if (!dofX || !dofY) {
        throw new Error(`[DOF_NOT_FOUND] Missing degrees of freedom for T6 element node '${nodeId}'`);
      }
      globalDOFs.push(dofX.globalId);
      globalDOFs.push(dofY.globalId);
    }

    return { Ke, Fe: new Array(12).fill(0), globalDOFs };
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
      throw new Error("[INVALID_SECTION] T6 element requires valid positive thickness");
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

    const u_e = new Float64Array(12);
    for (let i = 0; i < 6; i++) {
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
      for (let i = 0; i < 6; i++) {
        J11 += dN_dxi[i] * x[i];
        J12 += dN_dxi[i] * y[i];
        J21 += dN_deta[i] * x[i];
        J22 += dN_deta[i] * y[i];
        physX += N[i] * x[i];
        physY += N[i] * y[i];
      }

      const detJ = J11 * J22 - J12 * J21;
      if (detJ <= 1e-12) {
        throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] Non-positive Jacobian in T6 element`);
      }

      const invJ11 = J22 / detJ;
      const invJ12 = -J12 / detJ;
      const invJ21 = -J21 / detJ;
      const invJ22 = J11 / detJ;

      const B = new Matrix(3, 12);
      for (let i = 0; i < 6; i++) {
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

      // Incremental strain energy
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
      formulationId: "T6_2D",
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
