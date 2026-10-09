/**
 * SECP CAD/CAE Platform - Element Connectivity Engine
 * PATCH-234 — Global Stiffness Assembly
 *
 * Validates node existence, establishes local-to-global DOF mappings,
 * and audits element topological connectivity.
 */

import { FEMElement } from '../mesh/FEMElement';
import { FEMNode } from '../mesh/FEMNode';
import { DOFField, DOFManager } from './DOFManager';

export interface ElementDOFMapping {
  elementId: string;
  elementTypeId: string;
  nodeIds: string[];
  localDofIndices: number[]; // e.g. [0, 1, 2, 3, 4, 5]
  globalDofIndices: number[]; // e.g. [12, 13, 14, 27, 28, 29]
  dofsPerNode: number;
}

export class ElementConnectivity {
  /**
   * Validates that all node IDs referenced by elements exist in the mesh node map.
   */
  public static validateConnectivity(
    nodes: FEMNode[],
    elements: FEMElement[]
  ): { isValid: boolean; missingNodes: string[]; errors: string[] } {
    const nodeSet = new Set(nodes.map((n) => n.id));
    const missingNodes: string[] = [];
    const errors: string[] = [];

    for (const elem of elements) {
      if (!elem.nodeIds || elem.nodeIds.length === 0) {
        errors.push(`Element ${elem.id} has no node IDs specified.`);
        continue;
      }

      for (const nid of elem.nodeIds) {
        if (!nodeSet.has(nid)) {
          missingNodes.push(nid);
          errors.push(`Element ${elem.id} references non-existent node ID: ${nid}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      missingNodes: Array.from(new Set(missingNodes)),
      errors
    };
  }

  /**
   * Computes the Local-to-Global DOF mapping for a specific element.
   */
  public static buildElementDOFMapping(
    element: FEMElement,
    dofManager: DOFManager,
    fields: DOFField[] = ['UX', 'UY', 'UZ']
  ): ElementDOFMapping {
    const globalDofIndices: number[] = [];
    const localDofIndices: number[] = [];

    let localCounter = 0;
    for (const nodeId of element.nodeIds) {
      for (const field of fields) {
        const gIdx = dofManager.getGlobalDOFIndex(nodeId, field);
        globalDofIndices.push(gIdx);
        localDofIndices.push(localCounter++);
      }
    }

    return {
      elementId: element.id,
      elementTypeId: element.type,
      nodeIds: [...element.nodeIds],
      localDofIndices,
      globalDofIndices,
      dofsPerNode: fields.length
    };
  }
}
