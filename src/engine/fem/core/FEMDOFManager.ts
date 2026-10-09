import { DOF, DOFComponent, FEMModel } from "./FEMTypes";

export class FEMDOFManager {
  private dofs: Map<string, DOF> = new Map();
  private globalCount: number = 0;

  buildDOFs(model: FEMModel, requiredComponents: DOFComponent[]) {
    this.dofs.clear();
    this.globalCount = 0;

    // A deterministic numbering: node by node, component by component
    const sortedNodeIds = Array.from(model.nodes.keys()).sort();

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
  }

  getDOF(nodeId: string, comp: DOFComponent): DOF | undefined {
    return this.dofs.get(`${nodeId}_${comp}`);
  }

  getAllDOFs(): DOF[] {
    return Array.from(this.dofs.values());
  }

  getTotalDOFCount(): number {
    return this.globalCount;
  }
}
