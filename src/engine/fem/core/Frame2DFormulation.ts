/**
 * SECP Industrial OS — Engineering Truth OS
 * Frame2DFormulation.ts
 * 
 * SECP-FEM-UPGRADE-003: 2D Frame Element Formulation.
 * Combines axial and bending stiffness for 2D frame members arbitrarily oriented in x-y plane.
 * Transformation matrix T converts local [u', v', theta'] to global [u, v, theta].
 * Handles uniform transverse distributed load w in local y' direction.
 * Recovers axial force N, shear forces V1, V2, bending moments M1, M2, M_mid, and combined stresses.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class Frame2DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY, DOFComponent.RZ];
  }

  public computeTransformationMatrix(dx: number, dy: number, L: number): Matrix {
    const c = dx / L;
    const s = dy / L;

    return new Matrix(6, 6, [
      [ c,  s, 0,  0,  0, 0],
      [-s,  c, 0,  0,  0, 0],
      [ 0,  0, 1,  0,  0, 0],
      [ 0,  0, 0,  c,  s, 0],
      [ 0,  0, 0, -s,  c, 0],
      [ 0,  0, 0,  0,  0, 1]
    ]);
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const node1 = model.nodes.get(element.nodeIds[0]);
    const node2 = model.nodes.get(element.nodeIds[1]);
    if (!node1 || !node2) {
      throw new Error(`[ELEMENT_NODE_MISSING] Nodes missing for frame element '${element.elementId}'`);
    }

    const material = model.materials.get(element.materialId);
    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E} for element '${element.elementId}'`);
    }

    const section = model.sections.get(element.sectionId);
    if (!section) {
      throw new Error(`[INVALID_SECTION] Section missing for element '${element.elementId}'`);
    }

    const A = section.area ?? 0;
    if (A <= 0 || !Number.isFinite(A)) {
      throw new Error(`[INVALID_SECTION] Frame element '${element.elementId}' requires valid positive area A > 0`);
    }

    const I = section.I ?? section.thickness ?? 0;
    if (I <= 0 || !Number.isFinite(I)) {
      throw new Error(`[INVALID_SECTION] Frame element '${element.elementId}' requires valid positive moment of inertia I > 0`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const L = Math.sqrt(dx * dx + dy * dy);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length frame element '${element.elementId}'`);
    }

    const E = material.E;
    const k_a = (E * A) / L;
    const c1 = (12 * E * I) / (L * L * L);
    const c2 = (6 * E * I) / (L * L);
    const c3 = (4 * E * I) / L;
    const c4 = (2 * E * I) / L;

    // Local 6x6 stiffness matrix
    const Ke_local = new Matrix(6, 6, [
      [ k_a,   0,   0, -k_a,   0,   0],
      [   0,  c1,  c2,    0, -c1,  c2],
      [   0,  c2,  c3,    0, -c2,  c4],
      [-k_a,   0,   0,  k_a,   0,   0],
      [   0, -c1, -c2,    0,  c1, -c2],
      [   0,  c2,  c4,    0, -c2,  c3]
    ]);

    const T = this.computeTransformationMatrix(dx, dy, L);

    // K_global = T^T * K_local * T
    const T_trans = T.transpose();
    const Ke_global = T_trans.multiply(Ke_local).multiply(T);

    // Distributed transverse load w in local y' direction
    const w = element.distributedLoad ?? 0;
    const Fe_local = [
      0,
      (w * L) / 2,
      (w * L * L) / 12,
      0,
      (w * L) / 2,
      -(w * L * L) / 12
    ];

    // Fe_global = T^T * Fe_local
    const Fe_global = T_trans.multiplyVector(Fe_local);

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX);
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY);
    const dofR1 = dofManager.getDOF(node1.nodeId, DOFComponent.RZ);
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX);
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY);
    const dofR2 = dofManager.getDOF(node2.nodeId, DOFComponent.RZ);

    if (!dofU1 || !dofV1 || !dofR1 || !dofU2 || !dofV2 || !dofR2) {
      throw new Error(`[DOF_NOT_FOUND] Missing degrees of freedom for frame element '${element.elementId}'`);
    }

    const globalDOFs = [
      dofU1.globalId,
      dofV1.globalId,
      dofR1.globalId,
      dofU2.globalId,
      dofV2.globalId,
      dofR2.globalId
    ];

    return { Ke: Ke_global, Fe: Array.from(Fe_global), globalDOFs };
  }

  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    if (!material || material.E <= 0 || !Number.isFinite(material.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${material?.E}`);
    }

    const A = section.area ?? 0;
    const I = section.I ?? section.thickness ?? 0;
    if (A <= 0 || I <= 0) {
      throw new Error(`[INVALID_SECTION] Frame element requires valid area A > 0 and I > 0`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const L = Math.sqrt(dx * dx + dy * dy);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length frame element`);
    }

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX)!;
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY)!;
    const dofR1 = dofManager.getDOF(node1.nodeId, DOFComponent.RZ)!;
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX)!;
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY)!;
    const dofR2 = dofManager.getDOF(node2.nodeId, DOFComponent.RZ)!;

    const u1_g = U[dofU1.globalId];
    const v1_g = U[dofV1.globalId];
    const r1_g = U[dofR1.globalId];
    const u2_g = U[dofU2.globalId];
    const v2_g = U[dofV2.globalId];
    const r2_g = U[dofR2.globalId];

    if (![u1_g, v1_g, r1_g, u2_g, v2_g, r2_g].every(Number.isFinite)) {
      throw new Error(`[NUMERICAL_ERROR] Non-finite displacement encountered in Frame2D stress recovery`);
    }

    const T = this.computeTransformationMatrix(dx, dy, L);
    const q_global = [u1_g, v1_g, r1_g, u2_g, v2_g, r2_g];
    const q_local = T.multiplyVector(q_global);

    const u1 = q_local[0];
    const v1 = q_local[1];
    const r1 = q_local[2];
    const u2 = q_local[3];
    const v2 = q_local[4];
    const r2 = q_local[5];

    const E = material.E;
    const k_a = (E * A) / L;
    const c1 = (12 * E * I) / (L * L * L);
    const c2 = (6 * E * I) / (L * L);
    const c3 = (4 * E * I) / L;
    const c4 = (2 * E * I) / L;

    // Axial strain and force
    const epsilon_axial = (u2 - u1) / L;
    const N = E * A * epsilon_axial;
    const sigma_axial = E * epsilon_axial;

    const w = element.distributedLoad ?? 0;

    const f1_v = c1 * v1 + c2 * r1 - c1 * v2 + c2 * r2 - (w * L) / 2;
    const f1_m = c2 * v1 + c3 * r1 - c2 * v2 + c4 * r2 - (w * L * L) / 12;
    const f2_v = -c1 * v1 - c2 * r1 + c1 * v2 - c2 * r2 - (w * L) / 2;
    const f2_m = c2 * v1 + c4 * r1 - c2 * v2 + c3 * r2 + (w * L * L) / 12;

    const V1 = f1_v;
    const M1 = f1_m;
    const V2 = -f2_v;
    const M2 = -f2_m;

    const M_mid = (M1 - M2) / 2 + (w * L * L) / 8;
    const M_max = Math.max(Math.abs(M1), Math.abs(M2), Math.abs(M_mid));

    const y_max = section.iy ?? (section.depth ? section.depth / 2 : Math.sqrt(I / A));
    const sigma_bending = (M_max * y_max) / I;

    const sigma_max = Math.abs(sigma_axial) + sigma_bending;
    const vonMisesStress = sigma_max;

    // Local strain energy
    const Ke_local = new Matrix(6, 6, [
      [ k_a,   0,   0, -k_a,   0,   0],
      [   0,  c1,  c2,    0, -c1,  c2],
      [   0,  c2,  c3,    0, -c2,  c4],
      [-k_a,   0,   0,  k_a,   0,   0],
      [   0, -c1, -c2,    0,  c1, -c2],
      [   0,  c2,  c4,    0, -c2,  c3]
    ]);
    let strainEnergy = 0;
    for (let i = 0; i < 6; i++) {
      let ke_q = 0;
      for (let j = 0; j < 6; j++) {
        ke_q += Ke_local.get(i, j) * q_local[j];
      }
      strainEnergy += 0.5 * q_local[i] * ke_q;
    }

    return {
      elementId: element.elementId,
      formulationId: "FRAME_2D",
      strain: {
        epsilon_x: epsilon_axial
      },
      stress: {
        sigma_x: sigma_max,
        sigma_axial,
        sigma_bending
      },
      internalForces: {
        N,
        V1,
        V2,
        M1,
        M2,
        M_mid
      },
      nodalDisplacementsLocal: {
        u1_local: u1,
        v1_local: v1,
        theta1_local: r1,
        u2_local: u2,
        v2_local: v2,
        theta2_local: r2
      },
      vonMisesStress,
      principalStresses: {
        sigma_1: Math.max(0, sigma_max),
        sigma_2: Math.min(0, -sigma_max)
      },
      strainEnergy,
      location: 'ELEMENT_ENDS',
      units: {
        strain: 'dimensionless',
        stress: 'MPa',
        strainEnergy: 'N*mm'
      }
    };
  }
}
