/**
 * SECP CAD Kernel — GCS Constraint Graph
 * Phase 2 (PATCH-025)
 */

import { SketchEntity } from '../SketchEntity';
import { SketchConstraint } from './ConstraintModel';

export interface GraphNode {
  readonly id: string;
  readonly type: 'ENTITY' | 'DOF' | 'CONSTRAINT';
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
}

export class ConstraintGraph {
  private readonly nodes: Map<string, GraphNode> = new Map();
  private readonly edges: Set<string> = new Set(); // Stored as "from->to"

  public addEntity(entity: SketchEntity): void {
    const id = entity.id.projectId;
    this.nodes.set(id, { id, type: 'ENTITY' });
  }

  public addConstraint(constraint: SketchConstraint): void {
    const cId = constraint.id.projectId;
    this.nodes.set(cId, { id: cId, type: 'CONSTRAINT' });

    for (const ref of constraint.references) {
      const eId = ref.entityId.projectId;
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
    return neighbors.sort(); // Deterministic traversal
  }

  public listNodes(): GraphNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
