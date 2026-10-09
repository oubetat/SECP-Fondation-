/**
 * SECP CAD/CAE Platform - Assembly Diagnostics Engine
 * PATCH-234 — Global Stiffness Assembly
 *
 * Provides comprehensive pre- and post-assembly auditing for matrix singularities,
 * rigid body motion, zero diagonals, non-finite values, and conditioning metrics.
 */

import { FEMElement } from '../mesh/FEMElement';
import { FEMNode } from '../mesh/FEMNode';
import { CSRStorage } from '../sparse/CSRStorage';
import { DOFManager } from './DOFManager';
import { SparseMatrixDiagnostics, SparseMatrixBuilder } from './SparseMatrixBuilder';

export interface PreAssemblyAudit {
  isValid: boolean;
  missingNodes: string[];
  degenerateElements: string[];
  negativeJacobianElements: string[];
  unconstrainedNodes: string[];
  errors: string[];
  warnings: string[];
}

export interface AssemblyDiagnosticReport {
  preAssemblyAudit: PreAssemblyAudit;
  matrixDiagnostics: SparseMatrixDiagnostics;
  isSolvable: boolean;
  unconstrainedRigidBodyMotionDetected: boolean;
  nonFiniteEntriesDetected: boolean;
  failureReasons: string[];
}

export class AssemblyDiagnostics {
  /**
   * Audits mesh and DOF setup before running matrix assembly.
   */
  public static auditPreAssembly(
    nodes: FEMNode[],
    elements: FEMElement[],
    dofManager: DOFManager
  ): PreAssemblyAudit {
    const nodeSet = new Set(nodes.map((n) => n.id));
    const missingNodes: string[] = [];
    const degenerateElements: string[] = [];
    const negativeJacobianElements: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodes.length === 0) {
      errors.push('Mesh contains zero nodes.');
    }
    if (elements.length === 0) {
      errors.push('Mesh contains zero elements.');
    }

    const referencedNodes = new Set<string>();

    for (const elem of elements) {
      if (!elem.nodeIds || elem.nodeIds.length === 0) {
        errors.push(`Element ${elem.id} has empty nodeIds array.`);
        continue;
      }

      for (const nid of elem.nodeIds) {
        referencedNodes.add(nid);
        if (!nodeSet.has(nid)) {
          missingNodes.push(nid);
          errors.push(`Element ${elem.id} references missing node ID: ${nid}`);
        }
      }

      // Degenerate element check
      const uniqueNids = new Set(elem.nodeIds);
      if (uniqueNids.size < elem.nodeIds.length) {
        degenerateElements.push(elem.id);
        errors.push(`Element ${elem.id} has duplicate node IDs (degenerate connectivity).`);
      }
    }

    const unconstrainedNodes: string[] = [];
    for (const node of nodes) {
      if (!referencedNodes.has(node.id)) {
        unconstrainedNodes.push(node.id);
        warnings.push(`Node ${node.id} is isolated (not attached to any element).`);
      }
    }

    return {
      isValid: errors.length === 0,
      missingNodes: Array.from(new Set(missingNodes)),
      degenerateElements,
      negativeJacobianElements,
      unconstrainedNodes,
      errors,
      warnings
    };
  }

  /**
   * Audits the assembled global CSR stiffness matrix K_global.
   */
  public static auditAssembledSystem(
    preAudit: PreAssemblyAudit,
    csrK: CSRStorage,
    dofManager: DOFManager
  ): AssemblyDiagnosticReport {
    const matrixDiag = SparseMatrixBuilder.diagnoseMatrix(csrK);

    const failureReasons: string[] = [...preAudit.errors];
    let nonFiniteDetected = false;

    // Check non-finite values
    for (let i = 0; i < csrK.nnz; i++) {
      if (Number.isNaN(csrK.values[i]) || !Number.isFinite(csrK.values[i])) {
        nonFiniteDetected = true;
        failureReasons.push(`Non-finite value (NaN/Inf) detected in CSR matrix at entry index ${i}.`);
        break;
      }
    }

    // Check zero prescribed boundary conditions / rigid body modes
    let rigidBodyDetected = false;
    if (dofManager.prescribedDOFCount === 0) {
      rigidBodyDetected = true;
      failureReasons.push('Zero boundary constraints specified. System has unconstrained rigid body modes.');
    }

    if (matrixDiag.hasZeroDiagonal) {
      rigidBodyDetected = true;
      failureReasons.push(
        `Zero diagonal detected at free DOF index ${matrixDiag.zeroDiagonalIndices[0]}. System is singular.`
      );
    }

    const isSolvable =
      preAudit.isValid &&
      !nonFiniteDetected &&
      !rigidBodyDetected &&
      matrixDiag.isSymmetric &&
      csrK.rows > 0;

    return {
      preAssemblyAudit: preAudit,
      matrixDiagnostics: matrixDiag,
      isSolvable,
      unconstrainedRigidBodyMotionDetected: rigidBodyDetected,
      nonFiniteEntriesDetected: nonFiniteDetected,
      failureReasons
    };
  }
}
