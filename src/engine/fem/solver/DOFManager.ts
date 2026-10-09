import { DOFType } from '../elements/types';
import { GlobalDOF, PrescribedDisplacementInput, NodeInput } from './types';

export class DOFManager {
  readonly dofsPerNode: number;
  readonly globalDOFs: GlobalDOF[];
  readonly totalDOFs: number;

  private nodeDofToGlobalIndex: Map<string, number>;
  private freeIndices: number[];
  private constrainedIndices: number[];

  constructor(nodes: NodeInput[], dofsPerNode: number, constraints: PrescribedDisplacementInput[] = []) {
    this.dofsPerNode = dofsPerNode;
    this.globalDOFs = [];
    this.nodeDofToGlobalIndex = new Map();

    // Map constraints for fast lookup
    const constraintMap = new Map<string, number>();
    for (const c of constraints) {
      constraintMap.set(`${c.nodeId}:${c.dof}`, c.value);
    }

    // Sort nodes deterministically by index
    const sortedNodes = [...nodes].sort((a, b) => a.index - b.index);

    const dofTypes: DOFType[] =
      dofsPerNode === 1
        ? ['UX']
        : dofsPerNode === 2
        ? ['UX', 'UY']
        : ['UX', 'UY', 'UZ'];

    let globalCounter = 0;
    for (const node of sortedNodes) {
      for (let d = 0; d < dofsPerNode; d++) {
        const dofType = dofTypes[d];
        const key = `${node.id}:${dofType}`;
        const isConstrained = constraintMap.has(key);
        const constrainedValue = constraintMap.get(key);

        const globalDof: GlobalDOF = {
          globalIndex: globalCounter,
          nodeId: node.id,
          nodeIndex: node.index,
          dof: dofType,
          isConstrained,
          constrainedValue
        };

        this.globalDOFs.push(globalDof);
        this.nodeDofToGlobalIndex.set(key, globalCounter);
        globalCounter++;
      }
    }

    this.totalDOFs = globalCounter;
    this.freeIndices = [];
    this.constrainedIndices = [];

    for (let i = 0; i < this.totalDOFs; i++) {
      if (this.globalDOFs[i].isConstrained) {
        this.constrainedIndices.push(i);
      } else {
        this.freeIndices.push(i);
      }
    }
  }

  getGlobalDOFIndex(nodeId: string, dof: DOFType): number {
    const idx = this.nodeDofToGlobalIndex.get(`${nodeId}:${dof}`);
    if (idx === undefined) {
      throw new Error(`DOF not found for node ${nodeId}, DOF ${dof}`);
    }
    return idx;
  }

  getFreeDOFIndices(): number[] {
    return [...this.freeIndices];
  }

  getConstrainedDOFIndices(): number[] {
    return [...this.constrainedIndices];
  }

  /**
   * Element Node IDs -> Element Global DOF Array
   */
  getElementGlobalDOFs(nodeIds: string[], dofsPerNode: number): number[] {
    const dofTypes: DOFType[] =
      dofsPerNode === 1
        ? ['UX']
        : dofsPerNode === 2
        ? ['UX', 'UY']
        : ['UX', 'UY', 'UZ'];

    const elementDOFs: number[] = [];
    for (const nodeId of nodeIds) {
      for (let d = 0; d < dofsPerNode; d++) {
        elementDOFs.push(this.getGlobalDOFIndex(nodeId, dofTypes[d]));
      }
    }
    return elementDOFs;
  }
}
