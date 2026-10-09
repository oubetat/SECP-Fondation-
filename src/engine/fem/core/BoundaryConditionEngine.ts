import { Matrix } from "./MathUtils";
import { FEMModel } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";

export class BoundaryConditionEngine {
  applyConstraints(K: Matrix, F: number[], model: FEMModel, dofManager: FEMDOFManager) {
    const penalty = 1e12; // Penalty stiffness

    const modifiedK = K.clone();
    const modifiedF = [...F];

    // Detect constraint conflicts
    const appliedDOFs = new Set<number>();

    for (const bc of model.boundaryConditions) {
      const dof = dofManager.getDOF(bc.nodeId, bc.dof);
      if (dof) {
        const globalId = dof.globalId;
        
        if (appliedDOFs.has(globalId)) {
          throw new Error(`CONSTRAINT_CONFLICT: Multiple BCs on same DOF ${globalId}`);
        }
        appliedDOFs.add(globalId);

        // Apply penalty
        modifiedK.add(globalId, globalId, penalty);
        modifiedF[globalId] += bc.value * penalty;
      }
    }

    return { modifiedK, modifiedF };
  }
}
