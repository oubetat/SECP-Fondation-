export type DOFType = 'Ux' | 'Uy' | 'Uz' | 'Rx' | 'Ry' | 'Rz';

export interface DOFInfo {
  nodeId: string | number;
  dofName: DOFType;
  globalIndex: number;
}

export class DOFMapper {
  private nodeDofMap: Map<string | number, Map<DOFType, number>> = new Map();
  private globalToDofMap: Map<number, { nodeId: string | number; dofName: DOFType }> = new Map();
  private totalDOFs: number = 0;

  constructor() {}

  /**
   * Initializes or registers DOFs for a list of nodes and allowed DOF types per node
   */
  registerNodes(nodeIds: (string | number)[], dofTypesPerNode: DOFType[] = ['Ux', 'Uy', 'Uz']): number {
    this.nodeDofMap.clear();
    this.globalToDofMap.clear();
    this.totalDOFs = 0;

    for (const nodeId of nodeIds) {
      const dofMap = new Map<DOFType, number>();
      for (const dofType of dofTypesPerNode) {
        const globalIdx = this.totalDOFs;
        dofMap.set(dofType, globalIdx);
        this.globalToDofMap.set(globalIdx, { nodeId, dofName: dofType });
        this.totalDOFs++;
      }
      this.nodeDofMap.set(nodeId, dofMap);
    }

    return this.totalDOFs;
  }

  get numDOFs(): number {
    return this.totalDOFs;
  }

  getDOFIndex(nodeId: string | number, dofName: DOFType): number {
    const dofMap = this.nodeDofMap.get(nodeId);
    if (!dofMap) {
      throw new Error(`Node ID '${nodeId}' is not registered in DOFMapper`);
    }
    const idx = dofMap.get(dofName);
    if (idx === undefined) {
      throw new Error(`DOF '${dofName}' is not registered for node ID '${nodeId}'`);
    }
    return idx;
  }

  getDOFInfo(globalIndex: number): { nodeId: string | number; dofName: DOFType } {
    const info = this.globalToDofMap.get(globalIndex);
    if (!info) {
      throw new Error(`Global DOF index ${globalIndex} is out of bounds or unmapped`);
    }
    return info;
  }

  /**
   * Gets the ordered array of global DOF indices for a given element's nodes
   */
  getElementDOFIndices(elementNodeIds: (string | number)[], dofTypesPerNode: DOFType[] = ['Ux', 'Uy', 'Uz']): number[] {
    const indices: number[] = [];
    for (const nodeId of elementNodeIds) {
      for (const dofType of dofTypesPerNode) {
        indices.push(this.getDOFIndex(nodeId, dofType));
      }
    }
    return indices;
  }
}
