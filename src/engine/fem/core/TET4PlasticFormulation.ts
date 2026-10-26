/**
 * SECP Industrial OS — Nonlinear Material Mechanics (SECP-FEM-UPGRADE-010)
 * TET4PlasticFormulation.ts
 * 
 * 4-Node Linear Tetrahedral 3D Continuum Solid Element with Plasticity support.
 */

import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementNonlinearResult, ElementStressStrainResult, FEMElement, FEMModel, IntegrationPointResult } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { MaterialStateManager } from "./MaterialStateManager";
import { ConstitutiveModel } from "./ConstitutiveModel";
import { TET43DFormulation } from "./TET43DFormulation";

export class TET4PlasticFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY, DOFComponent.UZ];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    // Linear elastic version for initial assembly (reuse logic or refer to TET43D)
    // For simplicity, we implement it here but it's identical to the elastic TET4.
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const material = model.materials.get(element.materialId)!;
    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];
    const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
    const invDetJ = 1.0 / detJ;
    
    const B = this.computeBMatrix(nodes, invDetJ);
    const D = this.computeElasticD(material.E, material.nu);
    const volume = detJ / 6.0;

    const Ke = B.transpose().multiply(D).multiply(B).scale(volume);
    
    const globalDOFs: number[] = [];
    for (const nodeId of element.nodeIds) {
      globalDOFs.push(dofManager.getDOF(nodeId, DOFComponent.UX)!.globalId);
      globalDOFs.push(dofManager.getDOF(nodeId, DOFComponent.UY)!.globalId);
      globalDOFs.push(dofManager.getDOF(nodeId, DOFComponent.UZ)!.globalId);
    }

    return { Ke, Fe: new Array(12).fill(0), globalDOFs };
  }

  computeNonlinearMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array,
    stateManager?: MaterialStateManager,
    materialModel?: ConstitutiveModel
  ): ElementNonlinearResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];
    const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
    const invDetJ = 1.0 / detJ;
    const volume = detJ / 6.0;

    const B = this.computeBMatrix(nodes, invDetJ);
    
    // Extract local displacement
    const u_e = new Float64Array(12);
    const globalDOFs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const nodeId = nodes[i].nodeId;
      const d1 = dofManager.getDOF(nodeId, DOFComponent.UX)!;
      const d2 = dofManager.getDOF(nodeId, DOFComponent.UY)!;
      const d3 = dofManager.getDOF(nodeId, DOFComponent.UZ)!;
      u_e[3 * i] = U[d1.globalId];
      u_e[3 * i + 1] = U[d2.globalId];
      u_e[3 * i + 2] = U[d3.globalId];
      globalDOFs.push(d1.globalId, d2.globalId, d3.globalId);
    }

    // Current total strain
    const strain = B.multiplyVector(Array.from(u_e));

    let stress: number[];
    let D_alg: Matrix;

    if (materialModel && stateManager) {
      const prevState = stateManager.getElementStates(element.elementId, false)[0]; // TET4 has 1 integration point (centroid)
      // Since it's a small-strain formulation, we pass the total strain as "increment" from zero or 
      // handle increments properly.
      // Standard return mapping usually takes delta_epsilon.
      // But we can also pass total strain if the model handles it.
      // Let's compute delta_strain = strain_total - strain_last_converged
      // Wait, J2Plasticity3D.update takes strainIncrement.
      // Let's compute it.
      const lastConvergedU = new Float64Array(12);
      // We don't have U_last easily here without passing it.
      // Actually, standard FE codes often store the plastic strain and stress at Tn.
      // Then Trial Stress = Sigma_n + D : (Strain_total - Strain_n)
      // But for Linear Elastic elements (TET4), Strain_n is B * U_n.
      // Let's assume the state contains the stress from the last converged step.
      // We need delta_strain.
      // Or we can modify the constitutive model to take total strain and handle it.
      // Actually, let's store strain in the state too.
      // Or just pass the current total displacement and use the state's stress.
      
      // Let's use a simpler approach for now: delta_strain = current_strain - last_strain
      // But where to get last_strain? 
      // Let's add 'totalStrain' to IntegrationPointState.
      // No, let's just use trial stress calculation: sigma_trial = D : (epsilon_total - epsilon_plastic_n)
      // This is equivalent to radial return for small strain.
      
      // Re-evaluating J2Plasticity3D: it uses sigma_trial = sigma_n + De * delta_epsilon.
      // I will compute delta_epsilon = B * delta_U
      // But I don't have delta_U easily.
      // Actually, I can pass U and U_prev to computeNonlinearMatrices.
      // OR, better: the constitutive model can take total strain and return updated stress.
      // I'll update J2Plasticity3D to work with total strain or increments.
      
      // Let's use Incremental approach. I'll update solve loop to pass U and U_prev if needed.
      // Actually, Newton iterations work on U_total.
      // So delta_epsilon_iteration = B * (U_current - U_n) where U_n is last converged.
      // I'll calculate delta_epsilon here.
      
      // Wait, I can calculate delta_epsilon = strain_total - strain_at_Tn
      // I'll store 'strain' in IntegrationPointState.
      
      // @ts-ignore (Temporary until I update interface)
      const strain_n = prevState.totalStrain || new Array(6).fill(0);
      const delta_epsilon = strain.map((val, i) => val - strain_n[i]);
      
      const result = materialModel.update(delta_epsilon, prevState);
      stress = result.stress;
      D_alg = result.tangent;
      
      // Store current total strain for next increment
      // @ts-ignore
      result.state.totalStrain = Array.from(strain);
      stateManager.updateIntegrationPoint(element.elementId, 0, result.state);
    } else {
      // Elastic fallback
      const material = model.materials.get(element.materialId)!;
      D_alg = this.computeElasticD(material.E, material.nu);
      stress = D_alg.multiplyVector(Array.from(strain));
    }

    // Fint = B^T * sigma * volume
    const Fint = B.transpose().multiplyVector(stress).map(val => val * volume);

    // Kt = B^T * D_alg * B * volume
    const Kt = B.transpose().multiply(D_alg).multiply(B).scale(volume);

    return { Kt, Fint, globalDOFs };
  }

  private computeBMatrix(nodes: any[], invDetJ: number): Matrix {
    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];

    const b1 = (y[2]-y[0])*(z[3]-z[0]) - (y[3]-y[0])*(z[2]-z[0]);
    const c1 = (x[3]-x[0])*(z[2]-z[0]) - (x[2]-x[0])*(z[3]-z[0]);
    const d1 = (x[2]-x[0])*(y[3]-y[0]) - (x[3]-x[0])*(y[2]-y[0]);

    const b2 = (y[3]-y[0])*(z[1]-z[0]) - (y[1]-y[0])*(z[3]-z[0]);
    const c2 = (x[1]-x[0])*(z[3]-z[0]) - (x[3]-x[0])*(z[1]-z[0]);
    const d2 = (x[3]-x[0])*(y[1]-y[0]) - (x[1]-x[0])*(y[3]-y[0]);

    const b3 = (y[1]-y[0])*(z[2]-z[0]) - (y[2]-y[0])*(z[1]-z[0]);
    const c3 = (x[2]-x[0])*(z[1]-z[0]) - (x[1]-x[0])*(z[2]-z[0]);
    const d3 = (x[1]-x[0])*(y[2]-y[0]) - (x[2]-x[0])*(y[1]-y[0]);

    const b0 = -b1 - b2 - b3;
    const c0 = -c1 - c2 - c3;
    const d0 = -d1 - d2 - d3;

    const B = new Matrix(6, 12);
    const bs = [b0, b1, b2, b3], cs = [c0, c1, c2, c3], ds = [d0, d1, d2, d3];

    for (let i = 0; i < 4; i++) {
      const col = 3 * i;
      B.set(0, col,     bs[i] * invDetJ);
      B.set(1, col + 1, cs[i] * invDetJ);
      B.set(2, col + 2, ds[i] * invDetJ);
      B.set(3, col,     cs[i] * invDetJ);
      B.set(3, col + 1, bs[i] * invDetJ);
      B.set(4, col + 1, ds[i] * invDetJ);
      B.set(4, col + 2, cs[i] * invDetJ);
      B.set(5, col,     ds[i] * invDetJ);
      B.set(5, col + 2, bs[i] * invDetJ);
    }
    return B;
  }

  private computeElasticD(E: number, nu: number): Matrix {
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    const D = new Matrix(6, 6);
    const c11 = (1 - nu) * factor, c12 = nu * factor, c44 = 0.5 * (1 - 2 * nu) * factor;
    D.set(0, 0, c11); D.set(0, 1, c12); D.set(0, 2, c12);
    D.set(1, 0, c12); D.set(1, 1, c11); D.set(1, 2, c12);
    D.set(2, 0, c12); D.set(2, 1, c12); D.set(2, 2, c11);
    D.set(3, 3, c44); D.set(4, 4, c44); D.set(5, 5, c44);
    return D;
  }

  computeStressStrain?(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult {
    // Basic field recovery logic (could be improved to use stateManager if passed)
    return new TET43DFormulation().computeStressStrain(element, model, dofManager, U);
  }
}
