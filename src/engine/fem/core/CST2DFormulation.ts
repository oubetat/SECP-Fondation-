import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementStressStrainResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class CST2DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const n3 = model.nodes.get(element.nodeIds[2])!;
    const mat = model.materials.get(element.materialId)!;
    const sec = model.sections.get(element.sectionId)!;

    if (!sec || !sec.thickness || sec.thickness <= 0) throw new Error("CST element requires section thickness");
    if (!mat || mat.E <= 0 || !Number.isFinite(mat.E)) throw new Error("Invalid material E");
    if (mat.nu < -1 || mat.nu >= 0.5 || !Number.isFinite(mat.nu)) throw new Error("Invalid material nu");

    const x1 = n1.x, y1 = n1.y;
    const x2 = n2.x, y2 = n2.y;
    const x3 = n3.x, y3 = n3.y;

    const detJ = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const Area = detJ / 2;

    if (Area <= 0 || !Number.isFinite(Area)) throw new Error("Element orientation invalid or zero volume (Negative Jacobian)");

    const b1 = y2 - y3;
    const b2 = y3 - y1;
    const b3 = y1 - y2;
    const c1 = x3 - x2;
    const c2 = x1 - x3;
    const c3 = x2 - x1;

    // B matrix (3x6)
    const B = new Matrix(3, 6, [
      [b1, 0, b2, 0, b3, 0],
      [0, c1, 0, c2, 0, c3],
      [c1, b1, c2, b2, c3, b3]
    ]).scale(1 / detJ);

    // D matrix for Plane Stress
    const E = mat.E;
    const nu = mat.nu;
    const factor = E / (1 - nu * nu);
    const D = new Matrix(3, 3, [
      [1, nu, 0],
      [nu, 1, 0],
      [0, 0, (1 - nu) / 2]
    ]).scale(factor);

    // Ke = B^T * D * B * Area * thickness
    const Bt = B.transpose();
    const BtD = Bt.multiply(D);
    let Ke = BtD.multiply(B);
    Ke = Ke.scale(Area * sec.thickness);

    const globalDOFs = [
      dofManager.getDOF(n1.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n1.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UY)!.globalId,
    ];

    return { Ke, Fe: new Array(6).fill(0), globalDOFs };
  }

  computeStressStrain(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const n3 = model.nodes.get(element.nodeIds[2])!;
    const mat = model.materials.get(element.materialId)!;
    const sec = model.sections.get(element.sectionId)!;

    if (!mat || mat.E <= 0 || !Number.isFinite(mat.E)) {
      throw new Error(`[INVALID_MATERIAL] Invalid material Young's modulus E=${mat?.E}`);
    }
    if (mat.nu < -1 || mat.nu >= 0.5 || !Number.isFinite(mat.nu)) {
      throw new Error(`[INVALID_MATERIAL] Invalid Poisson ratio nu=${mat?.nu}`);
    }
    if (!sec || !sec.thickness || sec.thickness <= 0) {
      throw new Error("[INVALID_SECTION] CST element requires valid positive thickness");
    }

    const x1 = n1.x, y1 = n1.y;
    const x2 = n2.x, y2 = n2.y;
    const x3 = n3.x, y3 = n3.y;

    const detJ = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const Area = detJ / 2;

    if (Area <= 0 || !Number.isFinite(Area)) {
      throw new Error("[NEGATIVE_JACOBIAN] CST element has invalid orientation or zero area");
    }

    const b1 = y2 - y3;
    const b2 = y3 - y1;
    const b3 = y1 - y2;
    const c1 = x3 - x2;
    const c2 = x1 - x3;
    const c3 = x2 - x1;

    // Strain-Displacement matrix B (3x6)
    const B = new Matrix(3, 6, [
      [b1, 0, b2, 0, b3, 0],
      [0, c1, 0, c2, 0, c3],
      [c1, b1, c2, b2, c3, b3]
    ]).scale(1 / detJ);

    // Constitutive matrix D (Plane Stress)
    const E = mat.E;
    const nu = mat.nu;
    const factor = E / (1 - nu * nu);
    const D = new Matrix(3, 3, [
      [1, nu, 0],
      [nu, 1, 0],
      [0, 0, (1 - nu) / 2]
    ]).scale(factor);

    // Extract element nodal displacements: u_e = [u1x, u1y, u2x, u2y, u3x, u3y]
    const u1x = U[dofManager.getDOF(n1.nodeId, DOFComponent.UX)!.globalId];
    const u1y = U[dofManager.getDOF(n1.nodeId, DOFComponent.UY)!.globalId];
    const u2x = U[dofManager.getDOF(n2.nodeId, DOFComponent.UX)!.globalId];
    const u2y = U[dofManager.getDOF(n2.nodeId, DOFComponent.UY)!.globalId];
    const u3x = U[dofManager.getDOF(n3.nodeId, DOFComponent.UX)!.globalId];
    const u3y = U[dofManager.getDOF(n3.nodeId, DOFComponent.UY)!.globalId];

    const u_e = [u1x, u1y, u2x, u2y, u3x, u3y];
    for (let i = 0; i < 6; i++) {
      if (!Number.isFinite(u_e[i])) {
        throw new Error(`[NUMERICAL_ERROR] Non-finite displacement encountered in CST2D: u_e[${i}]=${u_e[i]}`);
      }
    }

    // Kinematic Strain: epsilon = B * u_e
    const strainVec = B.multiplyVector(u_e);
    const epsilon_x = strainVec[0];
    const epsilon_y = strainVec[1];
    const gamma_xy = strainVec[2];

    // Constitutive Stress: sigma = D * epsilon
    const stressVec = D.multiplyVector(strainVec);
    const sigma_x = stressVec[0];
    const sigma_y = stressVec[1];
    const tau_xy = stressVec[2];

    // Principal Stresses
    const sigma_avg = (sigma_x + sigma_y) / 2;
    const radius = Math.sqrt(((sigma_x - sigma_y) / 2) ** 2 + tau_xy ** 2);
    const sigma_1 = sigma_avg + radius;
    const sigma_2 = sigma_avg - radius;

    // Von Mises Equivalent Stress: sqrt(sigma_x^2 - sigma_x*sigma_y + sigma_y^2 + 3*tau_xy^2)
    const vmSq = sigma_x * sigma_x - sigma_x * sigma_y + sigma_y * sigma_y + 3 * tau_xy * tau_xy;
    const vonMisesStress = Math.sqrt(Math.max(0, vmSq));

    // Element Strain Energy: 0.5 * (sigma : epsilon) * Volume
    const volume = Area * sec.thickness;
    const strainEnergy = 0.5 * (sigma_x * epsilon_x + sigma_y * epsilon_y + tau_xy * gamma_xy) * volume;

    return {
      elementId: element.elementId,
      formulationId: "CST_2D",
      strain: {
        epsilon_x,
        epsilon_y,
        gamma_xy
      },
      stress: {
        sigma_x,
        sigma_y,
        tau_xy
      },
      vonMisesStress,
      principalStresses: {
        sigma_1,
        sigma_2
      },
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
