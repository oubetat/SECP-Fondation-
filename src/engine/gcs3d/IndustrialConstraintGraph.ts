/**
 * SECP CAD Kernel — Production 3D GCS Constraint Graph
 * Phase 15 (PATCH-173)
 *
 * Implements connected component decomposition, closed loop cycle detection,
 * dependency chains, isolated geometry identification, and topological solver ordering.
 */

import { Spatial3DEntity, Production3DConstraint } from './Production3DGCSTypes';

export interface GraphNode {
  readonly id: string;
  readonly type: 'ENTITY' | 'CONSTRAINT';
  readonly label: string;
  readonly entityType?: string;
  readonly isFixed?: boolean;
}

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly constraintId: string;
  readonly constraintType: string;
}

export interface ClosedLoopChain {
  readonly loopId: string;
  readonly entityIds: string[];
  readonly constraintIds: string[];
  readonly closureDOFCount: number;
}

export class IndustrialConstraintGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];
  private readonly adjacency = new Map<string, Set<string>>();

  constructor(
    entities: Record<string, Spatial3DEntity>,
    constraints: readonly Production3DConstraint[]
  ) {
    this.buildGraph(entities, constraints);
  }

  private buildGraph(
    entities: Record<string, Spatial3DEntity>,
    constraints: readonly Production3DConstraint[]
  ): void {
    // Add Entity Nodes
    for (const ent of Object.values(entities)) {
      this.nodes.set(ent.id, {
        id: ent.id,
        type: 'ENTITY',
        label: ent.name || ent.id,
        entityType: ent.type,
        isFixed: ent.isFixed
      });
      this.adjacency.set(ent.id, new Set());
    }

    // Add Constraint Nodes & Edges
    for (const c of constraints) {
      if (!c.driving) continue;

      this.nodes.set(c.constraintId, {
        id: c.constraintId,
        type: 'CONSTRAINT',
        label: `${c.type} (${c.constraintId})`
      });
      this.adjacency.set(c.constraintId, new Set());

      for (const target of c.entities) {
        if (this.nodes.has(target.entityId)) {
          this.edges.push({
            from: c.constraintId,
            to: target.entityId,
            constraintId: c.constraintId,
            constraintType: c.type
          });
          this.edges.push({
            from: target.entityId,
            to: c.constraintId,
            constraintId: c.constraintId,
            constraintType: c.type
          });

          this.adjacency.get(c.constraintId)!.add(target.entityId);
          this.adjacency.get(target.entityId)!.add(c.constraintId);
        }
      }
    }
  }

  public getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    const entityIds = Array.from(this.nodes.keys())
      .filter(id => this.nodes.get(id)?.type === 'ENTITY')
      .sort();

    for (const startId of entityIds) {
      if (!visited.has(startId)) {
        const comp: string[] = [];
        const queue: string[] = [startId];
        visited.add(startId);

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (this.nodes.get(current)?.type === 'ENTITY') {
            comp.push(current);
          }

          const neighbors = Array.from(this.adjacency.get(current) || []).sort();
          for (const next of neighbors) {
            if (!visited.has(next)) {
              visited.add(next);
              queue.push(next);
            }
          }
        }

        if (comp.length > 0) {
          components.push(comp.sort());
        }
      }
    }

    return components;
  }

  public getIsolatedEntities(): string[] {
    const isolated: string[] = [];
    for (const [id, node] of this.nodes.entries()) {
      if (node.type === 'ENTITY') {
        const neighbors = this.adjacency.get(id);
        if (!neighbors || neighbors.size === 0) {
          isolated.push(id);
        }
      }
    }
    return isolated.sort();
  }

  public detectClosedLoops(): ClosedLoopChain[] {
    const loops: ClosedLoopChain[] = [];
    const entityIds = Array.from(this.nodes.keys())
      .filter(id => this.nodes.get(id)?.type === 'ENTITY')
      .sort();

    const visited = new Set<string>();
    const parentMap = new Map<string, string>();

    const dfs = (curr: string, parent: string, path: string[]) => {
      visited.add(curr);
      path.push(curr);

      const neighbors = Array.from(this.adjacency.get(curr) || []).sort();
      for (const next of neighbors) {
        if (next === parent) continue;

        if (visited.has(next) && path.includes(next)) {
          // Cycle found
          const cycleStartIndex = path.indexOf(next);
          const cyclePath = path.slice(cycleStartIndex);
          const cycleEntities = cyclePath.filter(id => this.nodes.get(id)?.type === 'ENTITY');
          const cycleConstraints = cyclePath.filter(id => this.nodes.get(id)?.type === 'CONSTRAINT');

          if (cycleEntities.length >= 3 && cycleConstraints.length >= 3) {
            const loopKey = [...cycleEntities].sort().join('-');
            if (!loops.some(l => [...l.entityIds].sort().join('-') === loopKey)) {
              loops.push({
                loopId: `LOOP-${loops.length + 1}`,
                entityIds: cycleEntities,
                constraintIds: cycleConstraints,
                closureDOFCount: cycleEntities.length * 3
              });
            }
          }
        } else if (!visited.has(next)) {
          parentMap.set(next, curr);
          dfs(next, curr, [...path]);
        }
      }
    };

    for (const eId of entityIds) {
      if (!visited.has(eId)) {
        dfs(eId, '', []);
      }
    }

    return loops;
  }

  public getSolverOrdering(): string[] {
    const components = this.getConnectedComponents();
    // Deterministically order components by fixed entity presence first, then component size
    return components
      .sort((a, b) => {
        const hasFixedA = a.some(id => this.nodes.get(id)?.isFixed);
        const hasFixedB = b.some(id => this.nodes.get(id)?.isFixed);
        if (hasFixedA && !hasFixedB) return -1;
        if (!hasFixedA && hasFixedB) return 1;
        return b.length - a.length;
      })
      .flat();
  }
}
