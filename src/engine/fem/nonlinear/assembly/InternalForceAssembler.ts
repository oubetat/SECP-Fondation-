/**
 * SECP Industrial OS v3 — Internal Force Assembler (PATCH-238)
 *
 * Computes global internal force vector:
 * F_int = \sum_e \int_V B^T * \sigma * dV
 * from actual current stress field and current element kinematics.
 */

import { MaterialPointStateTracker } from '../materials/MaterialPointStateTracker';
import { ReturnMappingOptions } from '../types/NonlinearStructuralTypes';

export interface ElementGeometryData {
  elementId: string;
  nodeIndices: number[];         // Global node IDs
  referenceCoords: number[][];   // [X, Y, Z]
  gaussPoints: {
    dNdX: number[][];            // Derivatives wrt coords
    weight: number;
  }[];
}

export class InternalForceAssembler {
  /**
   * Assembles the global internal force vector F_int
   */
  public static assembleInternalForces(
    elements: ElementGeometryData[],
    currentDisplacements: number[],
    stateTracker: MaterialPointStateTracker,
    options: ReturnMappingOptions,
    totalDOFs: number,
    dofsPerNode: number = 2
  ): { fInternal: number[]; maxVonMises: number } {
    const fInternal = new Array(totalDOFs).fill(0.0);
    let maxVonMises = 0.0;

    elements.forEach(elem => {
      const nodeCount = elem.nodeIndices.length;
      const elemDOFs = nodeCount * dofsPerNode;

      elem.gaussPoints.forEach((gp, gpIdx) => {
        // Compute displacement gradient & trial strain
        const elemDisplacements: number[] = [];
        elem.nodeIndices.forEach(nIdx => {
          for (let d = 0; d < dofsPerNode; d++) {
            elemDisplacements.push(currentDisplacements[nIdx * dofsPerNode + d] || 0.0);
          }
        });

        // Compute B-matrix (6 x elemDOFs)
        const B = this.buildBMatrix(gp.dNdX, dofsPerNode, nodeCount);

        // Compute Strain Voigt = B * u_elem
        const strainVoigt = [0, 0, 0, 0, 0, 0];
        for (let r = 0; r < 6; r++) {
          let s = 0;
          for (let c = 0; c < elemDOFs; c++) {
            s += B[r][c] * elemDisplacements[c];
          }
          strainVoigt[r] = s;
        }

        // Return mapping at integration point
        const returnMapRes = stateTracker.updatePointState(
          elem.elementId,
          gpIdx,
          strainVoigt,
          options
        );

        const stressVoigt = returnMapRes.stressVoigt;
        const dV = gp.weight;

        // Von Mises stress calculation for diagnostics
        const s11 = stressVoigt[0];
        const s22 = stressVoigt[1];
        const s33 = stressVoigt[2];
        const s23 = stressVoigt[3];
        const s13 = stressVoigt[4];
        const s12 = stressVoigt[5];

        const vm = Math.sqrt(
          0.5 * ((s11 - s22) ** 2 + (s22 - s33) ** 2 + (s33 - s11) ** 2) +
          3.0 * (s12 ** 2 + s23 ** 2 + s13 ** 2)
        );
        if (vm > maxVonMises) maxVonMises = vm;

        // F_elem = B^T * stress * dV
        for (let i = 0; i < elemDOFs; i++) {
          let sum = 0;
          for (let j = 0; j < 6; j++) {
            sum += B[j][i] * stressVoigt[j];
          }
          const fContrib = sum * dV;

          // Scatter to global
          const nodeLocalIdx = Math.floor(i / dofsPerNode);
          const dofLocalIdx = i % dofsPerNode;
          const globalNodeIdx = elem.nodeIndices[nodeLocalIdx];
          const globalDOF = globalNodeIdx * dofsPerNode + dofLocalIdx;

          if (globalDOF < totalDOFs) {
            fInternal[globalDOF] += fContrib;
          }
        }
      });
    });

    return { fInternal, maxVonMises };
  }

  /**
   * Constructs the 6 x elemDOFs linear/large displacement strain-displacement B matrix
   */
  public static buildBMatrix(
    dNdX: number[][],
    dofsPerNode: number,
    nodeCount: number
  ): number[][] {
    const elemDOFs = nodeCount * dofsPerNode;
    const B: number[][] = Array.from({ length: 6 }, () => new Array(elemDOFs).fill(0.0));

    for (let a = 0; a < nodeCount; a++) {
      const colX = a * dofsPerNode;
      const colY = a * dofsPerNode + 1;
      const colZ = dofsPerNode === 3 ? a * dofsPerNode + 2 : -1;

      const dN_dX = dNdX[a][0] || 0;
      const dN_dY = dNdX[a][1] || 0;
      const dN_dZ = dofsPerNode === 3 ? (dNdX[a][2] || 0) : 0;

      // Normal strains
      B[0][colX] = dN_dX;
      B[1][colY] = dN_dY;
      if (colZ >= 0) B[2][colZ] = dN_dZ;

      // Shear strains (engineering strain convention g23, g13, g12)
      if (colZ >= 0) {
        B[3][colY] = dN_dZ;
        B[3][colZ] = dN_dY;

        B[4][colX] = dN_dZ;
        B[4][colZ] = dN_dX;
      }

      B[5][colX] = dN_dY;
      B[5][colY] = dN_dX;
    }

    return B;
  }
}
