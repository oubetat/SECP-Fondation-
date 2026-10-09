/**
 * SECP — ADSE-P4 Digital Thread Traceability Engine
 * Performs bidirectional lineage exploration:
 * - Forward Traceability (Requirement -> Evidence/Outcome)
 * - Backward Traceability (Evidence/Artifact -> Requirement)
 * - Complete Truth Chain Reconstruction
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { 
  DigitalThreadNode, 
  DigitalThreadEdge, 
  EngineeringLineage, 
  CompleteTruthChainLineage,
  ThreadAuthoritySource,
  ThreadNodeType
} from './types';
import { createHash } from 'crypto';

export class DigitalThreadTraceabilityEngine {
  private registry: DigitalThreadRegistry;

  constructor(registry: DigitalThreadRegistry) {
    this.registry = registry;
  }

  /**
   * Forward Trace: Traverses downstream from a starting node to all dependent/derived outcomes.
   */
  public forwardTrace(startNodeId: string, maxDepth: number = 20): {
    nodes: DigitalThreadNode[];
    edges: DigitalThreadEdge[];
    visitedIds: string[];
  } {
    const visited = new Set<string>();
    const resultNodes: DigitalThreadNode[] = [];
    const resultEdges: DigitalThreadEdge[] = [];
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      const node = this.registry.getNode(nodeId);
      if (node) {
        resultNodes.push(node);
      }

      const { outgoing } = this.registry.getEdgesForNode(nodeId);
      for (const edge of outgoing) {
        resultEdges.push(edge);
        if (!visited.has(edge.targetNodeId)) {
          queue.push({ nodeId: edge.targetNodeId, depth: depth + 1 });
        }
      }
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      visitedIds: Array.from(visited)
    };
  }

  /**
   * Backward Trace: Traverses upstream from an outcome/evidence back to its foundational requirements/intent.
   */
  public backwardTrace(startNodeId: string, maxDepth: number = 20): {
    nodes: DigitalThreadNode[];
    edges: DigitalThreadEdge[];
    visitedIds: string[];
  } {
    const visited = new Set<string>();
    const resultNodes: DigitalThreadNode[] = [];
    const resultEdges: DigitalThreadEdge[] = [];
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      const node = this.registry.getNode(nodeId);
      if (node) {
        resultNodes.push(node);
      }

      const { incoming } = this.registry.getEdgesForNode(nodeId);
      for (const edge of incoming) {
        resultEdges.push(edge);
        if (!visited.has(edge.sourceNodeId)) {
          queue.push({ nodeId: edge.sourceNodeId, depth: depth + 1 });
        }
      }
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      visitedIds: Array.from(visited)
    };
  }

  /**
   * Explores full bidirectional engineering lineage for an artifact.
   */
  public getEngineeringLineage(nodeId: string): EngineeringLineage {
    const rootNode = this.registry.getNode(nodeId);
    if (!rootNode) {
      throw new Error(`TRACEABILITY_ERROR: Root node '${nodeId}' not found.`);
    }

    const fwd = this.forwardTrace(nodeId);
    const bwd = this.backwardTrace(nodeId);

    const allNodesMap = new Map<string, DigitalThreadNode>();
    for (const n of [...fwd.nodes, ...bwd.nodes]) {
      allNodesMap.set(n.nodeId, n);
    }

    const allEdgesMap = new Map<string, DigitalThreadEdge>();
    for (const e of [...fwd.edges, ...bwd.edges]) {
      allEdgesMap.set(e.edgeId, e);
    }

    const authoritiesInvolved: ThreadAuthoritySource[] = Array.from(
      new Set(Array.from(allNodesMap.values()).map(n => n.authoritySource))
    );

    return {
      rootNodeId: rootNode.nodeId,
      rootCanonicalId: rootNode.canonicalId,
      rootType: rootNode.nodeType,
      forwardTrace: fwd.nodes.filter(n => n.nodeId !== nodeId),
      backwardTrace: bwd.nodes.filter(n => n.nodeId !== nodeId),
      edges: Array.from(allEdgesMap.values()),
      authoritiesInvolved,
      isComplete: authoritiesInvolved.length >= 3,
      isVerified: Array.from(allEdgesMap.values()).every(e => e.isVerified)
    };
  }

  /**
   * Traverses the entire connected truth graph component (undirected traversal across incoming & outgoing edges).
   */
  public getConnectedLineage(startNodeId: string, maxDepth: number = 30): {
    nodes: DigitalThreadNode[];
    edges: DigitalThreadEdge[];
  } {
    const visited = new Set<string>();
    const resultNodes: DigitalThreadNode[] = [];
    const resultEdges: DigitalThreadEdge[] = [];
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);

      const node = this.registry.getNode(nodeId);
      if (node) {
        resultNodes.push(node);
      }

      const { outgoing, incoming } = this.registry.getEdgesForNode(nodeId);
      for (const edge of [...outgoing, ...incoming]) {
        if (!resultEdges.some(e => e.edgeId === edge.edgeId)) {
          resultEdges.push(edge);
        }
        const neighborId = edge.sourceNodeId === nodeId ? edge.targetNodeId : edge.sourceNodeId;
        if (!visited.has(neighborId)) {
          queue.push({ nodeId: neighborId, depth: depth + 1 });
        }
      }
    }

    return {
      nodes: resultNodes,
      edges: resultEdges
    };
  }

  /**
   * Reconstructs the complete authoritative truth chain from Requirement all the way to Publication/Evidence.
   */
  public getCompleteTruthChain(canonicalId: string, configurationId?: string): CompleteTruthChainLineage {
    const targetNode = this.registry.getNodeByCanonicalId(canonicalId, configurationId);
    if (!targetNode) {
      throw new Error(`TRACEABILITY_ERROR: Node with canonical ID '${canonicalId}' not found.`);
    }

    const connected = this.getConnectedLineage(targetNode.nodeId);
    const allNodes = connected.nodes;

    const findType = (type: ThreadNodeType): DigitalThreadNode | undefined => {
      return allNodes.find(n => n.nodeType === type);
    };

    const requirement = findType('Requirement');
    const systemModel = findType('SystemModel') || findType('SystemNeed');
    const mbseElement = findType('MBSEElement');
    const architectureElement = findType('ArchitectureElement') || findType('Architecture');
    const configuration = findType('Configuration');
    const revision = findType('Revision');
    const execution = findType('Execution');
    const verificationIntent = findType('VerificationIntent');
    const verificationResult = findType('VerificationResult');
    const evidence = findType('Evidence');
    const provenance = findType('Provenance');
    const persistence = findType('PersistenceSnapshot');
    const publication = findType('Publication');

    const missingLinks: string[] = [];
    if (!requirement) missingLinks.push('Requirement');
    if (!architectureElement) missingLinks.push('ArchitectureElement');
    if (!verificationResult && !verificationIntent) missingLinks.push('Verification');
    if (!evidence) missingLinks.push('Evidence');

    const isComplete = missingLinks.length === 0;
    const chainIntegrity = isComplete ? 'COMPLETE' : missingLinks.length <= 2 ? 'PARTIAL' : 'BROKEN';

    const provenanceRoot = createHash('sha256')
      .update(canonicalId + targetNode.revisionHash + connected.edges.map(e => e.provenanceId).join(''))
      .digest('hex');

    return {
      canonicalId,
      requirement,
      systemModel,
      mbseElement,
      architectureElement,
      configuration,
      revision,
      execution,
      verificationIntent,
      verificationResult,
      evidence,
      provenance,
      persistence,
      publication,
      chainIntegrity,
      missingLinks,
      verified: connected.edges.every(e => e.isVerified),
      provenanceRoot
    };
  }
}
