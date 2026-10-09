/**
 * SECP Engineering Core — Universal Digital Thread Engine (EPC-031)
 *
 * Implements a domain-agnostic, version-controlled, and evidence-backed digital thread.
 * Links Requirements -> CAD -> CAE -> CAM -> BOM -> Simulation -> Evidence
 * for any industrial system (Drone, Robot, Vehicle, Pump, Gearbox, etc.).
 */

export type ThreadNodeType =
  | 'REQUIREMENT'
  | 'DESIGN_FEATURE'
  | 'CAD_REVISION'
  | 'ASSEMBLY'
  | 'BOM'
  | 'CAE_MODEL'
  | 'FEA'
  | 'CFD'
  | 'DYNAMICS'
  | 'SIMULATION'
  | 'MANUFACTURING_DEFINITION'
  | 'CAM'
  | 'TOOLPATH'
  | 'INSPECTION'
  | 'EVIDENCE';

export interface ThreadDependency {
  nodeId: string;
  expectedRevision: string;
}

export interface ThreadNode {
  id: string;
  type: ThreadNodeType;
  name: string;
  revision: string;
  metadata: Record<string, any>;
  upstreamDependencies: ThreadDependency[];
}

export interface UniversalDigitalThread {
  threadId: string;
  domain: string; // e.g. 'DRONE' | 'ROBOT' | 'VEHICLE' | 'PUMP' | 'GEARBOX'
  nodes: Map<string, ThreadNode>;
}

export type ThreadStatus = 'VALID' | 'STALE' | 'BROKEN' | 'INCOMPLETE' | 'UNVERIFIED';

export interface ThreadEvaluationResult {
  overallStatus: ThreadStatus;
  nodeStatuses: Record<string, ThreadStatus>;
  messages: string[];
}

export interface TraceabilityGraph {
  nodes: { id: string; name: string; type: ThreadNodeType; revision: string }[];
  edges: { from: string; to: string; relationship: string }[];
}

export class UniversalDigitalThreadEngine {
  /**
   * Constructs a new Universal Digital Thread
   */
  public static createThread(threadId: string, domain: string, nodes: ThreadNode[]): UniversalDigitalThread {
    const nodesMap = new Map<string, ThreadNode>();
    nodes.forEach(node => nodesMap.set(node.id, node));
    return {
      threadId,
      domain,
      nodes: nodesMap
    };
  }

