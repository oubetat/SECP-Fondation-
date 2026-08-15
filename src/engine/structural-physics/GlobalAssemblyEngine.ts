/**
 * PATCH-SECP-073.3 / PATCH-SECP-075.2: Global Assembly Engine (Sparse + Symmetry + Exact Dirichlet Reduction)
 * Assembles local element stiffnesses into a global structural sparse matrix.
 * Supports:
 * 1) Penalty method for unified global assembly
 * 2) Exact Dirichlet elimination for forensic verification and analytical benchmarks
 */

import { FEAMesh, BoundaryCondition, LoadDefinition } from './StructuralPhysicsTypes';
import { ElementFormulationEngine } from './ElementFormulationEngine';
import { SparseMatrix } from './SparseMatrixEngine';

export interface ReducedSystem {
  K: SparseMatrix;
  F: number[];
  freeDOFs: number[];
  constrainedDOFs: number[];
}

export class GlobalAssemblyEngine {
  /**
   * Assembles the pure unconstrained global stiffness matrix and force vector (without boundary penalty).
   */
  public static assembleSystemWithoutBoundaryPenalty(
    mesh: FEAMesh,
    loads: LoadDefinition[] = []
  ): { K: SparseMatrix; F: number[]; dofsPerNode: number } {
    // Auto-detect DOFs per node based on elements
    let dofsPerNode = 1; // Default for BAR_1D
    if (mesh.elements.some(e => e.type === 'TRI_2D' || e.type === 'QUAD_2D')) dofsPerNode = 2;
    if (mesh.elements.some(e => e.type === 'HEX_3D' || e.type === 'TET_3D')) dofsPerNode = 3;

    const numNodes = mesh.nodes.length;
    const totalDOFs = numNodes * dofsPerNode;

    const K = new SparseMatrix(totalDOFs);
    const F: number[] = Array(totalDOFs).fill(0);

    // 1. Assemble Element Stiffnesses
    mesh.elements.forEach(elem => {
      const kLocal = ElementFormulationEngine.formulateElementStiffness(elem, mesh.nodes);

      const dofIndices: number[] = [];
      elem.nodeIds.forEach(nodeId => {
        const nodeIdx = nodeId - 1; // Assuming 1-based indexing
        for (let i = 0; i < dofsPerNode; i++) {
          dofIndices.push(nodeIdx * dofsPerNode + i);
        }
      });

      for (let i = 0; i < dofIndices.length; i++) {
        for (let j = 0; j < dofIndices.length; j++) {
          K.add(dofIndices[i], dofIndices[j], kLocal[i][j]);
        }
      }
    });

    // 2. Assemble Nodal Forces
    loads.forEach(load => {
      const nodeIdx = load.nodeId - 1;
      if (nodeIdx >= 0 && nodeIdx < numNodes) {
        F[nodeIdx * dofsPerNode + 0] += load.forceVector.x;
        if (dofsPerNode >= 2) F[nodeIdx * dofsPerNode + 1] += load.forceVector.y;
        if (dofsPerNode >= 3) F[nodeIdx * dofsPerNode + 2] += load.forceVector.z;
      }
    });

    return { K, F, dofsPerNode };
  }

  /**
   * Assembles the global stiffness matrix and force vector using the Penalty Method.
   */
  public static assembleSystem(
    mesh: FEAMesh,
    bcs: BoundaryCondition[],
    loads: LoadDefinition[]
  ): { K: SparseMatrix; F: number[]; dofsPerNode: number } {
    const assembled = this.assembleSystemWithoutBoundaryPenalty(mesh, loads);
    const { K, F, dofsPerNode } = assembled;
    const numNodes = mesh.nodes.length;

    // Apply Boundary Conditions using the Penalty Method
    const PENALTY = 1e15;

    bcs.forEach(bc => {
      const nodeIdx = bc.nodeId - 1;
      if (nodeIdx >= 0 && nodeIdx < numNodes) {
        for (let i = 0; i < Math.min(dofsPerNode, bc.constrainedDOFs.length); i++) {
          if (bc.constrainedDOFs[i]) {
            const dofIdx = nodeIdx * dofsPerNode + i;
            K.add(dofIdx, dofIdx, PENALTY);
            F[dofIdx] = 0;
          }
        }
      }
    });

    return { K, F, dofsPerNode };
  }

  /**
   * Assembles a reduced system via exact Dirichlet elimination (removing constrained DOFs).
   */
  public static assembleReducedSystem(
    mesh: FEAMesh,
    bcs: BoundaryCondition[],
    loads: LoadDefinition[]
  ): ReducedSystem {
    const assembled = this.assembleSystemWithoutBoundaryPenalty(mesh, loads);

    const constrained = new Set<number>();
    const dofsPerNode = assembled.dofsPerNode;

    for (const bc of bcs) {
      const nodeIdx = bc.nodeId - 1;
      for (
        let i = 0;
        i < Math.min(dofsPerNode, bc.constrainedDOFs.length);
        i++
      ) {
        if (bc.constrainedDOFs[i]) {
          constrained.add(nodeIdx * dofsPerNode + i);
        }
      }
    }

    const total = assembled.K.getSize();
    const freeDOFs: number[] = [];

    for (let i = 0; i < total; i++) {
      if (!constrained.has(i)) {
        freeDOFs.push(i);
      }
    }

    const KReduced = new SparseMatrix(freeDOFs.length);
    const FReduced = Array(freeDOFs.length).fill(0);

    for (let i = 0; i < freeDOFs.length; i++) {
      const gi = freeDOFs[i];
      FReduced[i] = assembled.F[gi];

      for (let j = 0; j < freeDOFs.length; j++) {
        const gj = freeDOFs[j];
        KReduced.add(i, j, assembled.K.get(gi, gj));
      }
    }

    return {
      K: KReduced,
      F: FReduced,
      freeDOFs,
      constrainedDOFs: Array.from(constrained)
    };
  }
}
