/**
 * SECP Industrial OS — EPC-007: CAD / CAE / CAM Dependency Graph Validator
 */

import { 
  DependencyGraph, 
  DependencyNode, 
  DependencyEdge, 
  DependencyStatus, 
  DependencyValidationResult 
} from './EngineeringDependencyTypes';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';

export class DependencyGraphValidator {
  private readonly registry: MultidisciplinaryModelRegistry;

  constructor(registry: MultidisciplinaryModelRegistry) {
    this.registry = registry;
  }

  /**
   * Performs full validation of the dependency graph.
   */
  public validate(graph: DependencyGraph): DependencyValidationResult {
    const issues: string[] = [];
    let verdict: DependencyStatus = DependencyStatus.CURRENT;

    // 1. Structural Checks
    this.checkOrphans(graph, issues);
    this.checkMissingNodes(graph, issues);
    
    // 2. Cycle Detection
    if (this.hasCycles(graph)) {
      issues.push('CRITICAL_FAILURE: Dependency cycle detected in engineering graph.');
      verdict = DependencyStatus.INVALID;
    }

    // 3. Stale Dependency Detection (Revision Propagation)
    this.checkStaleness(graph, issues, verdict);

    // 4. Broken Reference Detection
    this.checkBrokenReferences(graph, issues, verdict);

    // 5. Configuration Consistency (EPC-005)
    this.checkConfigurationConsistency(graph, issues, verdict);

    // 6. Hash / Content Integrity
    this.checkHashIntegrity(graph, issues, verdict);

    // Update verdict if issues found
    if (issues.some(i => i.includes('CRITICAL_FAILURE') || i.includes('BROKEN') || i.includes('INCOMPATIBLE') || i.includes('HASH_MISMATCH'))) {
      verdict = DependencyStatus.INVALID;
    } else if (issues.length > 0 && verdict === DependencyStatus.CURRENT) {
      verdict = DependencyStatus.STALE;
    }

    return {
      isValid: verdict === DependencyStatus.CURRENT,
      verdict,
      issues,
      timestamp: new Date().toISOString()
    };
  }

  private checkOrphans(graph: DependencyGraph, issues: string[]): void {
    const criticalTypes = ['CAD_REVISION', 'MESH', 'SIMULATION'];
    for (const node of graph.nodes) {
      if (criticalTypes.includes(node.type)) {
        const hasEdges = graph.edges.some(e => e.sourceNodeId === node.id || e.targetNodeId === node.id);
        if (!hasEdges) {
          issues.push(`ORPHAN_NODE: Critical artifact ${node.id} (${node.type}) has no dependency relationships.`);
        }
      }
    }
  }

  private checkMissingNodes(graph: DependencyGraph, issues: string[]): void {
    for (const edge of graph.edges) {
      const source = graph.nodes.find(n => n.id === edge.sourceNodeId);
      const target = graph.nodes.find(n => n.id === edge.targetNodeId);
      if (!source) issues.push(`BROKEN_EDGE: Source node ${edge.sourceNodeId} missing from graph.`);
      if (!target || edge.status === DependencyStatus.MISSING) {
        issues.push(`BROKEN_EDGE: Target node ${edge.targetNodeId} missing from registry (requested by ${edge.sourceNodeId}).`);
      }
    }
  }

  private checkStaleness(graph: DependencyGraph, issues: string[], verdict: DependencyStatus): void {
    for (const edge of graph.edges) {
      const targetNode = graph.nodes.find(n => n.id === edge.targetNodeId);
      if (targetNode) {
        const registryLatest = this.registry.getModel(targetNode.id);
        if (registryLatest && registryLatest.modelRevision !== edge.targetRevision) {
          issues.push(`STALE_DEPENDENCY: Node ${edge.sourceNodeId} depends on obsolete REV ${edge.targetRevision} of ${targetNode.id}. Latest: ${registryLatest.modelRevision}`);
        }
      }
    }
  }

  private checkBrokenReferences(graph: DependencyGraph, issues: string[], verdict: DependencyStatus): void {
    // Already partially covered by checkMissingNodes, but here we check registry existence
    for (const node of graph.nodes) {
      if (!this.registry.getModel(node.id, node.revision)) {
        issues.push(`BROKEN_REFERENCE: Node ${node.id} REV ${node.revision} not found in MultidisciplinaryModelRegistry.`);
      }
    }
  }

  private checkConfigurationConsistency(graph: DependencyGraph, issues: string[], verdict: DependencyStatus): void {
    for (const node of graph.nodes) {
      if (node.configurationId !== graph.configurationId) {
        issues.push(`INCOMPATIBLE_CONFIGURATION: Node ${node.id} configuration ${node.configurationId} does not match graph configuration ${graph.configurationId}.`);
      }
    }
  }

  private checkHashIntegrity(graph: DependencyGraph, issues: string[], verdict: DependencyStatus): void {
    for (const node of graph.nodes) {
      const registryModel = this.registry.getModel(node.id, node.revision);
      if (registryModel && node.contentHash && registryModel.contentHash !== node.contentHash) {
        issues.push(`HASH_MISMATCH: Integrity violation for ${node.id}. Graph hash: ${node.contentHash}, Registry hash: ${registryModel.contentHash}`);
      }
    }
  }

  private hasCycles(graph: DependencyGraph): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      stack.add(nodeId);

      const dependents = graph.edges
        .filter(e => e.sourceNodeId === nodeId)
        .map(e => e.targetNodeId);

      for (const depId of dependents) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (stack.has(depId)) {
          return true;
        }
      }

      stack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }
}
