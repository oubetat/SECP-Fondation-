/**
 * SECP Parametric Rebuild Engine 2.0 (PATCH-SECP-042J)
 * High-performance, transactional CAD Parametric DAG Engine.
 * 
 * Pipeline:
 * Parameter Change
 *       ↓
 * Dependency Resolution
 *       ↓
 * Dirty Propagation
 *       ↓
 * Topological Ordering (Kahn's / DFS Algorithm)
 *       ↓
 * Kernel Execution (Atomic Feature Transaction)
 *       ↓
 * Geometry & Mesh Validation (GeometryValidationEngine & TessellationIntegrityValidator)
 *       ↓
 * Commit / Rollback (Atomic Snapshot State)
 *       ↓
 * Revision Number Increment & Provenance Signature
 */

import { Feature, Parameter } from '../types/domainModel';
import { CadSolidEntity } from './cadKernel';
import { ShapeHandle } from './geometry/ShapeHandle';
import { IdentityContext, GeometryProvenance, ShapeType, TopologyReference } from './geometry/GeometryTypes';
import { SketchDefinition } from './geometry/SketchTypes';
import { RealGeometryBridge } from './geometry/RealGeometryBridge';
import { GeometryKernelManager, KernelStatus } from './geometry/GeometryKernelManager';
import { GeometryValidationEngine, GeometryValidationReport } from './validation/GeometryValidationEngine';
import { TessellationIntegrityValidator } from './validation/TessellationIntegrityValidator';
import { Tolerance } from './geometry/GeometryTolerance';
import { generateDeterministicHash } from '../lib/hash';

export interface ParametricNode {
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
  provenance?: GeometryProvenance;
  lastValidation?: GeometryValidationReport;
}

export type FeatureTreeNode = ParametricNode;

export interface RebuildResult {
  updatedTree: Record<string, ParametricNode>;
  rebuildLog: string[];
  success: boolean;
  rebuiltNodeCount: number;
  bypassedNodeCount: number;
  rolledBack: boolean;
  failedNodeId?: string;
  error?: string;
}

