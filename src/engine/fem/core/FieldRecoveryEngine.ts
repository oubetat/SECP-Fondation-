import { Matrix } from "./MathUtils";
import { DOFComponent, FEMModel } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";

export class FieldRecoveryEngine {
  recoverDisplacements(U: number[], model: FEMModel, dofManager: FEMDOFManager) {
    const displacements = new Map<string, { [key in DOFComponent]?: number }>();
    
    for (const [nodeId, _] of model.nodes.entries()) {
      const nodeDisp: any = {};
      
      for (const comp of Object.values(DOFComponent)) {
        const dof = dofManager.getDOF(nodeId, comp);
        if (dof) {
          nodeDisp[comp] = U[dof.globalId];
        } else {
          nodeDisp[comp] = 0;
        }
      }
      
      displacements.set(nodeId, nodeDisp);
    }
    
    return displacements;
  }

  computeReactions(K_original: Matrix, U: number[], F_original: number[], dofManager: FEMDOFManager) {
    // R = K*U - F_external
    const KU = K_original.multiplyVector(U);
    const R = new Array(U.length).fill(0);
    
    for (let i = 0; i < U.length; i++) {
      R[i] = KU[i] - F_original[i];
    }
    
    return R;
  }
}
