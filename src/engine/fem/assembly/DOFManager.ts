/**
 * SECP CAD/CAE Platform - Degrees of Freedom (DOF) Manager
 * PATCH-234 — Global Stiffness Assembly
 *
 * Provides a deterministic, extensible DOF numbering engine for 3D structural,
 * thermal, and multi-field FE simulations.
 */

import { FEMNode } from '../mesh/FEMNode';

export type DOFField = 'UX' | 'UY' | 'UZ' | 'ROTX' | 'ROTY' | 'ROTZ' | 'TEMPERATURE' | 'PRESSURE';

export type DOFStatus = 'FREE' | 'PRESCRIBED' | 'SLAVE' | 'INACTIVE';

export interface DOFDescriptor {
  nodeId: string;
  field: DOFField;
  componentIndex: number; // 0 for UX, 1 for UY, etc.
  globalIndex: number;
  status: DOFStatus;
  prescribedValue?: number;
}

export class DOFManager {
  private nodeDofMap: Map<string, DOFDescriptor[]> = new Map();
  private globalDescriptors: DOFDescriptor[] = [];
  private freeIndices: number[] = [];
  private prescribedIndices: number[] = [];

  constructor(nodes: FEMNode[], fieldsPerNode: DOFField[] = ['UX', 'UY', 'UZ']) {
    this.allocateDOFs(nodes, fieldsPerNode);
  }

  /**
   * Deterministically allocates global DOF indices across all mesh nodes.
   * Nodes are processed in sorted order by nodeId for numerical reproducibility.
   */
  private allocateDOFs(nodes: FEMNode[], fields: DOFField[]) {
    // Sort nodes deterministically
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

    let globalCounter = 0;

    for (const node of sortedNodes) {
      const nodeDofs: DOFDescriptor[] = [];

      for (let compIdx = 0; compIdx < fields.length; compIdx++) {
        const field = fields[compIdx];
        const desc: DOFDescriptor = {
          nodeId: node.id,
          field,
          componentIndex: compIdx,
          globalIndex: globalCounter++,
          status: 'FREE'
        };

        nodeDofs.push(desc);
        this.globalDescriptors.push(desc);
      }

      this.nodeDofMap.set(node.id, nodeDofs);
    }

    this.reindexDOFStatus();
  }

  /**
   * Updates status for prescribed boundary DOFs.
   */
  public setBoundaryCondition(nodeId: string, field: DOFField, prescribedValue: number = 0.0) {
    const dofs = this.nodeDofMap.get(nodeId);
    if (!dofs) {
      throw new Error(`DOFManager: Node ${nodeId} not found during boundary condition assignment.`);
    }

    const desc = dofs.find((d) => d.field === field);
    if (!desc) {
      throw new Error(`DOFManager: Field ${field} not present on node ${nodeId}.`);
    }

    desc.status = 'PRESCRIBED';
    desc.prescribedValue = prescribedValue;

    this.reindexDOFStatus();
  }

  private reindexDOFStatus() {
    this.freeIndices = [];
    this.prescribedIndices = [];

    for (let i = 0; i < this.globalDescriptors.length; i++) {
      if (this.globalDescriptors[i].status === 'PRESCRIBED') {
        this.prescribedIndices.push(i);
      } else {
        this.freeIndices.push(i);
      }
    }
  }

  public get totalDOFs(): number {
    return this.globalDescriptors.length;
  }

  public get freeDOFCount(): number {
    return this.freeIndices.length;
  }

  public get prescribedDOFCount(): number {
    return this.prescribedIndices.length;
  }

  public getFreeIndices(): number[] {
    return [...this.freeIndices];
  }

  public getPrescribedIndices(): number[] {
    return [...this.prescribedIndices];
  }

  public getNodeDOFs(nodeId: string): DOFDescriptor[] {
    const dofs = this.nodeDofMap.get(nodeId);
    if (!dofs) {
      throw new Error(`DOFManager: Node ${nodeId} not found in DOF registry.`);
    }
    return dofs;
  }

  public getGlobalDOFIndex(nodeId: string, field: DOFField): number {
    const dofs = this.getNodeDOFs(nodeId);
    const desc = dofs.find((d) => d.field === field);
    if (!desc) {
      throw new Error(`DOFManager: Field ${field} not registered on node ${nodeId}.`);
    }
    return desc.globalIndex;
  }

  public getDescriptor(globalIndex: number): DOFDescriptor {
    if (globalIndex < 0 || globalIndex >= this.globalDescriptors.length) {
      throw new Error(`DOFManager: Invalid global DOF index ${globalIndex}. Total DOFs: ${this.totalDOFs}`);
    }
    return this.globalDescriptors[globalIndex];
  }

  public getAllDescriptors(): ReadonlyArray<DOFDescriptor> {
    return this.globalDescriptors;
  }
}