  /**
   * Computes the derived status of the entire Digital Thread
   */
  public static evaluateThread(thread: UniversalDigitalThread): ThreadEvaluationResult {
    const nodeStatuses: Record<string, ThreadStatus> = {};
    const messages: string[] = [];

    // 1. Check for completeness based on domain requirements
    const mandatoryTypes: ThreadNodeType[] = [
      'REQUIREMENT',
      'CAD_REVISION',
      'CAE_MODEL',
      'CAM',
      'BOM',
      'SIMULATION',
      'EVIDENCE'
    ];

    const presentTypes = new Set<ThreadNodeType>();
    thread.nodes.forEach(node => presentTypes.add(node.type));

    const missingMandatory = mandatoryTypes.filter(type => !presentTypes.has(type));
    const isThreadIncomplete = missingMandatory.length > 0;

    if (isThreadIncomplete) {
      messages.push(`Thread is incomplete. Missing types: ${missingMandatory.join(', ')}`);
    }

    // Initialize all node statuses recursively/iteratively
    const visited = new Set<string>();
    const evaluating = new Set<string>();

    const evaluateNode = (nodeId: string): ThreadStatus => {
      if (visited.has(nodeId)) {
        return nodeStatuses[nodeId];
      }

      if (evaluating.has(nodeId)) {
        // Circular dependency detected, treat as BROKEN
        nodeStatuses[nodeId] = 'BROKEN';
        messages.push(`Circular dependency detected involving node ${nodeId}`);
        return 'BROKEN';
      }

      evaluating.add(nodeId);
      const node = thread.nodes.get(nodeId);

      if (!node) {
        nodeStatuses[nodeId] = 'BROKEN';
        evaluating.delete(nodeId);
        visited.add(nodeId);
        return 'BROKEN';
      }

      let derivedStatus: ThreadStatus = 'VALID';

      // Check all upstream dependencies
      for (const dep of node.upstreamDependencies) {
        const upstreamNode = thread.nodes.get(dep.nodeId);

        if (!upstreamNode) {
          derivedStatus = 'BROKEN';
          messages.push(`Node [${node.name}] has a missing upstream dependency [ID: ${dep.nodeId}]`);
          break;
        }

        const upstreamStatus = evaluateNode(dep.nodeId);

        if (upstreamStatus === 'BROKEN') {
          derivedStatus = 'BROKEN';
          messages.push(`Node [${node.name}] has a broken upstream dependency [${upstreamNode.name}]`);
          break;
        }

        // Check for revision mismatch (STALE)
        if (upstreamNode.revision !== dep.expectedRevision) {
          derivedStatus = 'STALE';
          messages.push(
            `Dependency revision mismatch on [${node.name}] -> Upstream [${upstreamNode.name}] is [${upstreamNode.revision}] but expected [${dep.expectedRevision}]`
          );
        } else if (upstreamStatus === 'STALE') {
          derivedStatus = 'STALE';
          messages.push(`Node [${node.name}] inherits stale state from upstream [${upstreamNode.name}]`);
        }
      }

      // If valid so far, check if evidence is verified
      if (derivedStatus === 'VALID') {
        const hasEvidence = node.metadata?.verifiedEvidenceId || node.type === 'EVIDENCE';
        if (!hasEvidence) {
          derivedStatus = 'UNVERIFIED';
        }
      }

      nodeStatuses[nodeId] = derivedStatus;
      evaluating.delete(nodeId);
      visited.add(nodeId);
      return derivedStatus;
    };

    // Evaluate all nodes
    thread.nodes.forEach((_, nodeId) => {
      evaluateNode(nodeId);
    });

    // Resolve overall status
    let overallStatus: ThreadStatus = 'VALID';

    const statusesList = Object.values(nodeStatuses);
    if (statusesList.includes('BROKEN')) {
      overallStatus = 'BROKEN';
    } else if (statusesList.includes('STALE')) {
      overallStatus = 'STALE';
    } else if (isThreadIncomplete) {
      overallStatus = 'INCOMPLETE';
    } else if (statusesList.includes('UNVERIFIED')) {
      overallStatus = 'UNVERIFIED';
    }

    return {
      overallStatus,
      nodeStatuses,
      messages
    };
  }

  /**
   * Propagates revision changes from upstream nodes downstream.
   * Any downstream node whose expectedRevision for this dependency no longer matches
   * is flagged.
   */
  public static propagateChange(
    thread: UniversalDigitalThread,
    changedNodeId: string,
    newRevision: string
  ): UniversalDigitalThread {
    // Clone nodes map to keep implementation pure
    const clonedNodes = new Map<string, ThreadNode>();
    thread.nodes.forEach((node, id) => {
      clonedNodes.set(id, {
        ...node,
        upstreamDependencies: node.upstreamDependencies.map(dep => ({ ...dep }))
      });
    });

    const targetNode = clonedNodes.get(changedNodeId);
    if (targetNode) {
      targetNode.revision = newRevision;
    }

    return {
      ...thread,
      nodes: clonedNodes
    };
  }

  /**
   * Generates a structural traceability graph of relationships
   */
  public static generateTraceabilityGraph(thread: UniversalDigitalThread): TraceabilityGraph {
    const graphNodes: { id: string; name: string; type: ThreadNodeType; revision: string }[] = [];
    const edges: { from: string; to: string; relationship: string }[] = [];

    thread.nodes.forEach(node => {
      graphNodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        revision: node.revision
      });

      node.upstreamDependencies.forEach(dep => {
        edges.push({
          from: dep.nodeId,
          to: node.id,
          relationship: `expected_revision:${dep.expectedRevision}`
        });
      });
    });

    return {
      nodes: graphNodes,
      edges
    };
  }
}
