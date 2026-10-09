/**
 * SECP CAD Kernel — GCS 3D Constraint Graph
 * Phase 2 (PATCH-026)
 */

import { Geometry3DEntity } from './Constraint3DTypes';
import { Constraint3D } from './Constraint3DModel';

export interface Graph3DNode {
  readonly id: string;
  readonly type: 'ENTITY' | 'DOF' | 'CONSTRAINT';
  readonly label: string;
}

export interface Graph3DEdge {
  readonly from: string;
  readonly to: string;
}

export class Constraint3DGraph {
  private readonly nodes: Map<string, Graph3DNode> = new Map();
  private readonly edges: Set<string> = new Set(); // Stored as "from->to" format for determinism

  public addEntity(entity: Geometry3DEntity): void {
    const id = entity.id.identityId;
    this.nodes.set(id, { id, type: 'ENTITY', label: entity.type });

    // Track associated DOFs
    const dofs = this.getEntityDOFNames(entity.type);
    for (const dof of dofs) {
      const dofId = `${id}:${dof}`;
      this.nodes.set(dofId, { id: dofId, type: 'DOF', label: dof });
      this.addEdge(id, dofId);
    }
  }

  public addConstraint(constraint: Constraint3D): void {
    const cId = constraint.id.identityId;
    this.nodes.set(cId, { id: cId, type: 'CONSTRAINT', label: constraint.type });

    for (const ref of constraint.references) {
      const eId = ref.entityId.identityId;
      this.addEdge(cId, eId);
    }
  }

  private addEdge(from: string, to: string): void {
    this.edges.add(`${from}->${to}`);
    this.edges.add(`${to}->${from}`);
  }

  public getNeighbors(id: string): string[] {
    const neighbors: string[] = [];
    for (const edge of this.edges) {
      if (edge.startsWith(`${id}->`)) {
        neighbors.push(edge.split('->')[1]);
      }
    }
    return neighbors.sort(); // Deterministic sorted traversal
  }

  public getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    const allNodes = Array.from(this.nodes.keys()).sort();

    for (const node of allNodes) {
      if (!visited.has(node)) {
        const comp: string[] = [];
        const queue: string[] = [node];
        visited.add(node);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          comp.push(curr);

          const neighbors = this.getNeighbors(curr);
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        components.push(comp.sort());
      }
    }

    return components;
  }

  private getEntityDOFNames(type: string): string[] {
    switch (type) {
      case 'POINT_3D': return ['x', 'y', 'z'];
      case 'LINE_3D': return ['ox', 'oy', 'oz', 'dx', 'dy', 'dz'];
      case 'PLANE': return ['ox', 'oy', 'oz', 'nx', 'ny', 'nz'];
      case 'AXIS_3D': return ['ox', 'oy', 'oz', 'dx', 'dy', 'dz'];
      case 'CIRCLE_3D': return ['cx', 'cy', 'cz', 'nx', 'ny', 'nz', 'r'];
      case 'CYLINDER_AXIS': return ['ox', 'oy', 'oz', 'dx', 'dy', 'dz', 'r'];
      case 'SPHERE': return ['cx', 'cy', 'cz', 'r'];
      default: return [];
    }
  }
}
