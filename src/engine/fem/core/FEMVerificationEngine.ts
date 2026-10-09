import { Matrix } from "./MathUtils";
import { FEMDOFManager } from "./FEMDOFManager";
import { DOFComponent } from "./FEMTypes";

export class FEMVerificationEngine {
  verifyEquilibrium(F_external: number[], Reactions: number[], dofManager: FEMDOFManager, tolerance = 1e-5) {
    let sumFx = 0;
    let sumFy = 0;
    let sumFz = 0;
    
    const allDOFs = dofManager.getAllDOFs();
    
    for (const dof of allDOFs) {
      const globalId = dof.globalId;
      const totalForce = F_external[globalId] + Reactions[globalId];
      
      if (dof.component === DOFComponent.UX) sumFx += totalForce;
      else if (dof.component === DOFComponent.UY) sumFy += totalForce;
      else if (dof.component === DOFComponent.UZ) sumFz += totalForce;
    }

    if (Math.abs(sumFx) > tolerance || Math.abs(sumFy) > tolerance || Math.abs(sumFz) > tolerance) {
      return { ok: false, error: `Equilibrium failure: SumFx=${sumFx}, SumFy=${sumFy}, SumFz=${sumFz}` };
    }
    
    return { ok: true, sumFx, sumFy, sumFz };
  }

  verifyEnergy(K: Matrix, U: number[], F_external: number[], Reactions: number[], tolerance = 1e-6) {
    // Strain energy = 1/2 U^T K U
    const KU = K.multiplyVector(U);
    let strainEnergy = 0;
    for (let i = 0; i < U.length; i++) {
      strainEnergy += 0.5 * U[i] * KU[i];
    }
    
    let externalWork = 0;
    for (let i = 0; i < U.length; i++) {
      externalWork += 0.5 * U[i] * (F_external[i] + Reactions[i]);
    }
    
    if (Math.abs(strainEnergy - externalWork) > tolerance) {
      return { ok: false, strainEnergy, externalWork, diff: Math.abs(strainEnergy - externalWork) };
    }
    return { ok: true, strainEnergy, externalWork };
  }
}

