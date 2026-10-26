import { DOF, DOFComponent, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";

export class FEMDOFManager {
  private dofs: Map<string, DOF> = new Map();
  private globalCount: number = 0;

  buildDOFs(
    model: FEMModel,
    requiredComponentsOrFormulations: DOFComponent[] | Map<string, FEMElementFormulation>
  ) {
    this.dofs.clear();
    this.globalCount = 0;

    const sortedNodeIds = Array.from(model.nodes.keys()).sort();

    if (Array.isArray(requiredComponentsOrFormulations)) {
      const requiredComponents = requiredComponentsOrFormulations;
      for (const nodeId of sortedNodeIds) {
        for (const comp of requiredComponents) {
          const key = `${nodeId}_${comp}`;
          this.dofs.set(key, {
            globalId: this.globalCount++,
            nodeId,
            component: comp,
          });
        }
      }
    } else {
      const formulations = requiredComponentsOrFormulations;
      const nodeComponentsMap = new Map<string, Set<DOFComponent>>();

      for (const nodeId of sortedNodeIds) {
        nodeComponentsMap.set(nodeId, new Set<DOFComponent>());
      }

      // Collect required DOFs per node from elements
      for (const element of model.elements.values()) {
        const formulation = formulations.get(element.formulationId);
        if (!formulation) continue;
        const reqDOFs = formulation.getRequiredDOFs();
        for (const nodeId of element.nodeIds) {
          const set = nodeComponentsMap.get(nodeId);
          if (set) {
            reqDOFs.forEach(comp => set.add(comp));
          }
        }
      }

      // Collect required DOFs from loads and boundary conditions
      for (const load of model.loads) {
        nodeComponentsMap.get(load.nodeId)?.add(load.dof);
      }
      for (const bc of model.boundaryConditions) {
        nodeComponentsMap.get(bc.nodeId)?.add(bc.dof);
      }

      // Deterministic numbering: sorted nodeIds, sorted component strings
      for (const nodeId of sortedNodeIds) {
        const compSet = nodeComponentsMap.get(nodeId);
        if (!compSet || compSet.size === 0) continue;

        const sortedComps = Array.from(compSet).sort();
        for (const comp of sortedComps) {
          const key = `${nodeId}_${comp}`;
          if (!this.dofs.has(key)) {
            this.dofs.set(key, {
              globalId: this.globalCount++,
              nodeId,
              component: comp,
            });
          }
        }
      }
    }
  }

  getDOF(nodeId: string, comp: DOFComponent): DOF | undefined {
    return this.dofs.get(`${nodeId}_${comp}`);
  }

  getDOFByGlobalId(globalId: number): DOF | undefined {
    for (const dof of this.dofs.values()) {
      if (dof.globalId === globalId) return dof;
    }
    return undefined;
  }

  getAllDOFs(): DOF[] {
    return Array.from(this.dofs.values());
  }

  getTotalDOFCount(): number {
    return this.globalCount;
  }
}
