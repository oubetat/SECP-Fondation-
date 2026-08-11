/**
 * PATCH-SECP-007 — Feature Tree & Parametric Dependency Graph
 * Machine -> Sketch001 -> Pad001 -> Fillet001 -> Hole001 -> Pocket001 -> Assembly001
 * Parametric DAG propagation ensures modifying Sketch automatically re-calculates downstream features.
 */

import { Feature, Parameter } from '../types/domainModel';
import { CadGeometryKernel, CadSolidEntity } from './cadKernel';

export interface FeatureTreeNode {
  id: string;
  name: string;
  type: Feature['type'];
  parameters: Parameter[];
  dependencies: string[]; // Parent Feature IDs
  children: string[]; // Child Feature IDs
  revisionNumber: number;
  suppressed: boolean;
  status: 'UP_TO_DATE' | 'OUT_OF_DATE' | 'REBUILDING' | 'ERROR';
  outputSolid: CadSolidEntity;
}

export class FeatureTreeEngine {
  public static createDefaultFeatureTree(): Record<string, FeatureTreeNode> {
    const sketchParam: Parameter = { id: 'p-sk1', name: 'ProfileWidth', value: 250, unit: 'mm' };
    const padParam: Parameter = { id: 'p-pad1', name: 'PadExtrudeDepth', value: 80, unit: 'mm' };
    const filletParam: Parameter = { id: 'p-fil1', name: 'EdgeFilletRadius', value: 12, unit: 'mm' };
    const holeParam: Parameter = { id: 'p-hol1', name: 'HoleDiameter', value: 40, unit: 'mm' };
    const pocketParam: Parameter = { id: 'p-poc1', name: 'PocketDepth', value: 25, unit: 'mm' };

    const sketchSolid = CadGeometryKernel.createBox(sketchParam.value, 150, 1, 'Sketch001_Profile');
    const padSolid = CadGeometryKernel.createBox(sketchParam.value, 150, padParam.value, 'Pad001_Solid');
    const filletSolid = CadGeometryKernel.applyFillet(padSolid, filletParam.value);
    
    const holeTool = CadGeometryKernel.createCylinder(holeParam.value / 2, padParam.value * 1.5, 'Hole001_Tool');
    const holeSolid = CadGeometryKernel.applyBooleanOperation(filletSolid, holeTool, 'CUT');

    const pocketTool = CadGeometryKernel.createBox(100, 60, pocketParam.value, 'Pocket001_Tool');
    const pocketSolid = CadGeometryKernel.applyBooleanOperation(holeSolid, pocketTool, 'CUT');

    return {
      Sketch001: {
        id: 'Sketch001',
        name: 'Sketch001 (Base Profile)',
        type: 'SKETCH',
        parameters: [sketchParam],
        dependencies: [],
        children: ['Pad001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: sketchSolid,
      },
      Pad001: {
        id: 'Pad001',
        name: 'Pad001 (Main Body Extrude)',
        type: 'PAD_EXTRUDE',
        parameters: [padParam],
        dependencies: ['Sketch001'],
        children: ['Fillet001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: padSolid,
      },
      Fillet001: {
        id: 'Fillet001',
        name: 'Fillet001 (Corner Rounding)',
        type: 'FILLET',
        parameters: [filletParam],
        dependencies: ['Pad001'],
        children: ['Hole001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: filletSolid,
      },
      Hole001: {
        id: 'Hole001',
        name: 'Hole001 (Center Bore)',
        type: 'HOLE',
        parameters: [holeParam],
        dependencies: ['Fillet001'],
        children: ['Pocket001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: holeSolid,
      },
      Pocket001: {
        id: 'Pocket001',
        name: 'Pocket001 (Internal Cavity)',
        type: 'POCKET',
        parameters: [pocketParam],
        dependencies: ['Hole001'],
        children: [],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: pocketSolid,
      },
    };
  }

  /**
   * Re-evaluate Feature Tree DAG starting from modified node
   */
  public static rebuildFeatureTreeFromNode(
    tree: Record<string, FeatureTreeNode>,
    changedNodeId: string,
    newParamValue: number
  ): { updatedTree: Record<string, FeatureTreeNode>; rebuildLog: string[] } {
    const updated = { ...tree };
    const log: string[] = [];

    // Step 1: Update node parameter
    if (updated[changedNodeId] && updated[changedNodeId].parameters[0]) {
      updated[changedNodeId].parameters[0].value = newParamValue;
      updated[changedNodeId].revisionNumber += 1;
      log.push(`[Parametric DAG] Parameter '${updated[changedNodeId].parameters[0].name}' updated to ${newParamValue} in ${changedNodeId}.`);
    }

    // Topological DAG Rebuild Queue
    const queue = [changedNodeId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const node = updated[currentId];
      if (!node) continue;

      log.push(`[DAG Rebuild Engine] Re-evaluating geometry for '${node.id}'...`);
      node.status = 'UP_TO_DATE';

      // Recompute outputs based on parents
      if (node.id === 'Sketch001') {
        const w = node.parameters[0].value;
        node.outputSolid = CadGeometryKernel.createBox(w, 150, 1, 'Sketch001_Profile');
      } else if (node.id === 'Pad001') {
        const parentW = updated['Sketch001'].parameters[0].value;
        const depth = node.parameters[0].value;
        node.outputSolid = CadGeometryKernel.createBox(parentW, 150, depth, 'Pad001_Solid');
      } else if (node.id === 'Fillet001') {
        const padSolid = updated['Pad001'].outputSolid;
        const filRad = node.parameters[0].value;
        node.outputSolid = CadGeometryKernel.applyFillet(padSolid, filRad);
      } else if (node.id === 'Hole001') {
        const filletSolid = updated['Fillet001'].outputSolid;
        const holeDiam = node.parameters[0].value;
        const tool = CadGeometryKernel.createCylinder(holeDiam / 2, 200, 'Hole_Tool');
        node.outputSolid = CadGeometryKernel.applyBooleanOperation(filletSolid, tool, 'CUT');
      } else if (node.id === 'Pocket001') {
        const holeSolid = updated['Hole001'].outputSolid;
        const pDepth = node.parameters[0].value;
        const tool = CadGeometryKernel.createBox(100, 60, pDepth, 'Pocket_Tool');
        node.outputSolid = CadGeometryKernel.applyBooleanOperation(holeSolid, tool, 'CUT');
      }

      // Add children to queue
      for (const childId of node.children) {
        if (!queue.includes(childId)) queue.push(childId);
      }
    }

    log.push(`[DAG Rebuild Engine] SUCCESS: All downstream features updated automatically.`);
    return { updatedTree: updated, rebuildLog: log };
  }

  public static getInitialTree(): Record<string, FeatureTreeNode> {
    return this.createDefaultFeatureTree();
  }

  public static evaluateTree(tree: Record<string, FeatureTreeNode>): Record<string, FeatureTreeNode> {
    return tree;
  }
}
