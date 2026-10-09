/**
 * SECP Industrial OS v3 — PATCH-180: Assembly Instance Graph
 * Hierarchical instance graph separating Component Definitions from Component Instances.
 * Handles transform hierarchies, deep pathing, suppression, isolation, and selection.
 */

import { Vector3D } from '../../cadKernel';
import { 
  NodeID, 
  InstanceID, 
  ComponentDefinitionID, 
  AssemblyPath, 
  AssemblyNode, 
  ComponentInstance, 
  ComponentDefinition, 
  Matrix4x4, 
  BoundingBox3D 
} from './MassiveAssemblyTypes';
import { AssemblyMath } from './AssemblyMath';
import { GeometryInstanceManager } from './GeometryInstanceManager';

export class AssemblyInstanceGraph {
  private nodes: Map<NodeID, AssemblyNode> = new Map();
  private instances: Map<InstanceID, ComponentInstance> = new Map();
  private rootNodeId: NodeID = 'ROOT_ASSEMBLY';
  private pathMap: Map<AssemblyPath, InstanceID> = new Map();
  private instancesByDef: Map<ComponentDefinitionID, Set<InstanceID>> = new Map();

  constructor() {
    this.createRootNode();
  }

  private createRootNode(): void {
    const rootNode: AssemblyNode = {
      nodeId: this.rootNodeId,
      name: 'Master Industrial Assembly',
      type: 'ROOT',
      parentId: null,
      childrenIds: [],
      localTransform: AssemblyMath.createIdentityMatrix(),
      worldTransform: AssemblyMath.createIdentityMatrix(),
      worldBounds: AssemblyMath.createAABB({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      isDirty: false,
      isSuppressed: false,
      isHidden: false
    };
    this.nodes.set(this.rootNodeId, rootNode);
  }

  public getRootNode(): AssemblyNode {
    return this.nodes.get(this.rootNodeId)!;
  }

  public getNode(nodeId: NodeID): AssemblyNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getInstance(instanceId: InstanceID): ComponentInstance | undefined {
    return this.instances.get(instanceId);
  }

  public getAllInstances(): ComponentInstance[] {
    return Array.from(this.instances.values());
  }

  public getInstancesCount(): number {
    return this.instances.size;
  }

  public getInstancesByDefinition(defId: ComponentDefinitionID): InstanceID[] {
    const set = this.instancesByDef.get(defId);
    return set ? Array.from(set) : [];
  }

  /**
   * Adds a Subassembly Node to the graph
   */
  public addSubassembly(
    name: string,
    parentNodeId: NodeID = this.rootNodeId,
    localTransform: Matrix4x4 = AssemblyMath.createIdentityMatrix()
  ): NodeID {
    const parent = this.nodes.get(parentNodeId);
    if (!parent) throw new Error(`Parent node ${parentNodeId} not found`);

    const nodeId: NodeID = `SUBASSY_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const worldTransform = AssemblyMath.multiplyMatrices(parent.worldTransform, localTransform);

    const subNode: AssemblyNode = {
      nodeId,
      name,
      type: 'SUBASSEMBLY',
      parentId: parentNodeId,
      childrenIds: [],
      localTransform,
      worldTransform,
      worldBounds: AssemblyMath.createAABB({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
      isDirty: true,
      isSuppressed: parent.isSuppressed,
      isHidden: parent.isHidden
    };

    this.nodes.set(nodeId, subNode);
    parent.childrenIds.push(nodeId);
    return nodeId;
  }

  /**
   * Instantiates a Component into the assembly graph referencing a shared ComponentDefinition
   */
  public addComponentInstance(
    definition: ComponentDefinition,
    parentNodeId: NodeID = this.rootNodeId,
    localTransform: Matrix4x4 = AssemblyMath.createIdentityMatrix(),
    importanceWeight: number = 1.0
  ): InstanceID {
    const parent = this.nodes.get(parentNodeId);
    if (!parent) throw new Error(`Parent node ${parentNodeId} not found`);

    const instanceIndex = (this.instancesByDef.get(definition.definitionId)?.size || 0) + 1;
    const instanceId: InstanceID = `INST_${definition.definitionId}_${String(instanceIndex).padStart(5, '0')}`;
    const nodeId: NodeID = `NODE_${instanceId}`;

    // Build hierarchical assembly path
    const path = this.buildAssemblyPath(parent, `${definition.name}_#${instanceIndex}`);

    // Compute World Transform
    const worldTransform = AssemblyMath.multiplyMatrices(parent.worldTransform, localTransform);

    // Compute World Bounds & Sphere
    const worldBounds = AssemblyMath.transformAABB(definition.nominalBounds, worldTransform);
    const worldSphere = AssemblyMath.aabbToSphere(worldBounds);

    const instance: ComponentInstance = {
      instanceId,
      definitionId: definition.definitionId,
      parentNodeId: nodeId,
      path,
      persistentId: `PERSIST_${instanceId}`,
      localTransform,
      worldTransform,
      worldBounds,
      worldSphere,
      lifecycleState: 'FULL',
      visibilityState: 'VISIBLE',
      currentLOD: 'LOD0_FULL',
      targetLOD: 'LOD0_FULL',
      isSuppressed: parent.isSuppressed,
      isSelected: false,
      isIsolated: false,
      isHighlighted: false,
      importanceWeight,
      lastVisibleDistance: 0,
      lastScreenPixelSize: 0
    };

    const node: AssemblyNode = {
      nodeId,
      name: `${definition.name} #${instanceIndex}`,
      type: 'COMPONENT_INSTANCE',
      parentId: parentNodeId,
      childrenIds: [],
      instanceId,
      localTransform,
      worldTransform,
      worldBounds,
      isDirty: false,
      isSuppressed: parent.isSuppressed,
      isHidden: parent.isHidden
    };

    this.nodes.set(nodeId, node);
    this.instances.set(instanceId, instance);
    this.pathMap.set(path, instanceId);

    parent.childrenIds.push(nodeId);

    if (!this.instancesByDef.has(definition.definitionId)) {
      this.instancesByDef.set(definition.definitionId, new Set());
    }
    this.instancesByDef.get(definition.definitionId)!.add(instanceId);

    definition.totalInstancesCount++;

    return instanceId;
  }

  private buildAssemblyPath(parent: AssemblyNode, leafName: string): AssemblyPath {
    const parts: string[] = [leafName];
    let curr: AssemblyNode | undefined = parent;
    while (curr && curr.parentId) {
      parts.unshift(curr.name);
      curr = this.nodes.get(curr.parentId);
    }
    parts.unshift('Root');
    return parts.join('/');
  }

  /**
   * Updates an instance transform and propagates down the tree
   */
  public updateInstanceLocalTransform(
    instanceId: InstanceID,
    newLocalTransform: Matrix4x4,
    definitionManager: GeometryInstanceManager
  ): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;

    inst.localTransform = newLocalTransform;
    const node = this.nodes.get(inst.parentNodeId);
    if (!node) return;

    node.localTransform = newLocalTransform;

    const parent = node.parentId ? this.nodes.get(node.parentId) : null;
    const parentWorld = parent ? parent.worldTransform : AssemblyMath.createIdentityMatrix();

    inst.worldTransform = AssemblyMath.multiplyMatrices(parentWorld, newLocalTransform);
    node.worldTransform = inst.worldTransform;

    const def = definitionManager.getDefinition(inst.definitionId);
    if (def) {
      inst.worldBounds = AssemblyMath.transformAABB(def.nominalBounds, inst.worldTransform);
      inst.worldSphere = AssemblyMath.aabbToSphere(inst.worldBounds);
      node.worldBounds = inst.worldBounds;
    }
  }

  /**
   * Selection, Suppression and Isolation Operations
   */
  public setSelection(instanceId: InstanceID | null): void {
    for (const inst of this.instances.values()) {
      inst.isSelected = inst.instanceId === instanceId;
    }
  }

  public setSuppressed(instanceId: InstanceID, suppressed: boolean): void {
    const inst = this.instances.get(instanceId);
    if (inst) {
      inst.isSuppressed = suppressed;
      inst.lifecycleState = suppressed ? 'SUPPRESSED' : 'FULL';
      inst.visibilityState = suppressed ? 'SUPPRESSED' : 'VISIBLE';
    }
  }

  public setIsolation(isolatedInstanceId: InstanceID | null): void {
    if (!isolatedInstanceId) {
      for (const inst of this.instances.values()) {
        inst.isIsolated = false;
        inst.visibilityState = inst.isSuppressed ? 'SUPPRESSED' : 'VISIBLE';
      }
      return;
    }

    for (const inst of this.instances.values()) {
      inst.isIsolated = inst.instanceId === isolatedInstanceId;
      if (inst.isIsolated) {
        inst.visibilityState = 'ISOLATED';
      } else {
        inst.visibilityState = 'HIDDEN';
      }
    }
  }

  /**
   * Recomputes bounding boxes of all subassemblies upwards from leaves
   */
  public updateHierarchicalBoundingBoxes(): BoundingBox3D {
    return this.computeNodeBounds(this.rootNodeId);
  }

  private computeNodeBounds(nodeId: NodeID): BoundingBox3D {
    const node = this.nodes.get(nodeId);
    if (!node) return AssemblyMath.createAABB({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    if (node.type === 'COMPONENT_INSTANCE' && node.instanceId) {
      const inst = this.instances.get(node.instanceId);
      return inst ? inst.worldBounds : node.worldBounds;
    }

    if (node.childrenIds.length === 0) {
      return node.worldBounds;
    }

    let combined = this.computeNodeBounds(node.childrenIds[0]);
    for (let i = 1; i < node.childrenIds.length; i++) {
      const childBox = this.computeNodeBounds(node.childrenIds[i]);
      combined = AssemblyMath.unionAABB(combined, childBox);
    }

    node.worldBounds = combined;
    return combined;
  }
}
