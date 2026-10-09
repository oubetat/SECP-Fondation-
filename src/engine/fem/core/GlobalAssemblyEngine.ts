import { Matrix } from "./MathUtils";
import { FEMModel } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";
import { FEMElementFormulation } from "./FEMElementFormulation";

export class GlobalAssemblyEngine {
  assemble(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>
  ): { K: Matrix; F: number[]; trace: any[] } {
    const totalDOFs = dofManager.getTotalDOFCount();
    const K = Matrix.zeros(totalDOFs, totalDOFs);
    const F = new Array(totalDOFs).fill(0);
    const trace = [];

    for (const [elemId, element] of model.elements.entries()) {
      const formulation = formulations.get(element.formulationId);
      if (!formulation) throw new Error(`Formulation ${element.formulationId} not found`);

      const { Ke, Fe, globalDOFs } = formulation.computeMatrices(element, model, dofManager);

      for (let i = 0; i < globalDOFs.length; i++) {
        const row = globalDOFs[i];
        F[row] += Fe[i];
        for (let j = 0; j < globalDOFs.length; j++) {
          const col = globalDOFs[j];
          K.add(row, col, Ke.get(i, j));
        }
      }

      trace.push({
        elementId: elemId,
        globalDOFs,
      });
    }

    // Apply nodal loads directly to F
    for (const load of model.loads) {
      const dof = dofManager.getDOF(load.nodeId, load.dof);
      if (dof) {
        F[dof.globalId] += load.value;
      }
    }

    return { K, F, trace };
  }
}
