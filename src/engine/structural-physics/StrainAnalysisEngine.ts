/**
 * PATCH-SECP-073: Strain Analysis Engine
 * Calculates mechanical strain fields from derived node displacement matrices.
 */

import { FEAMesh } from './StructuralPhysicsTypes';

export class StrainAnalysisEngine {
  /**
   * Calculates 1D element strain: epsilon_xx = (u_B - u_A) / L
   */
  public static calculate1DStrain(
    nodeIdx: number,
    globalDisplacements: number[],
    mesh: FEAMesh
  ): number {
    if (mesh.elements.length === 0) return 0;
    
    // Find connected element
    const elem = mesh.elements.find(e => e.nodeIds.includes(nodeIdx + 1));
    if (!elem) return 0;

    const idxA = elem.nodeIds[0] - 1;
    const idxB = elem.nodeIds[1] - 1;

    const uA = globalDisplacements[idxA] || 0;
    const uB = globalDisplacements[idxB] || 0;

    const nodeA = mesh.nodes[idxA];
    const nodeB = mesh.nodes[idxB];

    if (!nodeA || !nodeB) return 0;

    const L = Math.abs(nodeB.x - nodeA.x) || 1.0;
    return (uB - uA) / L;
  }
}
