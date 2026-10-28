/**
 * SECP Industrial OS — Engineering Truth OS
 * TET43DFormulation.ts
 * 
 * SECP-FEM-UPGRADE-005: 4-Node Linear Tetrahedral 3D Continuum Solid Element (TET4_3D).
 * 4 nodes per element, 3 DOFs per node [UX, UY, UZ] (12 DOFs total).
 * Constant Strain Tetrahedral formulation with 3D isotropic elasticity.
 * Exact 3D Jacobian determinant volume integration and degenerate element protection.
 * Recovers full 3D strain tensor [eps_x, eps_y, eps_z, gam_xy, gam_yz, gam_xz],
 * 3D Cauchy stress tensor [sig_x, sig_y, sig_z, tau_xy, tau_yz, tau_xz],
 * 3D Von Mises equivalent stress, and 3D Principal stresses (sigma_1 >= sigma_2 >= sigma_3).
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel, IntegrationPointResult } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { CoordinateFrameTransformEngine } from "./GeometryMaterialAssignment";

export class TET43DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY, DOFComponent.UZ];
  }

  private resolveEvaluationPoint(
    element: FEMElement,
    model: FEMModel,
    globalPoint: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    let frame = model.geometryMetadata?.coordinateFrame;
    if (model.materialAssignments) {
      if (element.assignmentId && model.materialAssignments.has(element.assignmentId)) {
        frame = model.materialAssignments.get(element.assignmentId)!.coordinateFrame;
      } else {
        for (const assignment of model.materialAssignments.values()) {
          if (assignment.spatialFieldId === element.spatialFieldId) {
            frame = assignment.coordinateFrame;
            break;
          }
        }
      }
    }
    if (frame && frame.frameType !== 'GLOBAL_CARTESIAN') {
      return CoordinateFrameTransformEngine.toLocal(globalPoint, frame);
    }
    return globalPoint;
  }

  /**
   * Evaluates shape functions N1..N4 at local parametric coordinates (xi, eta, zeta).
   */
  public evaluateShapeFunctions(xi: number, eta: number, zeta: number): number[] {
    return [
      1 - xi - eta - zeta, // N1
      xi,                  // N2
      eta,                 // N3
      zeta                 // N4
    ];
  }

  /**
   * Evaluates shape function derivatives w.r.t local parametric coordinates (xi, eta, zeta).
   */
  public evaluateShapeDerivatives(): { dN_dxi: number[]; dN_deta: number[]; dN_dzeta: number[] } {
    return {
      dN_dxi:   [-1, 1, 0, 0],
      dN_deta:  [-1, 0, 1, 0],
      dN_dzeta: [-1, 0, 0, 1]
    };
  }

  /**
   * Computes 3D Isotropic Elasticity Constitutive Matrix D (6x6).
   */
  public computeConstitutiveMatrixD(E: number, nu: number): Matrix {
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    const D = new Matrix(6, 6);

    const c11 = (1 - nu) * factor;
    const c12 = nu * factor;
    const c44 = 0.5 * (1 - 2 * nu) * factor;

    D.set(0, 0, c11); D.set(0, 1, c12); D.set(0, 2, c12);
    D.set(1, 0, c12); D.set(1, 1, c11); D.set(1, 2, c12);
    D.set(2, 0, c12); D.set(2, 1, c12); D.set(2, 2, c11);

    D.set(3, 3, c44);
    D.set(4, 4, c44);
    D.set(5, 5, c44);

    return D;
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    if (!element.nodeIds || element.nodeIds.length < 4) {
      throw new Error(`[INVALID_ELEMENT_NODES] TET4_3D element '${element.elementId}' requires 4 nodes.`);
    }

    const nodes = element.nodeIds.map(id => model.nodes.get(id));
    if (nodes.some(n => !n)) {
      throw new Error(`[ELEMENT_NODE_MISSING] Missing node definition for TET4_3D element '${element.elementId}'`);
    }

    const material = model.materials.get(element.materialId);
    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Young's modulus E=${material?.E} for element '${element.elementId}'`);
    }
    if (material.nu < -1 || material.nu >= 0.5 || !Number.isFinite(material.nu)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Poisson ratio nu=${material?.nu} for element '${element.elementId}'`);
    }

    const x = nodes.map(n => n!.x);
    const y = nodes.map(n => n!.y);
    const z = nodes.map(n => n!.z);

    let E = material.E;
    let nu = material.nu;
    if (element.spatialFieldId) {
      if (!model.spatialMaterialFields || !model.spatialMaterialFields.has(element.spatialFieldId)) {
        throw new Error(`[SPATIAL_FIELD_NOT_FOUND] Spatial material field '${element.spatialFieldId}' not found in model for element '${element.elementId}'.`);
      }
      const field = model.spatialMaterialFields.get(element.spatialFieldId)!;
      if (field.baseMaterialId && field.baseMaterialId !== element.materialId) {
        throw new Error(`[SPATIAL_FIELD_MATERIAL_MISMATCH] Field base material '${field.baseMaterialId}' does not match element material '${element.materialId}' on element '${element.elementId}'.`);
      }
      const cx = (x[0] + x[1] + x[2] + x[3]) / 4.0;
      const cy = (y[0] + y[1] + y[2] + y[3]) / 4.0;
      const cz = (z[0] + z[1] + z[2] + z[3]) / 4.0;
      const evalPoint = this.resolveEvaluationPoint(element, model, { x: cx, y: cy, z: cz });
      const props = field.evaluate(evalPoint);
      if (props.E === undefined) {
        throw new Error(`[SPATIAL_FIELD_MISSING_PROPERTY] Spatial field '${element.spatialFieldId}' does not define mandatory property 'E' required by TET43DFormulation for element '${element.elementId}'.`);
      }
      if (props.E <= 0 || !Number.isFinite(props.E)) {
        throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Young's modulus E=${props.E} at evaluation point on element '${element.elementId}'.`);
      }
      E = props.E;
      if (props.nu !== undefined) {
        if (props.nu < -1 || props.nu >= 0.5 || !Number.isFinite(props.nu)) {
          throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Poisson ratio nu=${props.nu} at evaluation point on element '${element.elementId}'.`);
        }
        nu = props.nu;
      }
    }

    // 3D Jacobian matrix J = [ x2-x1  y2-y1  z2-z1 ; x3-x1 y3-y1 z3-z1 ; x4-x1 y4-y1 z4-z1 ]
    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];

    const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);

    if (detJ <= 1e-12 || !Number.isFinite(detJ)) {
      throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] TET4_3D element '${element.elementId}' is degenerate or inverted (detJ = ${detJ}).`);
    }

    const invDetJ = 1.0 / detJ;
    const invJ11 = (J22 * J33 - J23 * J32) * invDetJ;
    const invJ12 = (J13 * J32 - J12 * J33) * invDetJ;
    const invJ13 = (J12 * J23 - J13 * J22) * invDetJ;

    const invJ21 = (J23 * J31 - J21 * J33) * invDetJ;
    const invJ22 = (J11 * J33 - J13 * J31) * invDetJ;
    const invJ23 = (J13 * J21 - J11 * J23) * invDetJ;

    const invJ31 = (J21 * J32 - J22 * J31) * invDetJ;
    const invJ32 = (J12 * J31 - J11 * J32) * invDetJ;
    const invJ33 = (J11 * J22 - J12 * J21) * invDetJ;

    const { dN_dxi, dN_deta, dN_dzeta } = this.evaluateShapeDerivatives();

    // Construct constant B matrix (6x12)
    const B = new Matrix(6, 12);
    for (let i = 0; i < 4; i++) {
      const dNi_dx = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i] + invJ13 * dN_dzeta[i];
      const dNi_dy = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i] + invJ23 * dN_dzeta[i];
      const dNi_dz = invJ31 * dN_dxi[i] + invJ32 * dN_deta[i] + invJ33 * dN_dzeta[i];

      const col = 3 * i;
      // eps_x = du/dx
      B.set(0, col,     dNi_dx);
      // eps_y = dv/dy
      B.set(1, col + 1, dNi_dy);
      // eps_z = dw/dz
      B.set(2, col + 2, dNi_dz);
      // gam_xy = du/dy + dv/dx
      B.set(3, col,     dNi_dy);
      B.set(3, col + 1, dNi_dx);
      // gam_yz = dv/dz + dw/dy
      B.set(4, col + 1, dNi_dz);
      B.set(4, col + 2, dNi_dy);
      // gam_xz = du/dz + dw/dx
      B.set(5, col,     dNi_dz);
      B.set(5, col + 2, dNi_dx);
    }

    const D = this.computeConstitutiveMatrixD(E, nu);
    const volume = detJ / 6.0;

    // Ke = B^T * D * B * volume
    const Bt = B.transpose();
    const BtD = Bt.multiply(D);
    const Ke = BtD.multiply(B).scale(volume);

    const globalDOFs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const nodeId = element.nodeIds[i];
      const dofX = dofManager.getDOF(nodeId, DOFComponent.UX);
      const dofY = dofManager.getDOF(nodeId, DOFComponent.UY);
      const dofZ = dofManager.getDOF(nodeId, DOFComponent.UZ);

      if (!dofX || !dofY || !dofZ) {
        throw new Error(`[DOF_NOT_FOUND] Missing 3D degrees of freedom for TET4_3D element node '${nodeId}'`);
      }
      globalDOFs.push(dofX.globalId);
      globalDOFs.push(dofY.globalId);
      globalDOFs.push(dofZ.globalId);
    }

    return { Ke, Fe: new Array(12).fill(0), globalDOFs };
  }

  /**
   * Calculates 3D Principal Stresses (sigma_1 >= sigma_2 >= sigma_3) analytically.
   */
  public compute3DPrincipalStresses(
    sig_x: number, sig_y: number, sig_z: number,
    tau_xy: number, tau_yz: number, tau_xz: number
  ): { sigma_1: number; sigma_2: number; sigma_3: number } {
    const I1 = sig_x + sig_y + sig_z;
    const I2 = sig_x * sig_y + sig_y * sig_z + sig_z * sig_x - tau_xy * tau_xy - tau_yz * tau_yz - tau_xz * tau_xz;
    const I3 = sig_x * (sig_y * sig_z - tau_yz * tau_yz) -
               tau_xy * (tau_xy * sig_z - tau_yz * tau_xz) +
               tau_xz * (tau_xy * tau_yz - sig_y * tau_xz);

    const q = I1 / 3.0;
    const p2 = (sig_x - q) ** 2 + (sig_y - q) ** 2 + (sig_z - q) ** 2 + 2 * (tau_xy ** 2 + tau_yz ** 2 + tau_xz ** 2);
    const p = Math.sqrt(p2 / 6.0);

    if (p < 1e-12) {
      return { sigma_1: sig_x, sigma_2: sig_x, sigma_3: sig_x };
    }

    const s_xx = sig_x - q, s_yy = sig_y - q, s_zz = sig_z - q;
    const detDev = s_xx * (s_yy * s_zz - tau_yz * tau_yz) -
                   tau_xy * (tau_xy * s_zz - tau_yz * tau_xz) +
                   tau_xz * (tau_xy * tau_yz - s_yy * tau_xz);

    let r = detDev / (2.0 * p * p * p);
    r = Math.max(-1.0, Math.min(1.0, r)); // Clamp to [-1, 1]

    const phi = Math.acos(r) / 3.0;

    const eig1 = q + 2.0 * p * Math.cos(phi);
    const eig3 = q + 2.0 * p * Math.cos(phi + (2.0 * Math.PI / 3.0));
    const eig2 = 3.0 * q - eig1 - eig3;

    const values = [eig1, eig2, eig3].sort((a, b) => b - a);

    return {
      sigma_1: values[0],
      sigma_2: values[1],
      sigma_3: values[2]
    };
  }

  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;

    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E}`);
    }
    if (material.nu < -1 || material.nu >= 0.5 || !Number.isFinite(material.nu)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Poisson ratio nu=${material?.nu}`);
    }

    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    let E = material.E;
    let nu = material.nu;
    if (element.spatialFieldId) {
      if (!model.spatialMaterialFields || !model.spatialMaterialFields.has(element.spatialFieldId)) {
        throw new Error(`[SPATIAL_FIELD_NOT_FOUND] Spatial material field '${element.spatialFieldId}' not found in model for element '${element.elementId}'.`);
      }
      const field = model.spatialMaterialFields.get(element.spatialFieldId)!;
      if (field.baseMaterialId && field.baseMaterialId !== element.materialId) {
        throw new Error(`[SPATIAL_FIELD_MATERIAL_MISMATCH] Field base material '${field.baseMaterialId}' does not match element material '${element.materialId}' on element '${element.elementId}'.`);
      }
      const cx = (x[0] + x[1] + x[2] + x[3]) / 4.0;
      const cy = (y[0] + y[1] + y[2] + y[3]) / 4.0;
      const cz = (z[0] + z[1] + z[2] + z[3]) / 4.0;
      const evalPoint = this.resolveEvaluationPoint(element, model, { x: cx, y: cy, z: cz });
      const props = field.evaluate(evalPoint);
      if (props.E === undefined) {
        throw new Error(`[SPATIAL_FIELD_MISSING_PROPERTY] Spatial field '${element.spatialFieldId}' does not define mandatory property 'E' required by TET43DFormulation for element '${element.elementId}'.`);
      }
      if (props.E <= 0 || !Number.isFinite(props.E)) {
        throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Young's modulus E=${props.E} at evaluation point on element '${element.elementId}'.`);
      }
      E = props.E;
      if (props.nu !== undefined) {
        if (props.nu < -1 || props.nu >= 0.5 || !Number.isFinite(props.nu)) {
          throw new Error(`[INVALID_SPATIAL_FIELD_PROPERTY] Spatial field '${element.spatialFieldId}' evaluated to invalid Poisson ratio nu=${props.nu} at evaluation point on element '${element.elementId}'.`);
        }
        nu = props.nu;
      }
    }

    const u_e = new Float64Array(12);
    for (let i = 0; i < 4; i++) {
      const dofX = dofManager.getDOF(nodes[i].nodeId, DOFComponent.UX)!;
      const dofY = dofManager.getDOF(nodes[i].nodeId, DOFComponent.UY)!;
      const dofZ = dofManager.getDOF(nodes[i].nodeId, DOFComponent.UZ)!;

      u_e[3 * i]     = U[dofX.globalId];
      u_e[3 * i + 1] = U[dofY.globalId];
      u_e[3 * i + 2] = U[dofZ.globalId];
    }

    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];

    const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);

    if (detJ <= 1e-12) {
      throw new Error(`[INVERTED_OR_DEGENERATE_ELEMENT] Non-positive Jacobian (detJ=${detJ}) in TET4_3D element`);
    }

    const invDetJ = 1.0 / detJ;
    const invJ11 = (J22 * J33 - J23 * J32) * invDetJ;
    const invJ12 = (J13 * J32 - J12 * J33) * invDetJ;
    const invJ13 = (J12 * J23 - J13 * J22) * invDetJ;

    const invJ21 = (J23 * J31 - J21 * J33) * invDetJ;
    const invJ22 = (J11 * J33 - J13 * J31) * invDetJ;
    const invJ23 = (J13 * J21 - J11 * J23) * invDetJ;

    const invJ31 = (J21 * J32 - J22 * J31) * invDetJ;
    const invJ32 = (J12 * J31 - J11 * J32) * invDetJ;
    const invJ33 = (J11 * J22 - J12 * J21) * invDetJ;

    const { dN_dxi, dN_deta, dN_dzeta } = this.evaluateShapeDerivatives();

    const B = new Matrix(6, 12);
    for (let i = 0; i < 4; i++) {
      const dNi_dx = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i] + invJ13 * dN_dzeta[i];
      const dNi_dy = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i] + invJ23 * dN_dzeta[i];
      const dNi_dz = invJ31 * dN_dxi[i] + invJ32 * dN_deta[i] + invJ33 * dN_dzeta[i];

      const col = 3 * i;
      B.set(0, col,     dNi_dx);
      B.set(1, col + 1, dNi_dy);
      B.set(2, col + 2, dNi_dz);
      B.set(3, col,     dNi_dy);
      B.set(3, col + 1, dNi_dx);
      B.set(4, col + 1, dNi_dz);
      B.set(4, col + 2, dNi_dy);
      B.set(5, col,     dNi_dz);
      B.set(5, col + 2, dNi_dx);
    }

    const D = this.computeConstitutiveMatrixD(E, nu);
    const strainVec = B.multiplyVector(Array.from(u_e));
    const stressVec = D.multiplyVector(strainVec);

    const eps_x = strainVec[0];
    const eps_y = strainVec[1];
    const eps_z = strainVec[2];
    const gam_xy = strainVec[3];
    const gam_yz = strainVec[4];
    const gam_xz = strainVec[5];

    const sig_x = stressVec[0];
    const sig_y = stressVec[1];
    const sig_z = stressVec[2];
    const tau_xy = stressVec[3];
    const tau_yz = stressVec[4];
    const tau_xz = stressVec[5];

    // 3D Von Mises Stress
    const vmSq = 0.5 * (
      (sig_x - sig_y) ** 2 +
      (sig_y - sig_z) ** 2 +
      (sig_z - sig_x) ** 2 +
      6.0 * (tau_xy ** 2 + tau_yz ** 2 + tau_xz ** 2)
    );
    const vonMisesStress = Math.sqrt(Math.max(0, vmSq));

    const principalStresses = this.compute3DPrincipalStresses(sig_x, sig_y, sig_z, tau_xy, tau_yz, tau_xz);
    const volume = detJ / 6.0;

    // Strain Energy: 0.5 * sigma^T * epsilon * volume
    let dotProd = 0;
    for (let k = 0; k < 6; k++) {
      dotProd += stressVec[k] * strainVec[k];
    }
    const strainEnergy = 0.5 * dotProd * volume;

    // Centroid physical location
    const centroidX = (x[0] + x[1] + x[2] + x[3]) / 4.0;
    const centroidY = (y[0] + y[1] + y[2] + y[3]) / 4.0;
    const centroidZ = (z[0] + z[1] + z[2] + z[3]) / 4.0;

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
      formulationId: "TET4_3D",
      strain: { epsilon_x: eps_x, epsilon_y: eps_y, epsilon_z: eps_z, gamma_xy: gam_xy, gamma_yz: gam_yz, gamma_xz: gam_xz },
      stress: { sigma_x: sig_x, sigma_y: sig_y, sigma_z: sig_z, tau_xy: tau_xy, tau_yz: tau_yz, tau_xz: tau_xz },
      integrationPoints: [integrationPoint],
      vonMisesStress,
      principalStresses,
      strainEnergy,
      location: 'CENTROID',
      units: { strain: 'dimensionless', stress: 'MPa', strainEnergy: 'N*mm' }
    };
  }
}
