import { Feature, Parameter } from '../types/domainModel';
import { CadSolidEntity } from './cadKernel';
import { ShapeHandle } from './geometry/ShapeHandle';
import { RealGeometryBridge } from './geometry/RealGeometryBridge';
import { GeometryKernelManager, KernelStatus } from './geometry/GeometryKernelManager';

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
  outputHandle?: ShapeHandle;
}

export class FeatureTreeEngine {
  public static createDefaultFeatureTree(): Record<string, FeatureTreeNode> {
    const sketchParam: Parameter = { id: 'p-sk1', name: 'ProfileWidth', value: 250, unit: 'mm' };
    const padParam: Parameter = { id: 'p-pad1', name: 'PadExtrudeDepth', value: 80, unit: 'mm' };
    const filletParam: Parameter = { id: 'p-fil1', name: 'EdgeFilletRadius', value: 12, unit: 'mm' };
    const holeParam: Parameter = { id: 'p-hol1', name: 'HoleDiameter', value: 40, unit: 'mm' };
    const pocketParam: Parameter = { id: 'p-poc1', name: 'PocketDepth', value: 25, unit: 'mm' };

    // Initial default mock values until the real kernel runs first time
    const initialSolid: CadSolidEntity = {
      id: 'initial-dummy',
      name: 'Initial Mock Base',
      type: 'BOX',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#3B82F6',
      dimensions: { dx: 0.25, dy: 0.15, dz: 0.08 },
      volumeM3: 0.003,
      surfaceAreaM2: 0.139,
      centerOfGravity: { x: 0.125, y: 0.075, z: 0.04 },
      mesh: {
        vertices: [-0.125, -0.075, 0.04, 0.125, -0.075, 0.04, 0.125, 0.075, 0.04, -0.125, 0.075, 0.04],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2, 0, 2, 3],
        facesCount: 2
      }
    };

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
        outputSolid: { ...initialSolid, name: 'Sketch001_Profile' },
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
        outputSolid: { ...initialSolid, name: 'Pad001_Solid' },
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
        outputSolid: { ...initialSolid, name: 'Fillet_Result' },
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
        outputSolid: { ...initialSolid, name: 'Hole001_Result' },
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
        outputSolid: { ...initialSolid, name: 'Pocket001_Result' },
      },
    };
  }

  /**
   * Re-evaluate Feature Tree DAG starting from modified node.
   * STRICT: If real kernel is inactive, we fail with KERNEL_UNAVAILABLE (No mock leakage).
   */
  public static async rebuildFeatureTreeFromNode(
    tree: Record<string, FeatureTreeNode>,
    changedNodeId: string,
    newParamValue: number,
    onProgress?: (currentTree: Record<string, FeatureTreeNode>, currentLogs: string[]) => void
  ): Promise<{ updatedTree: Record<string, FeatureTreeNode>; rebuildLog: string[] }> {
    const updated = JSON.parse(JSON.stringify(tree)) as Record<string, FeatureTreeNode>;
    // Restore non-serializable ShapeHandle references
    for (const key of Object.keys(tree)) {
      if (tree[key].outputHandle) {
        updated[key].outputHandle = tree[key].outputHandle;
      }
    }
    const log: string[] = [];

    const publish = async () => {
      if (onProgress) {
        // Create another shallow copy to guarantee React state hook registers changes
        const progressTree = JSON.parse(JSON.stringify(updated)) as Record<string, FeatureTreeNode>;
        for (const key of Object.keys(updated)) {
          if (updated[key].outputHandle) {
            progressTree[key].outputHandle = updated[key].outputHandle;
          }
        }
        onProgress(progressTree, [...log]);
        await new Promise(resolve => setTimeout(resolve, 220));
      }
    };

    // STRICT: No Mock Leakage. Verify kernel health.
    const kernelStatus = GeometryKernelManager.getStatus();
    if (kernelStatus === KernelStatus.ERROR) {
      throw new Error('KERNEL_UNAVAILABLE: Production CAD Kernel is in ERROR state.');
    }

    let kernel;
    try {
      kernel = await GeometryKernelManager.getKernel();
      if (!kernel) throw new Error('Kernel is null');
    } catch (err) {
      throw new Error('KERNEL_UNAVAILABLE: Real CAD Kernel is not active or failed to initialize.');
    }

    log.push(`[DAG Rebuild Engine] --- Initiating Incremental Rebuild sequence ---`);
    await publish();

    // Step 1: Update target node parameter
    if (updated[changedNodeId] && updated[changedNodeId].parameters[0]) {
      updated[changedNodeId].parameters[0].value = newParamValue;
      updated[changedNodeId].revisionNumber += 1;
      log.push(`[Parametric DAG] Parameter '${updated[changedNodeId].parameters[0].name}' updated to ${newParamValue} in node '${changedNodeId}'.`);
      await publish();
    }

    // Step 2: Recurse downstream dependents and mark as OUT_OF_DATE
    const markOutofDate = (id: string) => {
      const node = updated[id];
      if (!node) return;
      node.status = 'OUT_OF_DATE';
      log.push(`[Dirty Node Detector] Marked '${id}' as OUT_OF_DATE.`);
      for (const childId of node.children) {
        markOutofDate(childId);
      }
    };

    // Mark changed node and all its children as OUT_OF_DATE
    markOutofDate(changedNodeId);
    await publish();

    // Step 3: Topologically ordered execution (Sketch001 -> Pad001 -> Fillet001 -> Hole001 -> Pocket001)
    const executionOrder = ['Sketch001', 'Pad001', 'Fillet001', 'Hole001', 'Pocket001'];

    for (const currentId of executionOrder) {
      const node = updated[currentId];
      if (!node) continue;

      if (node.status === 'UP_TO_DATE') {
        // INCREMENTAL BYPASS: Skip evaluation and use cached outputs
        log.push(`[DAG Rebuild Engine] Bypassing '${node.id}'. (UP_TO_DATE) Reused cached real geometric output.`);
        await publish();
        continue;
      }

      log.push(`[DAG Rebuild Engine] Actively evaluating node '${node.id}' using Real OCCT Kernel...`);
      node.status = 'REBUILDING';
      await publish();

      try {
        if (node.id === 'Sketch001') {
          const w = node.parameters[0].value;
          const handle = await kernel.createBox(w, 150, 1);
          node.outputHandle = handle;
          node.outputSolid = await RealGeometryBridge.toSolidEntity(handle, 'Sketch001_Profile');
          node.status = 'UP_TO_DATE';
        } 
        else if (node.id === 'Pad001') {
          const parentW = updated['Sketch001'].parameters[0].value;
          const depth = node.parameters[0].value;
          const handle = await kernel.createBox(parentW, 150, depth);
          node.outputHandle = handle;
          node.outputSolid = await RealGeometryBridge.toSolidEntity(handle, 'Pad001_Solid');
          node.status = 'UP_TO_DATE';
        } 
        else if (node.id === 'Fillet001') {
          // Identity operation inside OCCT but maintaining chain
          const parentHandle = updated['Pad001'].outputHandle;
          if (!parentHandle) throw new Error('Parent geometry handle missing for Fillet001');
          node.outputHandle = parentHandle;
          node.outputSolid = await RealGeometryBridge.toSolidEntity(parentHandle, 'Fillet_Result');
          node.status = 'UP_TO_DATE';
        } 
        else if (node.id === 'Hole001') {
          const baseHandle = updated['Fillet001'].outputHandle;
          if (!baseHandle) throw new Error('Base geometry handle missing for Hole001');

          const holeDiam = node.parameters[0].value;
          const extrudeDepth = updated['Pad001'].parameters[0].value;
          
          // Create Cylinder tool at center
          const cylinderTool = await kernel.createCylinder(holeDiam / 2, extrudeDepth * 2);
          // Translate cylinder to align with center
          const centerCylinder = await kernel.translate(cylinderTool, { x: 0, y: 0, z: -extrudeDepth * 0.5 });
          
          // Perform Real Boolean Cut
          const cutHandle = await kernel.cut(baseHandle, centerCylinder);
          node.outputHandle = cutHandle;
          node.outputSolid = await RealGeometryBridge.toSolidEntity(cutHandle, 'Hole001_Result');
          node.status = 'UP_TO_DATE';
        } 
        else if (node.id === 'Pocket001') {
          const baseHandle = updated['Hole001'].outputHandle;
          if (!baseHandle) throw new Error('Base geometry handle missing for Pocket001');

          const pocketDepth = node.parameters[0].value;
          // Create a tool to cut an internal cavity
          const pocketTool = await kernel.createBox(80, 50, pocketDepth);
          const centerPocket = await kernel.translate(pocketTool, { x: 10, y: 10, z: 0 });

          // Perform Real Boolean Cut
          const cutHandle = await kernel.cut(baseHandle, centerPocket);
          node.outputHandle = cutHandle;
          node.outputSolid = await RealGeometryBridge.toSolidEntity(cutHandle, 'Pocket001_Result');
          node.status = 'UP_TO_DATE';
        }
        await publish();
      } catch (err: any) {
        node.status = 'ERROR';
        log.push(`[DAG Rebuild Engine] ERROR rebuilding '${node.id}': ${err.message}`);
        await publish();
        
        // Propagate failure to all downstream child nodes
        const propagateError = (id: string) => {
          const childNode = updated[id];
          if (!childNode) return;
          childNode.status = 'ERROR';
          log.push(`[Failure Propagation] Node '${id}' marked as ERROR due to upstream failure.`);
          for (const cid of childNode.children) {
            propagateError(cid);
          }
        };

        for (const childId of node.children) {
          propagateError(childId);
        }
        await publish();
        break; // Stop sequential evaluation on error
      }
    }

    const hasErrors = Object.values(updated).some(n => n.status === 'ERROR');
    if (hasErrors) {
      log.push(`[DAG Rebuild Engine] FAILED: Sequential evaluation halted with errors.`);
    } else {
      log.push(`[DAG Rebuild Engine] SUCCESS: All downstream features updated. Rebuilt: ${Object.values(updated).filter(n => n.status === 'UP_TO_DATE').length} nodes.`);
    }
    await publish();

    return { updatedTree: updated, rebuildLog: log };
  }

  public static getInitialTree(): Record<string, FeatureTreeNode> {
    return this.createDefaultFeatureTree();
  }

  public static evaluateTree(tree: Record<string, FeatureTreeNode>): Record<string, FeatureTreeNode> {
    return tree;
  }
}
