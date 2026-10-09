/**
 * SECP CAD Kernel — Dimension Dependency Graph
 * PATCH-193: Parametric Sketch Editing & Dimensioning
 */

import { SketchDimension } from './SketchDimensionTypes';
import { EngineeringEventStore } from '../../industrial-os/event-model/EngineeringEventStore';
import { EngineeringObjectOS } from '../../industrial-os/EngineeringObjectOS';

export type FeatureNodeType = 'DIMENSION' | 'CONSTRAINT' | 'ENTITY' | 'PROFILE' | 'EXTRUSION' | 'FEATURE' | 'PART';

export interface DependencyNode {
  id: string;
  name: string;
  type: FeatureNodeType;
  isStale: boolean;
  lastUpdated: string;
  metadata?: Record<string, any>;
}

export interface DependencyEdge {
  fromId: string;
  toId: string;
  relationType: 'DRIVES' | 'REFERENCES' | 'GENERATES' | 'BOUND_TO';
}

export class DimensionDependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private edges: DependencyEdge[] = [];
  private os: EngineeringObjectOS;
  private eventStore: EngineeringEventStore;

  constructor(os?: EngineeringObjectOS, eventStore?: EngineeringEventStore) {
    this.os = os || new EngineeringObjectOS();
    this.eventStore = eventStore || EngineeringEventStore.getInstance();
  }

  public registerDimension(dim: SketchDimension): void {
    this.nodes.set(dim.id, {
      id: dim.id,
      name: dim.name,
      type: 'DIMENSION',
      isStale: false,
      lastUpdated: new Date().toISOString(),
      metadata: { value: dim.value, unit: dim.unit, isDriving: dim.isDriving }
    });

    if (dim.constraintId) {
      this.nodes.set(dim.constraintId, {
        id: dim.constraintId,
        name: `Constraint_${dim.constraintId}`,
        type: 'CONSTRAINT',
        isStale: false,
        lastUpdated: new Date().toISOString()
      });
      this.addEdge(dim.id, dim.constraintId, 'DRIVES');
    }

    for (const entId of dim.entityIds) {
      if (!this.nodes.has(entId)) {
        this.nodes.set(entId, {
          id: entId,
          name: `Entity_${entId}`,
          type: 'ENTITY',
          isStale: false,
          lastUpdated: new Date().toISOString()
        });
      }
      if (dim.constraintId) {
        this.addEdge(dim.constraintId, entId, 'DRIVES');
      } else {
        this.addEdge(dim.id, entId, 'REFERENCES');
      }
    }
  }

  public linkToFeature(
    sourceId: string,
    featureId: string,
    featureType: FeatureNodeType,
    featureName?: string
  ): void {
    if (!this.nodes.has(featureId)) {
      this.nodes.set(featureId, {
        id: featureId,
        name: featureName || `${featureType}_${featureId}`,
        type: featureType,
        isStale: false,
        lastUpdated: new Date().toISOString()
      });
    }
    this.addEdge(sourceId, featureId, 'GENERATES');
  }

  public addEdge(fromId: string, toId: string, relationType: 'DRIVES' | 'REFERENCES' | 'GENERATES' | 'BOUND_TO'): void {
    if (!this.edges.some(e => e.fromId === fromId && e.toId === toId)) {
      this.edges.push({ fromId, toId, relationType });
    }
  }

  public getDownstreamDependencies(startId: string): string[] {
    const visited = new Set<string>();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const edge of this.edges) {
        if (edge.fromId === current && !visited.has(edge.toId)) {
          visited.add(edge.toId);
          queue.push(edge.toId);
        }
      }
    }

    return Array.from(visited);
  }

  public invalidateDimension(dimensionId: string, newValue: number): {
    staleNodeIds: string[];
    affectedFeatures: DependencyNode[];
  } {
    const dimNode = this.nodes.get(dimensionId);
    if (dimNode) {
      dimNode.lastUpdated = new Date().toISOString();
      dimNode.metadata = { ...(dimNode.metadata || {}), value: newValue };
    }

    const downstream = this.getDownstreamDependencies(dimensionId);
    const affectedFeatures: DependencyNode[] = [];

    for (const id of downstream) {
      const node = this.nodes.get(id);
      if (node) {
        node.isStale = true;
        node.lastUpdated = new Date().toISOString();
        affectedFeatures.push(node);
      }
    }

    // Log to EngineeringEventStore
    this.eventStore.append({
      eventType: 'OBJECT_UPDATED',
      actor: { id: 'DIMENSION_ENGINE', type: 'SYSTEM' },
      source: { service: 'SketchEngine', component: 'DimensionDependencyGraph', version: '3.0' },
      objectRefs: [dimensionId, ...downstream],
      correlationId: `DEP-INV-${Math.random().toString(36).substring(2, 9)}`,
      payload: {
        dimensionId,
        newValue,
        downstreamCount: downstream.length,
        affectedIds: downstream
      }
    });

    return {
      staleNodeIds: downstream,
      affectedFeatures
    };
  }

  public getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  public getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): DependencyEdge[] {
    return [...this.edges];
  }

  public clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}
