/**
 * PATCH-276: Engineering Scene Graph
 * Manages persistent scene structure, stable engineering entity identities,
 * visibility/isolation states, selection priorities, and instanced components.
 */

import {
  SceneNode,
  PersistentEntityId,
  SelectionType,
  GeometryRenderBinding,
} from './ViewportTypes276';

export class EngineeringSceneGraph {
  private rootNodes: SceneNode[] = [];
  private nodeMap: Map<string, SceneNode> = new Map();
  private entityIdMap: Map<string, SceneNode> = new Map();
  private bindingsMap: Map<string, GeometryRenderBinding> = new Map();

  constructor() {
    this.initializeDefaultAssembly();
  }

  private initializeDefaultAssembly(): void {
    const defaultAssemblyNode: SceneNode = {
      id: 'NODE-ASSY-001',
      name: 'Mechanical System Assembly',
      type: 'ASSEMBLY',
      persistentIdentity: {
        entityId: 'ASSY-001',
        entityType: 'ASSEMBLY_COMPONENT',
      },
      visible: true,
      isolated: false,
      transparency: 0,
      highlighted: false,
      selected: false,
      transformMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      children: [],
      lodLevel: 'HIGH',
    };

    // Add Engine Block Part
    const blockPart: SceneNode = {
      id: 'NODE-PART-P001',
      name: 'Engine Block Casting',
      type: 'PART',
      persistentIdentity: {
        entityId: 'PART-P001',
        entityType: 'PART',
      },
      visible: true,
      isolated: false,
      transparency: 0,
      highlighted: false,
      selected: false,
      transformMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      children: [
        {
          id: 'NODE-BODY-B001',
          name: 'Main Cylinder Crankcase Body',
          type: 'BODY',
          persistentIdentity: {
            entityId: 'BODY-B001',
            entityType: 'BODY',
            parentPartId: 'PART-P001',
          },
          visible: true,
          isolated: false,
          transparency: 0,
          highlighted: false,
          selected: false,
          transformMatrix: [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
          ],
          children: [
            {
              id: 'NODE-FACE-F182',
              name: 'Top Deck Cylinder Face #1',
              type: 'FACE',
              persistentIdentity: {
                entityId: 'FACE-F182',
                entityType: 'FACE',
                parentBodyId: 'BODY-B001',
                parentPartId: 'PART-P001',
              },
              visible: true,
              isolated: false,
              transparency: 0,
              highlighted: false,
              selected: false,
              transformMatrix: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
              ],
              children: [],
              lodLevel: 'HIGH',
            },
            {
              id: 'NODE-EDGE-E045',
              name: 'Bore Circular Top Edge #1',
              type: 'EDGE',
              persistentIdentity: {
                entityId: 'EDGE-E045',
                entityType: 'EDGE',
                parentBodyId: 'BODY-B001',
                parentPartId: 'PART-P001',
              },
              visible: true,
              isolated: false,
              transparency: 0,
              highlighted: false,
              selected: false,
              transformMatrix: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
              ],
              children: [],
              lodLevel: 'HIGH',
            },
          ],
          lodLevel: 'HIGH',
        },
      ],
      lodLevel: 'HIGH',
    };

    // Add Instanced Bolts (500 Bolts)
    const boltInstancedNode: SceneNode = {
      id: 'NODE-INST-BOLTS',
      name: 'M8 Cylinder Head Bolts (x500)',
      type: 'COMPONENT',
      persistentIdentity: {
        entityId: 'BOLT-SET-500',
        entityType: 'ASSEMBLY_COMPONENT',
      },
      visible: true,
      isolated: false,
      transparency: 0,
      highlighted: false,
      selected: false,
      transformMatrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      children: [],
      lodLevel: 'HIGH',
      instancedCount: 500,
    };

    defaultAssemblyNode.children.push(blockPart, boltInstancedNode);
    this.rootNodes.push(defaultAssemblyNode);

    this.reindexNodes();

    // Register binding
    this.bindingsMap.set('PART-P001', {
      cadEntityId: 'PART-P001',
      renderEntityId: 'RENDER-P001',
      bRepFaceCount: 124,
      bRepEdgeCount: 382,
      bRepVertexCount: 260,
      isStale: false,
      lastUpdatedRevision: 'REV-276.1',
    });
  }

  private reindexNodes(): void {
    this.nodeMap.clear();
    this.entityIdMap.clear();

    const traverse = (node: SceneNode) => {
      this.nodeMap.set(node.id, node);
      if (node.persistentIdentity && node.persistentIdentity.entityId) {
        this.entityIdMap.set(node.persistentIdentity.entityId, node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const root of this.rootNodes) {
      traverse(root);
    }
  }

  public getRoots(): SceneNode[] {
    return this.rootNodes;
  }

  public findNodeById(id: string): SceneNode | undefined {
    return this.nodeMap.get(id);
  }

  public findNodeByEntityId(entityId: string): SceneNode | undefined {
    return this.entityIdMap.get(entityId);
  }

  public setVisibility(entityId: string, visible: boolean): void {
    const node = this.findNodeByEntityId(entityId);
    if (node) {
      node.visible = visible;
    }
  }

  public hideSelected(selectedEntityId: string): void {
    this.setVisibility(selectedEntityId, false);
  }

  public showAll(): void {
    const traverse = (node: SceneNode) => {
      node.visible = true;
      node.isolated = false;
      node.transparency = 0;
      for (const child of node.children) {
        traverse(child);
      }
    };
    for (const root of this.rootNodes) {
      traverse(root);
    }
  }

  public isolateEntity(entityId: string): void {
    const targetNode = this.findNodeByEntityId(entityId);
    if (!targetNode) return;

    const traverse = (node: SceneNode) => {
      if (node.persistentIdentity.entityId === entityId) {
        node.visible = true;
        node.isolated = true;
      } else {
        node.visible = false;
        node.isolated = false;
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const root of this.rootNodes) {
      traverse(root);
    }
  }

  public setTransparency(entityId: string, transparency: number): void {
    const node = this.findNodeByEntityId(entityId);
    if (node) {
      node.transparency = Math.max(0, Math.min(1, transparency));
    }
  }

  public resolveSelectionPriority(candidates: PersistentEntityId[]): PersistentEntityId | null {
    if (candidates.length === 0) return null;

    const priorityOrder: SelectionType[] = ['VERTEX', 'EDGE', 'FACE', 'BODY', 'PART', 'ASSEMBLY_COMPONENT'];

    for (const pType of priorityOrder) {
      const match = candidates.find((c) => c.entityType === pType);
      if (match) return match;
    }

    return candidates[0];
  }

  public getBindingForEntity(cadEntityId: string): GeometryRenderBinding | undefined {
    return this.bindingsMap.get(cadEntityId);
  }

  public addNode(parentNodeId: string | null, newNode: SceneNode): void {
    if (!parentNodeId) {
      this.rootNodes.push(newNode);
    } else {
      const parent = this.findNodeById(parentNodeId);
      if (parent) {
        parent.children.push(newNode);
      }
    }
    this.reindexNodes();
  }

  public getInstancedCount(): number {
    let total = 0;
    for (const node of this.nodeMap.values()) {
      if (node.instancedCount) {
        total += node.instancedCount;
      }
    }
    return total;
  }
}
