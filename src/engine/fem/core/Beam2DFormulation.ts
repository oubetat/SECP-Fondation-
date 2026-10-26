/**
 * SECP Industrial OS — Engineering Truth OS
 * Beam2DFormulation.ts
 * 
 * SECP-FEM-UPGRADE-003: 2D Euler-Bernoulli Beam Element Formulation.
 * 2 nodes, 3 DOFs per node [UX, UY, RZ].
 * Handles axial stiffness (EA/L) and transverse bending stiffness (12EI/L^3, 6EI/L^2, 4EI/L, 2EI/L).
 * Computes exact internal forces (N, V1, V2, M1, M2, M_mid) and bending/axial stresses.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class Beam2DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY, DOFComponent.RZ];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const node1 = model.nodes.get(element.nodeIds[0]);
    const node2 = model.nodes.get(element.nodeIds[1]);
    if (!node1 || !node2) {
      throw new Error(`[ELEMENT_NODE_MISSING] Nodes missing for beam element '${element.elementId}'`);
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
      throw new Error(`[INVALID_SECTION] Beam element '${element.elementId}' requires valid positive area A > 0`);
    }

    const I = section.I ?? section.thickness ?? 0; // Moment of inertia I
    if (I <= 0 || !Number.isFinite(I)) {
      throw new Error(`[INVALID_SECTION] Beam element '${element.elementId}' requires valid positive moment of inertia I > 0`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero or invalid length for beam element '${element.elementId}'`);
    }

    const E = material.E;
    const k_a = (E * A) / L; // Axial stiffness
    const c1 = (12 * E * I) / (L * L * L);
    const c2 = (6 * E * I) / (L * L);
    const c3 = (4 * E * I) / L;
    const c4 = (2 * E * I) / L;

    // Local 6x6 stiffness matrix
    // DOFs: [u1, v1, theta1, u2, v2, theta2]
    const Ke = new Matrix(6, 6, [
      [ k_a,   0,   0, -k_a,   0,   0],
      [   0,  c1,  c2,    0, -c1,  c2],
      [   0,  c2,  c3,    0, -c2,  c4],
      [-k_a,   0,   0,  k_a,   0,   0],
      [   0, -c1, -c2,    0,  c1, -c2],
      [   0,  c2,  c4,    0, -c2,  c3]
    ]);

    // Distributed transverse load w (N/mm or N/m in local y direction)
    const w = element.distributedLoad ?? 0;
    const Fe = [
      0,
      (w * L) / 2,
      (w * L * L) / 12,
      0,
      (w * L) / 2,
      -(w * L * L) / 12
    ];

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX);
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY);
    const dofR1 = dofManager.getDOF(node1.nodeId, DOFComponent.RZ);
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX);
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY);
    const dofR2 = dofManager.getDOF(node2.nodeId, DOFComponent.RZ);

    if (!dofU1 || !dofV1 || !dofR1 || !dofU2 || !dofV2 || !dofR2) {
      throw new Error(`[DOF_NOT_FOUND] Missing degrees of freedom for beam element '${element.elementId}'`);
    }

    const globalDOFs = [
      dofU1.globalId,
      dofV1.globalId,
      dofR1.globalId,
      dofU2.globalId,
      dofV2.globalId,
      dofR2.globalId
    ];

    return { Ke, Fe, globalDOFs };
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
      throw new Error(`[INVALID_SECTION] Beam element requires valid area A > 0 and I > 0`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length beam element`);
    }

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX)!;
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY)!;
    const dofR1 = dofManager.getDOF(node1.nodeId, DOFComponent.RZ)!;
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX)!;
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY)!;
    const dofR2 = dofManager.getDOF(node2.nodeId, DOFComponent.RZ)!;

    const u1 = U[dofU1.globalId];
    const v1 = U[dofV1.globalId];
    const r1 = U[dofR1.globalId];
    const u2 = U[dofU2.globalId];
    const v2 = U[dofV2.globalId];
    const r2 = U[dofR2.globalId];

    if (![u1, v1, r1, u2, v2, r2].every(Number.isFinite)) {
      throw new Error(`[NUMERICAL_ERROR] Non-finite displacement encountered in Beam2D stress recovery`);
    }

    const E = material.E;

    // Axial strain and force
    const cx = dx !== 0 ? Math.sign(dx) : 1.0;
    const epsilon_axial = (cx * (u2 - u1)) / L;
    const N = E * A * epsilon_axial;
    const sigma_axial = E * epsilon_axial;

    // Internal bending moments and shear forces
    const w = element.distributedLoad ?? 0;

    const c1 = (12 * E * I) / (L * L * L);
    const c2 = (6 * E * I) / (L * L);
    const c3 = (4 * E * I) / L;
    const c4 = (2 * E * I) / L;

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

    // Strain energy
    const q = [u1, v1, r1, u2, v2, r2];
    const Ke = new Matrix(6, 6, [
      [ (E*A)/L, 0, 0, -(E*A)/L, 0, 0],
      [ 0, c1, c2, 0, -c1, c2],
      [ 0, c2, c3, 0, -c2, c4],
      [ -(E*A)/L, 0, 0, (E*A)/L, 0, 0],
      [ 0, -c1, -c2, 0, c1, -c2],
      [ 0, c2, c4, 0, -c2, c3]
    ]);
    let strainEnergy = 0;
    for (let i = 0; i < 6; i++) {
      let ke_q = 0;
      for (let j = 0; j < 6; j++) {
        ke_q += Ke.get(i, j) * q[j];
      }
      strainEnergy += 0.5 * q[i] * ke_q;
    }

    return {
      elementId: element.elementId,
      formulationId: "BEAM_2D",
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
