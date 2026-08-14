/**
 * PATCH-SECP-073: Global Assembly Engine
 * Assembles local element stiffnesses into the global structural matrix, applying BC constraints.
 */

import { FEAMesh, BoundaryCondition, LoadDefinition } from './StructuralPhysicsTypes';
import { ElementFormulationEngine } from './ElementFormulationEngine';

export class GlobalAssemblyEngine {
  /**
   * Assembles the global stiffness matrix and force vector for a 1D axial bar setup.
   * Dimension = numNodes * 1 (for 1D axial displacement analysis)
   */
  public static assembleSystem(
    mesh: FEAMesh,
    bcs: BoundaryCondition[],
    loads: LoadDefinition[]
  ): { K: number[][]; F: number[]; activeDOFs: boolean[] } {
    const numNodes = mesh.nodes.length;
    
    // Global Stiffness Matrix (K) & Global Force Vector (F)
    const K: number[][] = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
    const F: number[] = Array(numNodes).fill(0);

    // 1. Assemble Element Stiffnesses
    mesh.elements.forEach(elem => {
      // Elements connect Node i to Node i+1
      const n1Idx = elem.nodeIds[0] - 1;
      const n2Idx = elem.nodeIds[1] - 1;

      const kLocal = ElementFormulationEngine.formulateElementStiffness(elem, mesh.nodes);

      K[n1Idx][n1Idx] += kLocal[0][0];
      K[n1Idx][n2Idx] += kLocal[0][1];
      K[n2Idx][n1Idx] += kLocal[1][0];
      K[n2Idx][n2Idx] += kLocal[1][1];
    });

    // 2. Assemble Nodal Forces
    loads.forEach(load => {
      const nodeIdx = load.nodeId - 1;
      if (nodeIdx >= 0 && nodeIdx < numNodes) {
        F[nodeIdx] += load.forceVector.x; // Axial force projection
      }
    });

    // 3. Track Active DOFs (Boundary conditions lock certain degrees of freedom)
    const activeDOFs = Array(numNodes).fill(true);
    bcs.forEach(bc => {
      const nodeIdx = bc.nodeId - 1;
      if (nodeIdx >= 0 && nodeIdx < numNodes) {
        if (bc.constrainedDOFs[0]) {
          activeDOFs[nodeIdx] = false; // Fixed axially
        }
      }
    });

    return { K, F, activeDOFs };
  }
}
