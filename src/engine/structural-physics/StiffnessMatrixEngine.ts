/**
 * SECP Structural Physics & Finite Element Analysis — Stiffness Matrix Engine
 * Computes, inspects, and validates local and global stiffness matrices.
 */
import {
  FEAMesh,
  MeshElement,
  MaterialProperties,
  StiffnessMatrix
} from './StructuralPhysicsTypes';
import { ElementFormulationEngine } from './ElementFormulationEngine';
import { GlobalAssemblyEngine } from './GlobalAssemblyEngine';

export interface StiffnessMatrixProperties {
  dimension: number;
  isSymmetric: boolean;
  diagonalDominance: boolean;
  trace: number;
  maxEntry: number;
  minDiagonal: number;
  maxDiagonal: number;
}

export class StiffnessMatrixEngine {
  /**
   * Computes the element stiffness matrix for a specific mesh element.
   */
  public static computeElementStiffness(
    element: MeshElement,
    mesh: FEAMesh,
    materials: Map<string, MaterialProperties>
  ): number[][] {
    const material = materials.get(element.materialId);
    if (!material) {
      throw new Error(`[StiffnessMatrixEngine] Material ${element.materialId} not found for element ${element.id}`);
    }

    const nodeCoords = element.nodeIds.map(nid => {
      const node = mesh.nodes.find(n => n.id === nid);
      if (!node) {
        throw new Error(`[StiffnessMatrixEngine] Node ${nid} not found in mesh`);
      }
      return { x: node.x, y: node.y, z: node.z };
    });

    return ElementFormulationEngine.formulateElementStiffness(
      element,
      mesh.nodes.filter(n => element.nodeIds.includes(n.id)),
      materials
    );
  }

  /**
   * Assembles the full global stiffness matrix for the entire FEA mesh.
   */
  public static assembleGlobalStiffness(
    mesh: FEAMesh,
    materials?: Map<string, MaterialProperties>
  ): StiffnessMatrix {
    const { K } = GlobalAssemblyEngine.assembleSystemWithoutBoundaryPenalty(mesh);
    const denseValues = K.toDense();
    return {
      dimension: K.size,
      values: denseValues
    };
  }

  /**
   * Evaluates mathematical properties of a stiffness matrix (symmetry, trace, diagonal bounds).
   */
  public static analyzeStiffnessProperties(k: StiffnessMatrix, tolerance = 1e-9): StiffnessMatrixProperties {
    const dim = k.dimension;
    let isSymmetric = true;
    let diagonalDominance = true;
    let trace = 0;
    let maxEntry = 0;
    let minDiagonal = Infinity;
    let maxDiagonal = -Infinity;

    for (let i = 0; i < dim; i++) {
      const diagVal = Math.abs(k.values[i][i]);
      trace += k.values[i][i];
      minDiagonal = Math.min(minDiagonal, k.values[i][i]);
      maxDiagonal = Math.max(maxDiagonal, k.values[i][i]);

      let rowOffDiagSum = 0;
      for (let j = 0; j < dim; j++) {
        const val = k.values[i][j];
        maxEntry = Math.max(maxEntry, Math.abs(val));

        if (i !== j) {
          rowOffDiagSum += Math.abs(val);
          // Symmetry check: K_ij == K_ji
          const diff = Math.abs(val - k.values[j][i]);
          if (diff > tolerance * (1 + Math.abs(val) + Math.abs(k.values[j][i]))) {
            isSymmetric = false;
          }
        }
      }

      if (diagVal < rowOffDiagSum - tolerance) {
        diagonalDominance = false;
      }
    }

    return {
      dimension: dim,
      isSymmetric,
      diagonalDominance,
      trace,
      maxEntry,
      minDiagonal: isFinite(minDiagonal) ? minDiagonal : 0,
      maxDiagonal: isFinite(maxDiagonal) ? maxDiagonal : 0
    };
  }
}
