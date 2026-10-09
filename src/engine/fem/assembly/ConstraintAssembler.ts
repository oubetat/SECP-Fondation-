/**
 * SECP CAD/CAE Platform - Constraint & Boundary Condition Assembler
 * PATCH-234 — Global Stiffness Assembly
 *
 * Enforces Dirichlet boundary conditions on the global stiffness system (K_global, F_global)
 * via direct elimination, row/column modification, or partitioning.
 */

import { CSRStorage } from '../sparse/CSRStorage';
import { COOBuilder } from '../sparse/COOBuilder';
import { DOFManager } from './DOFManager';

export interface PrescribedConstraint {
  nodeId: string;
  field: 'UX' | 'UY' | 'UZ' | 'ROTX' | 'ROTY' | 'ROTZ';
  value: number;
}

export interface SystemPartition {
  Kff: CSRStorage;
  Kfc: CSRStorage;
  freeRHS: number[];
  freeIndices: number[];
  prescribedIndices: number[];
}

export class ConstraintAssembler {
  /**
   * Applies prescribed boundary conditions using exact Row-Column Modification method.
   * Modifies K and F in-place (returning new modified CSR K_mod and F_mod).
   */
  public static applyRowColumnModification(
    csrK: CSRStorage,
    F_global: number[],
    dofManager: DOFManager
  ): { K_mod: CSRStorage; F_mod: number[]; modifiedCount: number } {
    const totalDOFs = csrK.rows;
    const F_mod = [...F_global];
    const prescribedIndices = dofManager.getPrescribedIndices();

    if (prescribedIndices.length === 0) {
      return { K_mod: csrK, F_mod, modifiedCount: 0 };
    }

    // Map prescribed index -> prescribed value
    const prescribedMap = new Map<number, number>();
    for (const pIdx of prescribedIndices) {
      const desc = dofManager.getDescriptor(pIdx);
      prescribedMap.set(pIdx, desc.prescribedValue ?? 0.0);
    }

    // 1. Adjust Load Vector F_mod for prescribed values: F_j -= K_ji * u_i
    for (const [pIdx, u_prescribed] of prescribedMap.entries()) {
      if (Math.abs(u_prescribed) > 1e-12) {
        for (let r = 0; r < totalDOFs; r++) {
          if (!prescribedMap.has(r)) {
            const K_ji = csrK.get(r, pIdx);
            F_mod[r] -= K_ji * u_prescribed;
          }
        }
      }
    }

    // 2. Rebuild COO with modified rows and columns
    const coo = new COOBuilder(totalDOFs, totalDOFs, csrK.nnz);

    for (let r = 0; r < totalDOFs; r++) {
      if (prescribedMap.has(r)) {
        const u_prescribed = prescribedMap.get(r)!;
        coo.add(r, r, 1.0);
        F_mod[r] = u_prescribed;
      } else {
        const entries = csrK.getRowEntries(r);
        for (const e of entries) {
          if (prescribedMap.has(e.col)) {
            // Column is prescribed -> zeroed out in non-prescribed row
            continue;
          }
          coo.add(r, e.col, e.val);
        }
      }
    }

    const K_mod = coo.toCSR('RETAIN', 0.0);
    return {
      K_mod,
      F_mod,
      modifiedCount: prescribedIndices.length
    };
  }

  /**
   * Partitions system into Free and Constrained sets: Kff * uf = Ff - Kfc * uc
   */
  public static partitionSystem(
    csrK: CSRStorage,
    F_global: number[],
    dofManager: DOFManager
  ): SystemPartition {
    const freeIndices = dofManager.getFreeIndices();
    const prescribedIndices = dofManager.getPrescribedIndices();

    const nFree = freeIndices.length;
    const nPrescribed = prescribedIndices.length;

    const cooKff = new COOBuilder(nFree, nFree, Math.round(csrK.nnz * 0.8));
    const cooKfc = new COOBuilder(nFree, Math.max(nPrescribed, 1), Math.round(csrK.nnz * 0.2));

    const freeMap = new Map<number, number>();
    freeIndices.forEach((gIdx, fIdx) => freeMap.set(gIdx, fIdx));

    const prescribedMap = new Map<number, number>();
    prescribedIndices.forEach((gIdx, pIdx) => prescribedMap.set(gIdx, pIdx));

    const freeRHS = new Array<number>(nFree).fill(0.0);

    for (let i = 0; i < nFree; i++) {
      const gRow = freeIndices[i];
      freeRHS[i] = F_global[gRow];

      const entries = csrK.getRowEntries(gRow);
      for (const e of entries) {
        if (freeMap.has(e.col)) {
          cooKff.add(i, freeMap.get(e.col)!, e.val);
        } else if (prescribedMap.has(e.col)) {
          const pLocalIdx = prescribedMap.get(e.col)!;
          cooKfc.add(i, pLocalIdx, e.val);

          const desc = dofManager.getDescriptor(e.col);
          const u_prescribed = desc.prescribedValue ?? 0.0;
          freeRHS[i] -= e.val * u_prescribed;
        }
      }
    }

    return {
      Kff: cooKff.toCSR('RETAIN', 0.0),
      Kfc: cooKfc.toCSR('RETAIN', 0.0),
      freeRHS,
      freeIndices,
      prescribedIndices
    };
  }
}
