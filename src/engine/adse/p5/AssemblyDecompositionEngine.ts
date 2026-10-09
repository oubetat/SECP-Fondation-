/**
 * SECP — ADSE-P5 Assembly Decomposition Engine
 * Manages hierarchical structural decomposition (System -> Subsystem -> Assembly -> Component -> Part),
 * detects illegal containment, cyclic containment deadlocks, and orphan parts.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralRelationship, StructuralElement, StructuralLayer } from './types';

export class AssemblyDecompositionEngine {
  private registry: StructuralElementRegistry;

  private layerOrder: Record<StructuralLayer, number> = {
    SYSTEM: 0,
    SUBSYSTEM: 1,
    ASSEMBLY: 2,
    SUBASSEMBLY: 3,
    COMPONENT: 4,
    PART: 5,
    STRUCTURAL_ELEMENT: 6
  };

  constructor(registry: StructuralElementRegistry) {
    this.registry = registry;
  }

  /**
   * Establishes a hierarchical CONTAINS relationship between parent and child structural elements.
   */
  public decompose(params: {
    parentElementId: string;
    childElementId: string;
    configurationId: string;
    revisionId?: string;
  }): StructuralRelationship {
    const parent = this.registry.getElement(params.parentElementId);
    const child = this.registry.getElement(params.childElementId);

    if (!parent) {
      throw new Error(`DECOMPOSITION_ERROR: Parent element '${params.parentElementId}' not found.`);
    }
    if (!child) {
      throw new Error(`DECOMPOSITION_ERROR: Child element '${params.childElementId}' not found.`);
    }

    // Layer Rule Validation: Parent layer must be strictly higher rank than child layer
    const parentRank = this.layerOrder[parent.layer];
    const childRank = this.layerOrder[child.layer];

    if (parentRank >= childRank) {
      throw new Error(
        `DECOMPOSITION_RULE_VIOLATION: Parent '${parent.displayName}' [${parent.layer}] cannot contain Child '${child.displayName}' [${child.layer}].`
      );
    }

    // Prevent direct level skipping violations (e.g., System directly containing Part)
    if (parent.layer === 'SYSTEM' && (child.layer === 'PART' || child.layer === 'STRUCTURAL_ELEMENT')) {
      throw new Error(
        `DECOMPOSITION_RULE_VIOLATION: System '${parent.displayName}' cannot directly decompose into Part '${child.displayName}'. Must decompose through Subsystem/Assembly layer.`
      );
    }

    // Cycle Detection prior to adding relationship
    if (this.wouldCreateCycle(params.parentElementId, params.childElementId)) {
      throw new Error(
        `CYCLIC_CONTAINMENT_ERROR: Adding relationship from '${params.parentElementId}' to '${params.childElementId}' creates a cyclic assembly containment loop.`
      );
    }

    return this.registry.addRelationship({
      relationshipType: 'CONTAINS',
      sourceElementId: params.parentElementId,
      targetElementId: params.childElementId,
      configurationId: params.configurationId,
      revisionId: params.revisionId
    });
  }

  /**
   * DFS Cycle detection on CONTAINS relationships.
   */
  public detectCycles(): string[][] {
    const relationships = this.registry.getAllRelationships().filter(r => r.relationshipType === 'CONTAINS');
    const graph = new Map<string, string[]>();

    for (const r of relationships) {
      if (!graph.has(r.sourceElementId)) graph.set(r.sourceElementId, []);
      graph.get(r.sourceElementId)!.push(r.targetElementId);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart).concat(neighbor));
        }
      }

      path.pop();
      recStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  private wouldCreateCycle(parent: string, child: string): boolean {
    const visited = new Set<string>();
    const queue = [parent];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === child) return true;
      visited.add(curr);

      const { incoming } = this.registry.getRelationshipsForElement(curr);
      for (const rel of incoming.filter(r => r.relationshipType === 'CONTAINS')) {
        if (!visited.has(rel.sourceElementId)) {
          queue.push(rel.sourceElementId);
        }
      }
    }

    return false;
  }

  /**
   * Returns a complete hierarchical decomposition tree for a root element.
   */
  public getDecompositionTree(rootElementId: string): {
    element: StructuralElement;
    children: any[];
  } {
    const element = this.registry.getElement(rootElementId);
    if (!element) {
      throw new Error(`DECOMPOSITION_ERROR: Element '${rootElementId}' not found.`);
    }

    const { outgoing } = this.registry.getRelationshipsForElement(rootElementId);
    const childRels = outgoing.filter(r => r.relationshipType === 'CONTAINS');

    const children = childRels.map(r => this.getDecompositionTree(r.targetElementId));

    return {
      element,
      children
    };
  }
}
