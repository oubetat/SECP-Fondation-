/**
 * SECP Industrial OS — EPC-007: CAD / CAE / CAM Dependency Graph Service
 */

import { 
  DependencyNode, 
  DependencyEdge, 
  DependencyNodeType, 
  DependencyStatus, 
  DependencyEdgeType,
  DependencyGraph,
  ImpactAnalysisResult,
  DependencyValidationResult
} from './EngineeringDependencyTypes';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { MultidisciplinaryModel, ModelType } from '../MultidisciplinaryModelTypes';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { ProductConfigurationManager } from '../ProductConfigurationManager';

export class EngineeringDependencyGraphService {
  private readonly registry: MultidisciplinaryModelRegistry;
  private readonly configManager: ProductConfigurationManager;

  constructor(registry: MultidisciplinaryModelRegistry, configManager: ProductConfigurationManager) {
    this.registry = registry;
    this.configManager = configManager;
  }

  /**
   * Constructs the dependency graph for a specific product configuration.
   */
  public buildGraph(configurationId: string): DependencyGraph {
    const models = this.registry.getModelsByConfiguration(configurationId);
    const nodes: DependencyNode[] = models.map(m => this.mapModelToNode(m));
    const edges: DependencyEdge[] = [];

    for (const model of models) {
      for (const depId of model.dependencyIds) {
        // Try to find the specific revision from provenance
        const provDep = model.provenance.dependencies.find(d => d.startsWith(`${depId}@`));
        const depRevision = provDep ? provDep.split('@')[1] : undefined;
        
        const depModel = this.registry.getModel(depId, depRevision);
        if (depModel) {
          edges.push(this.createEdge(model, depModel));
        } else {
          // Record broken edge to a virtual missing node
          edges.push({
            dependencyId: `DEP-${model.modelId}-MISSING-${depId}`,
            sourceNodeId: model.modelId,
            targetNodeId: depId,
            dependencyType: DependencyEdgeType.REVISION_DEPENDENCY,
            sourceRevision: model.modelRevision,
            targetRevision: depRevision || 'UNKNOWN',
            createdAt: new Date().toISOString(),
            status: DependencyStatus.MISSING
          });
        }
      }
    }

    return {
      nodes,
      edges,
      graphId: `GRAPH-${configurationId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configurationId
    };
  }

  /**
   * Analyzes impact of a revision change.
   */
  public analyzeImpact(changedNodeId: string, newRevision: string, graph: DependencyGraph): ImpactAnalysisResult {
    const directImpacts: string[] = [];
    const indirectImpacts: string[] = [];
    const staleArtifacts: string[] = [];
    const brokenArtifacts: string[] = [];
    const requiresRegeneration: string[] = [];
    const requiresReverification: string[] = [];

    const queue = [changedNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const dependents = graph.edges.filter(e => e.targetNodeId === currentId);
      for (const edge of dependents) {
        const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId);
        if (!sourceNode) continue;

        if (currentId === changedNodeId) {
          directImpacts.push(sourceNode.id);
        } else {
          indirectImpacts.push(sourceNode.id);
        }

        staleArtifacts.push(sourceNode.id);
        
        // Logic for regeneration/reverification
        if (edge.dependencyType === DependencyEdgeType.GEOMETRY_DEPENDENCY || 
            edge.dependencyType === DependencyEdgeType.MESH_DEPENDENCY) {
          requiresRegeneration.push(sourceNode.id);
        } else {
          requiresReverification.push(sourceNode.id);
        }

        queue.push(sourceNode.id);
      }
    }

    return {
      directImpacts,
      indirectImpacts,
      staleArtifacts,
      brokenArtifacts,
      requiresRegeneration,
      requiresReverification
    };
  }

  /**
   * Validates the dependency graph for a configuration.
   */
  public validateGraph(graph: DependencyGraph): DependencyValidationResult {
    const issues: string[] = [];
    let verdict: DependencyStatus = DependencyStatus.CURRENT;

    // 1. Cycle Detection
    if (this.hasCycles(graph)) {
      issues.push('Circular dependencies detected');
      verdict = DependencyStatus.INVALID;
    }

    // 2. Broken Dependencies
    for (const edge of graph.edges) {
      const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
      if (!targetNode) {
        issues.push(`Broken link: Node ${edge.sourceNodeId} references missing node ${edge.targetNodeId}`);
        verdict = DependencyStatus.BROKEN;
      }
    }

    // 3. Stale Detection
    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
      
      if (sourceNode && targetNode) {
        // Find actual current revision in registry
        const latestTarget = this.registry.getModel(targetNode.id);
        if (latestTarget && latestTarget.modelRevision !== edge.targetRevision) {
          issues.push(`Stale dependency: Node ${sourceNode.id} depends on version ${edge.targetRevision} of ${targetNode.id}, but ${latestTarget.modelRevision} is available`);
          if (verdict === DependencyStatus.CURRENT) verdict = DependencyStatus.STALE;
        }
      }
    }

    // 4. Configuration Consistency
    for (const node of graph.nodes) {
      if (node.configurationId !== graph.configurationId) {
        issues.push(`Incompatible configuration: Node ${node.id} belongs to ${node.configurationId}, but graph is for ${graph.configurationId}`);
        verdict = DependencyStatus.INCOMPATIBLE;
      }
    }

    // 5. Hash Integrity
    for (const edge of graph.edges) {
      const sourceNode = graph.nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
      
      if (sourceNode?.contentHash && targetNode?.contentHash) {
         // Placeholder for more complex hash matching if SECP provides mapping
         // If a model directly records the hash of its dependency, we should check it.
      }
    }

    return {
      isValid: verdict === DependencyStatus.CURRENT,
      verdict,
      issues,
      timestamp: new Date().toISOString()
    };
  }

  private mapModelToNode(model: MultidisciplinaryModel): DependencyNode {
    return {
      id: model.modelId,
      type: this.mapModelTypeToNodeType(model.modelType),
      revision: model.modelRevision,
      status: this.mapLifecycleToStatus(model.lifecycleStatus),
      sourceReference: model.artifactReference,
      configurationId: model.configurationId,
      createdAt: model.createdAt,
      updatedAt: model.createdAt, // Using createdAt as baseline
      contentHash: model.contentHash,
      metadata: {
        domain: model.domain,
        productId: model.productId
      }
    };
  }

  private createEdge(source: MultidisciplinaryModel, target: MultidisciplinaryModel): DependencyEdge {
    return {
      dependencyId: `DEP-${source.modelId}-${target.modelId}`,
      sourceNodeId: source.modelId,
      targetNodeId: target.modelId,
      dependencyType: this.determineDependencyType(source, target),
      sourceRevision: source.modelRevision,
      targetRevision: target.modelRevision,
      createdAt: new Date().toISOString(),
      status: DependencyStatus.CURRENT
    };
  }

  private mapModelTypeToNodeType(type: ModelType): DependencyNodeType {
    switch (type) {
      case ModelType.CAD: return DependencyNodeType.CAD_REVISION;
      case ModelType.FEA:
      case ModelType.CFD:
      case ModelType.THERMAL:
      case ModelType.DYNAMICS:
        return DependencyNodeType.CAE_MODEL;
      case ModelType.MANUFACTURING: return DependencyNodeType.CAM_OPERATION;
      default: return DependencyNodeType.CAE_MODEL;
    }
  }

  private mapLifecycleToStatus(status: string): DependencyStatus {
    // Simplified mapping
    if (status === 'RELEASED') return DependencyStatus.CURRENT;
    if (status === 'OBSOLETE') return DependencyStatus.INVALID;
    return DependencyStatus.CURRENT;
  }

  private determineDependencyType(source: MultidisciplinaryModel, target: MultidisciplinaryModel): DependencyEdgeType {
    if (source.geometryReference && source.geometryReference === target.artifactReference) return DependencyEdgeType.GEOMETRY_DEPENDENCY;
    if (source.meshReference && source.meshReference === target.artifactReference) return DependencyEdgeType.MESH_DEPENDENCY;
    if (source.modelType === ModelType.MANUFACTURING) return DependencyEdgeType.MANUFACTURING_DEPENDENCY;
    
    // Fallback for tests or other linkages
    if (source.modelType === ModelType.FEA || source.modelType === ModelType.CFD) {
      return DependencyEdgeType.GEOMETRY_DEPENDENCY;
    }

    return DependencyEdgeType.REVISION_DEPENDENCY;
  }

  private hasCycles(graph: DependencyGraph): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const check = (nodeId: string): boolean => {
      visited.add(nodeId);
      stack.add(nodeId);

      const neighbors = graph.edges.filter(e => e.sourceNodeId === nodeId).map(e => e.targetNodeId);
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          if (check(neighborId)) return true;
        } else if (stack.has(neighborId)) {
          return true;
        }
      }

      stack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (check(node.id)) return true;
      }
    }

    return false;
  }
}