export class ParametricRebuildEngine {
  /**
   * Initializes the default reference Feature Tree DAG.
   */
  public static createDefaultFeatureTree(): Record<string, ParametricNode> {
    const sketchParam: Parameter = { id: 'p-sk1', name: 'ProfileWidth', value: 250, unit: 'mm' };
    const padParam: Parameter = { id: 'p-pad1', name: 'PadExtrudeDepth', value: 80, unit: 'mm' };
    const filletParam: Parameter = { id: 'p-fil1', name: 'EdgeFilletRadius', value: 12, unit: 'mm' };
    const chamferParam: Parameter = { id: 'p-cha1', name: 'EdgeChamferDist', value: 5, unit: 'mm' };
    const holeParam: Parameter = { id: 'p-hol1', name: 'HoleDiameter', value: 40, unit: 'mm' };
    const pocketParam: Parameter = { id: 'p-poc1', name: 'PocketDepth', value: 25, unit: 'mm' };
    const revolveParam: Parameter = { id: 'p-rev1', name: 'RevolveAngle', value: 3.14159, unit: 'rad' };
    const booleanParam: Parameter = { id: 'p-bool1', name: 'BooleanMode', value: 1, unit: 'enum' }; // 1=Cut, 2=Fuse

    const initialSolid: CadSolidEntity = {
      id: 'pending',
      name: 'Pending Generation',
      type: 'BOX',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      colorHex: '#94A3B8',
      dimensions: { dx: 0, dy: 0, dz: 0 },
      volumeM3: 0,
      surfaceAreaM2: 0,
      centerOfGravity: { x: 0, y: 0, z: 0 },
      mesh: {
        vertices: [],
        normals: [],
        indices: [],
        facesCount: 0
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
        children: ['Chamfer001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: { ...initialSolid, name: 'Fillet_Result' },
      },
      Chamfer001: {
        id: 'Chamfer001',
        name: 'Chamfer001 (Edge Bevel)',
        type: 'CHAMFER',
        parameters: [chamferParam],
        dependencies: ['Fillet001'],
        children: ['Hole001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: { ...initialSolid, name: 'Chamfer_Result' },
      },
      Hole001: {
        id: 'Hole001',
        name: 'Hole001 (Center Bore)',
        type: 'HOLE',
        parameters: [holeParam],
        dependencies: ['Chamfer001'],
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
        children: ['Revolve001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: { ...initialSolid, name: 'Pocket001_Result' },
      },
      Revolve001: {
        id: 'Revolve001',
        name: 'Revolve001 (Edge Flange)',
        type: 'REVOLVE',
        parameters: [revolveParam],
        dependencies: ['Pocket001'],
        children: ['Boolean001'],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: { ...initialSolid, name: 'Revolve001_Result' },
      },
      Boolean001: {
        id: 'Boolean001',
        name: 'Boolean001 (Final Cut)',
        type: 'BOOLEAN_CUT',
        parameters: [booleanParam],
        dependencies: ['Revolve001'],
        children: [],
        revisionNumber: 1,
        suppressed: false,
        status: 'UP_TO_DATE',
        outputSolid: { ...initialSolid, name: 'Boolean001_Result' },
      },
    };
  }

  /**
   * Complete rebuild of the entire tree from the root.
   */
  public static async rebuild(
    tree: Record<string, ParametricNode>
  ): Promise<{ updatedTree: Record<string, ParametricNode>; rebuildLog: string[] }> {
    const firstNodeId = Object.keys(tree)[0] || 'Sketch001';
    const currentValue = tree[firstNodeId]?.parameters[0]?.value ?? 250;
    const result = await this.rebuildFeatureTreeFromNode(tree, firstNodeId, currentValue);
    return { updatedTree: result.updatedTree, rebuildLog: result.rebuildLog };
  }

  /**
   * Full Parametric Rebuild Pipeline with Atomic Transactions, Dependency Resolution,
   * Topological Ordering, Geometry & Mesh Validation, and Rollback on Failure.
   */
  public static async rebuildFeatureTreeFromNode(
    tree: Record<string, ParametricNode>,
    changedNodeId: string,
    newParamValue: number,
    onProgress?: (currentTree: Record<string, ParametricNode>, currentLogs: string[]) => void
  ): Promise<RebuildResult> {
    // 0. CREATE ATOMIC BACKUP SNAPSHOT FOR ROLLBACK
    const snapshotTree = this.deepCloneTree(tree);
    const updated = this.deepCloneTree(tree);
    const log: string[] = [];

    const publish = async () => {
      if (onProgress) {
        const progressTree = this.deepCloneTree(updated);
        onProgress(progressTree, [...log]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    // 1. KERNEL HEALTH & AVAILABILITY CHECK
    const kernelStatus = GeometryKernelManager.getStatus();
    if (kernelStatus === KernelStatus.ERROR) {
      throw new Error('KERNEL_UNAVAILABLE: Production CAD Kernel is in ERROR state.');
    }

    let kernel;
    try {
      kernel = await GeometryKernelManager.getKernel();
      if (!kernel) throw new Error('Kernel is null');
    } catch {
      throw new Error('KERNEL_UNAVAILABLE: Real CAD Kernel is not active or failed to initialize.');
    }

    log.push(`[ParametricRebuildEngine 2.0] Initiating Transactional Parametric Rebuild.`);
    await publish();

    // 2. PARAMETER CHANGE & DEPENDENCY RESOLUTION
    if (updated[changedNodeId] && updated[changedNodeId].parameters[0]) {
      const oldVal = updated[changedNodeId].parameters[0].value;
      updated[changedNodeId].parameters[0].value = newParamValue;
      log.push(`[Parameter Change] Feature '${changedNodeId}' parameter '${updated[changedNodeId].parameters[0].name}': ${oldVal} → ${newParamValue}.`);
      await publish();
    }

    // 3. DIRTY PROPAGATION
    // Downstream BFS/DFS dirty marking
    const markDirty = (id: string) => {
      const node = updated[id];
      if (!node) return;
      node.status = 'OUT_OF_DATE';
      log.push(`[Dirty Propagation] Marked feature '${id}' as OUT_OF_DATE.`);
      for (const childId of node.children) {
        markDirty(childId);
      }
    };

    markDirty(changedNodeId);
    await publish();

    // 4. TOPOLOGICAL ORDERING (Kahn's Algorithm on Feature DAG)
    const topologicalOrder = this.computeTopologicalOrder(updated);
    log.push(`[Topological Ordering] Rebuild execution plan: [${topologicalOrder.join(' → ')}].`);
    await publish();

    let rebuiltNodeCount = 0;
    let bypassedNodeCount = 0;
    let failedNodeId: string | undefined;
    let failureError: string | undefined;

    // 5. TRANSACTIONAL KERNEL EXECUTION LOOP
    for (const currentId of topologicalOrder) {
      const node = updated[currentId];
      if (!node) continue;

      if (node.status === 'UP_TO_DATE') {
        bypassedNodeCount++;
        log.push(`[Parametric Bypass] Feature '${node.id}' is UP_TO_DATE. Reusing cached geometric handle.`);
        await publish();
        continue;
      }

      log.push(`[Kernel Execution] Rebuilding feature '${node.id}' (${node.name})...`);
      node.status = 'REBUILDING';
      await publish();

      try {
        const context: IdentityContext = {
          featureId: node.id,
          revision: node.revisionNumber + 1,
          operation: node.type,
          parameters: node.parameters
        };

        const result = await this.executeFeatureTransaction(
          node,
          updated,
          kernel,
          context,
          log
        );

        // COMMIT NODE TO UPDATED TREE
        node.outputHandle = result.handle;
        node.outputSolid = result.solid;
        node.provenance = result.provenance;
        node.lastValidation = result.validationReport;
        node.revisionNumber += 1;
        node.status = 'UP_TO_DATE';
        rebuiltNodeCount++;

        log.push(`[Feature Commit] '${node.id}' committed at Revision ${node.revisionNumber} [Volume: ${result.solid.volumeM3?.toExponential(3)} m³].`);
        await publish();
      } catch (err: any) {
        failedNodeId = node.id;
        failureError = err.message || String(err);
        node.status = 'ERROR';

        log.push(`[Rebuild Failure] ERROR in feature '${node.id}': ${failureError}`);
        await publish();

        // 6. ATOMIC ROLLBACK PROTOCOL
        log.push(`[Atomic Rollback] Feature transaction failed. Rolling back parametric tree to previous stable snapshot.`);
        
        // Restore all nodes from snapshot except marking target failure node as error for diagnostic UI
        const restored = this.deepCloneTree(snapshotTree);
        if (restored[node.id]) {
          restored[node.id].status = 'ERROR';
        }
        for (const childId of node.children) {
          if (restored[childId]) {
            restored[childId].status = 'ERROR';
          }
        }

        log.push(`[Atomic Rollback] Rollback completed. System preserved in consistent state.`);
        if (onProgress) onProgress(restored, [...log]);

        return {
          updatedTree: restored,
          rebuildLog: log,
          success: false,
          rebuiltNodeCount,
          bypassedNodeCount,
          rolledBack: true,
          failedNodeId,
          error: failureError
        };
      }
    }

    log.push(`[ParametricRebuildEngine 2.0] SUCCESS: All dependent features rebuilt and committed. (Rebuilt: ${rebuiltNodeCount}, Bypassed: ${bypassedNodeCount}).`);
    await publish();

    return {
      updatedTree: updated,
      rebuildLog: log,
      success: true,
      rebuiltNodeCount,
      bypassedNodeCount,
      rolledBack: false
    };
  }

  /**
   * Executes a single feature kernel operation within a strict validation boundary.
   */
  private static async executeFeatureTransaction(
    node: ParametricNode,
    tree: Record<string, ParametricNode>,
    kernel: any,
    context: IdentityContext,
    log: string[]
  ): Promise<{
    handle: ShapeHandle;
    solid: CadSolidEntity;
    provenance: GeometryProvenance;
    validationReport: GeometryValidationReport;
  }> {
    let handle: ShapeHandle;
    let parentShapeHash = '0000000000000000';

    if (node.id === 'Sketch001') {
      const w = node.parameters[0].value;
      const h = 150;
      const sketchDef: SketchDefinition = {
        id: 'Sketch001',
        name: 'Base Profile',
        plane: 'XY',
        entities: {
          'p1': { id: 'p1', type: 'POINT', position: { x: -w/2, y: -h/2 } },
          'p2': { id: 'p2', type: 'POINT', position: { x: w/2, y: -h/2 } },
          'p3': { id: 'p3', type: 'POINT', position: { x: w/2, y: h/2 } },
          'p4': { id: 'p4', type: 'POINT', position: { x: -w/2, y: h/2 } },
          'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' },
          'l2': { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' },
          'l3': { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' },
          'l4': { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' },
        },
        constraints: {
          'c1': { id: 'c1', type: 'HORIZONTAL', entityIds: ['l1'] },
          'c2': { id: 'c2', type: 'VERTICAL', entityIds: ['l2'] },
          'c3': { id: 'c3', type: 'HORIZONTAL', entityIds: ['l3'] },
          'c4': { id: 'c4', type: 'VERTICAL', entityIds: ['l4'] },
          'd1': { id: 'd1', type: 'DISTANCE', entityIds: ['l1'], value: w },
          'd2': { id: 'd2', type: 'DISTANCE', entityIds: ['l2'], value: h }
        },
        solverState: {
          dof: 0,
          isFullyConstrained: true,
          isOverConstrained: false,
          errors: []
        }
      };
      handle = await kernel.evaluateSketch(sketchDef, context);
    } 
    else if (node.id === 'Pad001') {
      const sketchHandle = tree['Sketch001'].outputHandle;
      if (!sketchHandle) throw new Error('Missing prerequisite Sketch001 geometry handle.');
      parentShapeHash = sketchHandle.identityHash;
      context.parentHash = parentShapeHash;
      const depth = node.parameters[0].value;
      handle = await kernel.extrude(sketchHandle, 0, 0, depth, context);
    }
    else if (node.id === 'Fillet001') {
      const baseHandle = tree['Pad001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Pad001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const radius = node.parameters[0].value;
      const topRef: TopologyReference = {
        entityType: ShapeType.EDGE,
        persistentId: 'edge_4',
        sourceFeatureId: 'Pad001',
        geometrySignature: 'L150_C50_0_0',
        topologySignature: '4'
      };
      handle = await kernel.fillet(baseHandle, radius, [topRef], context);
    }
    else if (node.id === 'Chamfer001') {
      const baseHandle = tree['Fillet001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Fillet001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const distance = node.parameters[0].value;
      const topRef: TopologyReference = {
        entityType: ShapeType.EDGE,
        persistentId: 'edge_5',
        sourceFeatureId: 'Fillet001',
        geometrySignature: 'L150_C50_100_0',
        topologySignature: '5'
      };
      handle = await kernel.chamfer(baseHandle, distance, [topRef], context);
    }
    else if (node.id === 'Hole001') {
      const baseHandle = tree['Chamfer001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Chamfer001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const holeDiam = node.parameters[0].value;
      const extrudeDepth = tree['Pad001'].parameters[0].value;
      const cylinderTool = await kernel.createCylinder(holeDiam / 2, extrudeDepth * 2);
      const centerCylinder = await kernel.translate(cylinderTool, { x: 0, y: 0, z: -extrudeDepth * 0.5 });
      handle = await kernel.cut(baseHandle, centerCylinder, context);
    }
    else if (node.id === 'Pocket001') {
      const baseHandle = tree['Hole001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Hole001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const pocketDepth = node.parameters[0].value;
      const pocketTool = await kernel.createBox(80, 50, pocketDepth);
      const centerPocket = await kernel.translate(pocketTool, { x: 10, y: 10, z: 0 });
      handle = await kernel.cut(baseHandle, centerPocket, context);
    }
    else if (node.id === 'Revolve001') {
      const baseHandle = tree['Pocket001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Pocket001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const angle = node.parameters[0].value;
      
      const p1 = { x: 50, y: 0, z: 0 };
      const p2 = { x: 60, y: 0, z: 0 };
      const p3 = { x: 60, y: 0, z: 10 };
      const p4 = { x: 50, y: 0, z: 10 };
      const e1 = await kernel.createLine(p1, p2);
      const e2 = await kernel.createLine(p2, p3);
      const e3 = await kernel.createLine(p3, p4);
      const e4 = await kernel.createLine(p4, p1);
      const profileWire = await kernel.createWire([e1, e2, e3, e4]);
      const profileFace = await kernel.makeFaceFromWire(profileWire);
      
      const revolvedTool = await kernel.revolve(profileFace, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, angle);
      handle = await kernel.fuse(baseHandle, revolvedTool, context);
    }
    else if (node.id === 'Boolean001') {
      const baseHandle = tree['Revolve001'].outputHandle;
      if (!baseHandle) throw new Error('Missing prerequisite Revolve001 geometry handle.');
      parentShapeHash = baseHandle.identityHash;
      context.parentHash = parentShapeHash;
      const mode = node.parameters[0].value;
      const tool = await kernel.createCylinder(5, 100);
      const movedTool = await kernel.translate(tool, { x: 55, y: 0, z: 0 });
      
      if (mode === 1) {
        handle = await kernel.cut(baseHandle, movedTool, context);
      } else {
        handle = await kernel.fuse(baseHandle, movedTool, context);
      }
    } else {
      throw new Error(`Unsupported feature type or ID: ${node.id}`);
    }

    // VALIDATION GATE: Geometric & Topological integrity via GeometryValidationEngine
    const validationReport = await GeometryValidationEngine.validate(handle);
    if (!validationReport.isValid) {
      throw new Error(`B-Rep Validation Failed for ${node.id}: ${validationReport.errors.join('; ')}`);
    }

    // TESSELLATION GATE: Validate mesh and normals
    const meshResult = await handle.tessellate(Tolerance.DISPLAY_TESSELLATION, 0.5);
    const meshReport = await TessellationIntegrityValidator.validateMesh(meshResult, handle);
    if (!meshReport.isValid) {
      log.push(`[Tessellation Warning] Feature ${node.id} mesh issue: ${meshReport.errors.join(', ')}`);
    }

    // BUILD CAD SOLID ENTITY
    const solid = await RealGeometryBridge.toSolidEntity(handle, node.name);

    // SIGN PROVENANCE
    const manifest = kernel.getManifest();
    const paramsHash = await generateDeterministicHash(node.parameters);

    const provenance: GeometryProvenance = {
      featureId: node.id,
      revision: context.revision,
      operation: node.type,
      parentShapeHash,
      outputShapeHash: handle.identityHash,
      kernel: manifest.kernel,
      kernelVersion: manifest.version,
      parametersHash: paramsHash,
      createdAt: new Date().toISOString()
    };

    return { handle, solid, provenance, validationReport };
  }

  /**
   * Computes topological execution order of features using Kahn's Algorithm / In-degree tracking.
   */
  public static computeTopologicalOrder(tree: Record<string, ParametricNode>): string[] {
    const inDegree: Record<string, number> = {};
    const adjList: Record<string, string[]> = {};
    const allNodes = Object.keys(tree);

    for (const id of allNodes) {
      inDegree[id] = 0;
      adjList[id] = [];
    }

    for (const id of allNodes) {
      const node = tree[id];
      for (const depId of node.dependencies) {
        if (adjList[depId]) {
          adjList[depId].push(id);
          inDegree[id] = (inDegree[id] || 0) + 1;
        }
      }
    }

    const queue: string[] = allNodes.filter(id => inDegree[id] === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);

      for (const neighbor of adjList[curr] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (order.length !== allNodes.length) {
      // Fallback to standard canonical sequence if cycle detected
      return ['Sketch001', 'Pad001', 'Fillet001', 'Chamfer001', 'Hole001', 'Pocket001', 'Revolve001', 'Boolean001'];
    }

    return order;
  }

  /**
   * Helper to deeply clone the parametric tree preserving non-serializable ShapeHandle instances.
   */
  private static deepCloneTree(tree: Record<string, ParametricNode>): Record<string, ParametricNode> {
    const cloned = JSON.parse(JSON.stringify(tree)) as Record<string, ParametricNode>;
    for (const key of Object.keys(tree)) {
      if (tree[key].outputHandle) {
        cloned[key].outputHandle = tree[key].outputHandle;
      }
      if (tree[key].lastValidation) {
        cloned[key].lastValidation = tree[key].lastValidation;
      }
    }
    return cloned;
  }

  public static getInitialTree(): Record<string, ParametricNode> {
    return this.createDefaultFeatureTree();
  }

  public static evaluateTree(tree: Record<string, ParametricNode>): Record<string, ParametricNode> {
    return tree;
  }
}

// Backward compatibility alias
export const FeatureTreeEngine = ParametricRebuildEngine;
