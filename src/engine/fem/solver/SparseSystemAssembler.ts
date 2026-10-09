import { CSRStorage } from '../sparse/CSRStorage';
import { SparseAssembler } from '../sparse/SparseAssembler';
import { SparseMatrix } from '../sparse/SparseMatrix';
import { DOFManager } from './DOFManager';
import { StructuralModel } from './StructuralModel';
import { PartitionedSparseSystem } from './types';

export class SparseSystemAssembler {
  /**
   * Assembles full global stiffness matrix K using PATCH-078 SparseAssembler (ZERO dense global matrix)
   * and partitions system into Kff, Kfc, Kcf, Kcc for free/constrained DOFs.
   */
  static assembleAndPartition(
    model: StructuralModel,
    dofManager: DOFManager,
    F_global: number[]
  ): PartitionedSparseSystem {
    // Convert StructuralModel elements into FEMMeshElementInput format for SparseAssembler
    const meshElements = model.elements.map((elem) => {
      const coordinates = elem.nodeIds.map((nodeId) => {
        const node = model.getNode(nodeId);
        if (!node) throw new Error(`Node ${nodeId} not found in model`);
        return node.coordinates;
      });

      const nodeIndices = elem.nodeIds.map((nodeId) => {
        const node = model.getNode(nodeId);
        if (!node) throw new Error(`Node ${nodeId} not found in model`);
        return node.index;
      });

      return {
        id: elem.id,
        type: elem.type,
        nodeIndices,
        coordinates,
        material: elem.material
      };
    });

    const totalDOFs = dofManager.totalDOFs;
    const dofsPerNode = dofManager.dofsPerNode;

    // Direct sparse assembly
    const assemblyResult = SparseAssembler.assembleGlobalStiffness(
      totalDOFs,
      dofsPerNode,
      meshElements
    );

    const K_full = assemblyResult.sparseMatrix;
    const freeIndices = dofManager.getFreeDOFIndices();
    const constrainedIndices = dofManager.getConstrainedDOFIndices();

    const freeCount = freeIndices.length;
    const constrainedCount = constrainedIndices.length;

    // Vectors Ff, Fc, uc
    const Ff = new Array<number>(freeCount);
    for (let i = 0; i < freeCount; i++) {
      Ff[i] = F_global[freeIndices[i]];
    }

    const Fc = new Array<number>(constrainedCount);
    const uc = new Array<number>(constrainedCount);
    for (let i = 0; i < constrainedCount; i++) {
      const idx = constrainedIndices[i];
      Fc[i] = F_global[idx];
      uc[i] = dofManager.globalDOFs[idx].constrainedValue ?? 0;
    }

    // Partition K into Kff, Kfc, Kcf, Kcc
    const Kff = K_full.extractSubmatrix(freeIndices, freeIndices);

    let Kfc: SparseMatrix | undefined;
    let Kcf: SparseMatrix | undefined;
    let Kcc: SparseMatrix | undefined;

    if (constrainedCount > 0) {
      Kfc = K_full.extractSubmatrix(freeIndices, constrainedIndices);
      Kcf = K_full.extractSubmatrix(constrainedIndices, freeIndices);
      Kcc = K_full.extractSubmatrix(constrainedIndices, constrainedIndices);
    }

    // Compute reduced RHS: Ff* = Ff - Kfc * uc
    const reducedFf = [...Ff];
    if (constrainedCount > 0 && Kfc) {
      const Kfc_uc = Kfc.spmv(uc);
      for (let i = 0; i < freeCount; i++) {
        reducedFf[i] -= Kfc_uc[i];
      }
    }

    return {
      totalDOFs,
      freeDOFCount: freeCount,
      constrainedDOFCount: constrainedCount,
      freeDOFIndices: freeIndices,
      constrainedDOFIndices: constrainedIndices,
      Kff,
      Kfc,
      Kcf,
      Kcc,
      Ff,
      Fc,
      uc,
      reducedFf
    };
  }
}
