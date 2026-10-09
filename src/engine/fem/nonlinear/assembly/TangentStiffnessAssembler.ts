/**
 * SECP Industrial OS v3 — Tangent Stiffness Assembler (PATCH-238)
 *
 * Assembles the consistent global tangent stiffness matrix K_t = K_mat + K_geo:
 * - K_mat = \sum_e \int B^T * D^{ep} * B * dV (consistent elastoplastic material tangent)
 * - K_geo = \sum_e \int G^T * M_\sigma * G * dV (geometric initial stress stiffness)
 * - Returns both Dense Matrix and Sparse CSR/CSC Matrix representations
 */

import { Matrix } from '../../core/MathUtils';
import { MaterialPointStateTracker } from '../materials/MaterialPointStateTracker';
import { ReturnMappingOptions } from '../types/NonlinearStructuralTypes';
import { InternalForceAssembler, ElementGeometryData } from './InternalForceAssembler';

export interface SparseMatrixCSR {
  dimension: number;
  rowPointers: number[];
  columnIndices: number[];
  values: number[];
  nnz: number;
}

export class TangentStiffnessAssembler {
  /**
   * Assembles global tangent stiffness matrix K_t
   */
  public static assembleTangentStiffness(
    elements: ElementGeometryData[],
    currentDisplacements: number[],
    stateTracker: MaterialPointStateTracker,
    options: ReturnMappingOptions,
    totalDOFs: number,
    dofsPerNode: number = 2,
    includeGeometricStiffness: boolean = true
  ): { kGlobal: Matrix; sparseCSR: SparseMatrixCSR; nnz: number } {
    const kGlobal = Matrix.zeros(totalDOFs, totalDOFs);

    elements.forEach(elem => {
      const nodeCount = elem.nodeIndices.length;
      const elemDOFs = nodeCount * dofsPerNode;

      elem.gaussPoints.forEach((gp, gpIdx) => {
        // Retrieve current material state & consistent algorithmic tangent D^{ep}
        const state = stateTracker.getState(elem.elementId, gpIdx);
        const B = InternalForceAssembler.buildBMatrix(gp.dNdX, dofsPerNode, nodeCount);

        // Re-evaluate return map for consistent tangent D^{ep}
        const returnMapRes = stateTracker.updatePointState(
          elem.elementId,
          gpIdx,
          state.strainVoigt,
          options
        );

        const D_ep = returnMapRes.consistentTangent6x6;
        const dV = gp.weight;

        // 1. K_mat = B^T * D_ep * B * dV
        // Temp = D_ep * B (6 x elemDOFs)
        const DB: number[][] = Array.from({ length: 6 }, () => new Array(elemDOFs).fill(0.0));
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < elemDOFs; c++) {
            let s = 0;
            for (let k = 0; k < 6; k++) {
              s += D_ep[r][k] * B[k][c];
            }
            DB[r][c] = s;
          }
        }

        // Element K_mat = B^T * DB * dV
        for (let r = 0; r < elemDOFs; r++) {
          for (let c = 0; c < elemDOFs; c++) {
            let s = 0;
            for (let k = 0; k < 6; k++) {
              s += B[k][r] * DB[k][c];
            }
            const val = s * dV;

            const globalRow = elem.nodeIndices[Math.floor(r / dofsPerNode)] * dofsPerNode + (r % dofsPerNode);
            const globalCol = elem.nodeIndices[Math.floor(c / dofsPerNode)] * dofsPerNode + (c % dofsPerNode);

            if (globalRow < totalDOFs && globalCol < totalDOFs) {
              kGlobal.set(globalRow, globalCol, kGlobal.get(globalRow, globalCol) + val);
            }
          }
        }

        // 2. K_geo = G^T * M_\sigma * G * dV (Geometric Stiffness)
        if (includeGeometricStiffness) {
          const G = this.buildGeometricGMatrix(gp.dNdX, dofsPerNode, nodeCount);
          const M_sigma = this.buildStressTensorBlock(returnMapRes.stressVoigt);

          // MG = M_sigma * G (9 x elemDOFs)
          const MG: number[][] = Array.from({ length: 9 }, () => new Array(elemDOFs).fill(0.0));
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < elemDOFs; c++) {
              let s = 0;
              for (let k = 0; k < 9; k++) {
                s += M_sigma[r][k] * G[k][c];
              }
              MG[r][c] = s;
            }
          }

          // Element K_geo = G^T * MG * dV
          for (let r = 0; r < elemDOFs; r++) {
            for (let c = 0; c < elemDOFs; c++) {
              let s = 0;
              for (let k = 0; k < 9; k++) {
                s += G[k][r] * MG[k][c];
              }
              const valGeo = s * dV;

              const globalRow = elem.nodeIndices[Math.floor(r / dofsPerNode)] * dofsPerNode + (r % dofsPerNode);
              const globalCol = elem.nodeIndices[Math.floor(c / dofsPerNode)] * dofsPerNode + (c % dofsPerNode);

              if (globalRow < totalDOFs && globalCol < totalDOFs) {
                kGlobal.set(globalRow, globalCol, kGlobal.get(globalRow, globalCol) + valGeo);
              }
            }
          }
        }
      });
    });

    const sparseCSR = this.convertToCSR(kGlobal);

    return {
      kGlobal,
      sparseCSR,
      nnz: sparseCSR.nnz
    };
  }

  /**
   * Builds the 9 x elemDOFs displacement gradient matrix G
   */
  private static buildGeometricGMatrix(
    dNdX: number[][],
    dofsPerNode: number,
    nodeCount: number
  ): number[][] {
    const elemDOFs = nodeCount * dofsPerNode;
    const G: number[][] = Array.from({ length: 9 }, () => new Array(elemDOFs).fill(0.0));

    for (let a = 0; a < nodeCount; a++) {
      const colX = a * dofsPerNode;
      const colY = a * dofsPerNode + 1;
      const colZ = dofsPerNode === 3 ? a * dofsPerNode + 2 : -1;

      const dN_dX = dNdX[a][0] || 0;
      const dN_dY = dNdX[a][1] || 0;
      const dN_dZ = dofsPerNode === 3 ? (dNdX[a][2] || 0) : 0;

      // du/dX, du/dY, du/dZ
      G[0][colX] = dN_dX;
      G[1][colX] = dN_dY;
      if (colZ >= 0) G[2][colX] = dN_dZ;

      // dv/dX, dv/dY, dv/dZ
      G[3][colY] = dN_dX;
      G[4][colY] = dN_dY;
      if (colZ >= 0) G[5][colY] = dN_dZ;

      // dw/dX, dw/dY, dw/dZ
      if (colZ >= 0) {
        G[6][colZ] = dN_dX;
        G[7][colZ] = dN_dY;
        G[8][colZ] = dN_dZ;
      }
    }

    return G;
  }

  /**
   * Constructs the 9x9 block diagonal stress matrix M_sigma
   */
  private static buildStressTensorBlock(stressVoigt: number[]): number[][] {
    const M: number[][] = Array.from({ length: 9 }, () => new Array(9).fill(0.0));

    const s11 = stressVoigt[0];
    const s22 = stressVoigt[1];
    const s33 = stressVoigt[2];
    const s23 = stressVoigt[3];
    const s13 = stressVoigt[4];
    const s12 = stressVoigt[5];

    const block = [
      [s11, s12, s13],
      [s12, s22, s23],
      [s13, s23, s33]
    ];

    for (let d = 0; d < 3; d++) {
      const offset = d * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          M[offset + i][offset + j] = block[i][j];
        }
      }
    }

    return M;
  }

  /**
   * Converts a dense Matrix into Compressed Sparse Row (CSR) format
   */
  public static convertToCSR(matrix: Matrix): SparseMatrixCSR {
    const dim = matrix.rows;
    const rowPointers: number[] = [0];
    const columnIndices: number[] = [];
    const values: number[] = [];

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const val = matrix.get(i, j);
        if (Math.abs(val) > 1e-14) {
          columnIndices.push(j);
          values.push(val);
        }
      }
      rowPointers.push(values.length);
    }

    return {
      dimension: dim,
      rowPointers,
      columnIndices,
      values,
      nnz: values.length
    };
  }
}
