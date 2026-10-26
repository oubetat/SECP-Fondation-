/**
 * SECP Industrial OS — Geometrically Nonlinear Mechanics (SECP-FEM-UPGRADE-009)
 * Truss2DFormulation.ts
 * 
 * 2D Truss element with Large Displacement support.
 * Uses Green-Lagrange strain and Saint-Venant-Kirchhoff material model.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementNonlinearResult, ElementStressStrainResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class Truss2DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY];
  }

  /**
   * Linear elastic stiffness matrix for initial assembly or linear analysis.
   */
  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const L0 = Math.sqrt(dx * dx + dy * dy);

    if (L0 <= 0) throw new Error(`[ZERO_LENGTH_ELEMENT] Element ${element.elementId} has zero length.`);

    const E = material.E;
    const A = section.area || 0;
    const k = (E * A) / L0;

    const cos = dx / L0;
    const sin = dy / L0;

    // Standard 2D Truss Ke
    const c2 = cos * cos;
    const s2 = sin * sin;
    const cs = cos * sin;

    const Ke = new Matrix(4, 4, [
      [ k * c2,  k * cs, -k * c2, -k * cs],
      [ k * cs,  k * s2, -k * cs, -k * s2],
      [-k * c2, -k * cs,  k * c2,  k * cs],
      [-k * cs, -k * s2,  k * cs,  k * s2]
    ]);

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX)!;
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY)!;
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX)!;
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY)!;

    return {
      Ke,
      Fe: [0, 0, 0, 0],
      globalDOFs: [dofU1.globalId, dofV1.globalId, dofU2.globalId, dofV2.globalId]
    };
  }

  /**
   * Nonlinear internal force and tangent stiffness.
   * Uses Total Lagrangian formulation.
   */
  computeNonlinearMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementNonlinearResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    const X1 = node1.x, Y1 = node1.y;
    const X2 = node2.x, Y2 = node2.y;
    const DX = X2 - X1;
    const DY = Y2 - Y1;
    const L0 = Math.sqrt(DX * DX + DY * DY);

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX)!;
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY)!;
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX)!;
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY)!;

    const u1 = U[dofU1.globalId];
    const v1 = U[dofV1.globalId];
    const u2 = U[dofU2.globalId];
    const v2 = U[dofV2.globalId];

    const du = u2 - u1;
    const dv = v2 - v1;

    // Green-Lagrange Strain: E = (L^2 - L0^2) / (2 * L0^2)
    // E = (1/L0^2) * (DX*du + DY*dv + 0.5*(du^2 + dv^2))
    const strain = (1.0 / (L0 * L0)) * (DX * du + DY * dv + 0.5 * (du * du + dv * dv));
    
    // 2nd Piola-Kirchhoff Stress
    const stress = material.E * strain;

    const A = section.area || 0;
    const E = material.E;

    // Internal Force Vector: Fint = A * L0 * B^T * S
    // For truss, B^T = (1/L0^2) * [-(DX+du), -(DY+dv), (DX+du), (DY+dv)]^T ?
    // Actually, B = (1/L0^2) * [-(DX+du), -(DY+dv), (DX+du), (DY+dv)]
    const coeff = (A * stress) / L0;
    const f1x = -coeff * (DX + du);
    const f1y = -coeff * (DY + dv);
    const f2x = coeff * (DX + du);
    const f2y = coeff * (DY + dv);

    const Fint = [f1x, f1y, f2x, f2y];

    // Tangent Stiffness Matrix: Kt = Kl + Kg
    // Kl = (E*A / L0^3) * b * b^T  where b = [-(DX+du), -(DY+dv), (DX+du), (DY+dv)]
    const b = [-(DX + du), -(DY + dv), (DX + du), (DY + dv)];
    const Kl_coeff = (E * A) / (L0 * L0 * L0);
    const Kl = new Matrix(4, 4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        Kl.set(i, j, Kl_coeff * b[i] * b[j]);
      }
    }

    // Kg = (S*A / L0) * [1 0 -1 0; 0 1 0 -1; -1 0 1 0; 0 -1 0 1]
    const Kg_coeff = (stress * A) / L0;
    const Kg = new Matrix(4, 4, [
      [ Kg_coeff,        0, -Kg_coeff,        0],
      [        0, Kg_coeff,        0, -Kg_coeff],
      [-Kg_coeff,        0,  Kg_coeff,        0],
      [        0, -Kg_coeff,        0,  Kg_coeff]
    ]);

    const Kt = new Matrix(4, 4);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        Kt.set(i, j, Kl.get(i, j) + Kg.get(i, j));
      }
    }

    return {
      Kt,
      Fint,
      globalDOFs: [dofU1.globalId, dofV1.globalId, dofU2.globalId, dofV2.globalId]
    };
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

    const DX = node2.x - node1.x;
    const DY = node2.y - node1.y;
    const L0 = Math.sqrt(DX * DX + DY * DY);

    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX)!;
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY)!;
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX)!;
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY)!;

    const u1 = U[dofU1.globalId];
    const v1 = U[dofV1.globalId];
    const u2 = U[dofU2.globalId];
    const v2 = U[dofV2.globalId];

    const du = u2 - u1;
    const dv = v2 - v1;

    // Green-Lagrange Strain
    const strain = (1.0 / (L0 * L0)) * (DX * du + DY * dv + 0.5 * (du * du + dv * dv));
    
    // 2nd Piola-Kirchhoff Stress (PK2)
    // Note: For large deformation, we might also want to report Cauchy stress, 
    // but PK2 is consistent with the formulation.
    const stress = material.E * strain;

    const volume = (section.area || 0) * L0;
    const strainEnergy = 0.5 * stress * strain * volume;

    return {
      elementId: element.elementId,
      formulationId: "TRUSS_2D_NL",
      strain: {
        epsilon_x: strain
      },
      stress: {
        sigma_x: stress
      },
      vonMisesStress: Math.abs(stress),
      strainEnergy,
      location: 'CENTROID',
      units: {
        strain: 'dimensionless',
        stress: 'MPa',
        strainEnergy: 'N*mm'
      }
    };
  }
}
