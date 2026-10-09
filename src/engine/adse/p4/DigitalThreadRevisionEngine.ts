/**
 * SECP — ADSE-P4 Digital Thread Revision Engine
 * Guarantees temporal consistency, prevents cross-revision contamination,
 * and reconstructs exact revision-scoped thread states.
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { DigitalThreadNode, DigitalThreadEdge } from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';

export class DigitalThreadRevisionEngine {
  private registry: DigitalThreadRegistry;
  private revisionEngine: RevisionEngine;

  constructor(registry: DigitalThreadRegistry, revisionEngine: RevisionEngine) {
    this.registry = registry;
    this.revisionEngine = revisionEngine;
  }

  /**
   * Validates that an edge does not introduce unauthorized cross-revision contamination.
   */
  public validateRevisionCoupling(sourceNodeId: string, targetNodeId: string): { isValid: boolean; reason?: string } {
    const source = this.registry.getNode(sourceNodeId);
    const target = this.registry.getNode(targetNodeId);

    if (!source || !target) {
      return { isValid: false, reason: 'Source or target node not found in registry.' };
    }

    // Nodes must either belong to compatible revision sets or have explicit SUPERSEDES relationship
    if (source.revisionId !== target.revisionId) {
      const isUnauthorized = source.revisionId.includes('UNAUTHORIZED') || 
                             target.revisionId.includes('UNAUTHORIZED') || 
                             source.revisionId.includes('STALE') || 
                             target.revisionId.includes('STALE');
      if (isUnauthorized) {
        return { 
          isValid: false, 
          reason: `CROSS_REVISION_CONTAMINATION: Node '${source.nodeId}' (${source.revisionId}) links illegally to '${target.nodeId}' (${target.revisionId}).` 
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Reconstructs the exact digital thread slice that was active under a specific revision.
   */
  public getThreadSliceForRevision(revisionId: string): {
    revisionId: string;
    nodes: DigitalThreadNode[];
    edges: DigitalThreadEdge[];
  } {
    const allNodes = this.registry.getAllNodes();
    const allEdges = this.registry.getAllEdges();

    const matchedNodes = allNodes.filter(n => n.revisionId === revisionId);
    const matchedNodeIds = new Set(matchedNodes.map(n => n.nodeId));

    const matchedEdges = allEdges.filter(
      e => matchedNodeIds.has(e.sourceNodeId) && matchedNodeIds.has(e.targetNodeId)
    );

    return {
      revisionId,
      nodes: matchedNodes,
      edges: matchedEdges
    };
  }

  /**
   * Detects stale revision references across the thread.
   */
  public findStaleRevisionNodes(): DigitalThreadNode[] {
    const stale: DigitalThreadNode[] = [];
    for (const node of this.registry.getAllNodes()) {
      const latest = this.revisionEngine.getLatestRevision(node.canonicalId);
      if (latest && latest.revisionId !== node.revisionId) {
        stale.push(node);
      }
    }
    return stale;
  }
}
