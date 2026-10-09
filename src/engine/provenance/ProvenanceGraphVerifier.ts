/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Verifier
 */

import {
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceVerificationResult,
  ProvenanceVerificationStatus
} from './ProvenanceGraphTypes';
import { ProvenanceGraph } from './ProvenanceGraph';
import { ProvenanceGraphSerializer } from './ProvenanceGraphSerializer';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { EngineeringEvidence } from '../evidence/EngineeringEvidenceTypes';
import { EvidenceVerificationEngine } from '../evidence/EvidenceVerificationEngine';

export class ProvenanceGraphVerifier {
  public static readonly VERIFIER_VERSION = '1.0.0';

  /**
   * Comprehensive Graph Verification method.
   * Performs node identity checks, edge integrity checks, relation hash checks,
   * evidence reference checks, cycle detection, and complete lineage checks.
   */
  public static verifyGraph(
    graph: ProvenanceGraph,
    evidenceStore?: Map<string, EngineeringEvidence>
  ): ProvenanceVerificationResult {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    const graphHash = graph.getGraphHash();
    const checkedAt = new Date().toISOString();

    const violations: string[] = [];
    const missingEvidence: string[] = [];
    const brokenReferences: string[] = [];
    const cyclesDetected: string[] = [];

    let verifiedNodes = 0;
    let invalidNodes = 0;
    let verifiedEdges = 0;
    let invalidEdges = 0;

    // 1. Node Identity & Canonical Structure Verification
    for (const node of nodes) {
      const isNodeValid = this.verifyNodeIdentity(node, violations);
      if (isNodeValid) {
        verifiedNodes++;
      } else {
        invalidNodes++;
      }

      // Check evidence references on node
      if (node.evidenceRefs && node.evidenceRefs.length > 0) {
        for (const evRef of node.evidenceRefs) {
          if (!evidenceStore) {
            missingEvidence.push(evRef);
          } else {
            const evObj = evidenceStore.get(evRef);
            if (!evObj) {
              missingEvidence.push(evRef);
            } else {
              // Defer to EvidenceVerificationEngine (PATCH-012)
              const evResult = EvidenceVerificationEngine.verifyEvidence(evObj);
              if (!evResult.valid || evResult.verdict === 'FAIL' || evResult.verdict === 'INVALID') {
                violations.push(`Node '${node.id}' evidence '${evRef}' failed verification: ${evResult.verdict}`);
              }
            }
          }
        }
      }
    }

    // 2. Edge Integrity & Relation Hash Verification
    for (const edge of edges) {
      const isEdgeValid = this.verifyEdgeIntegrity(graph, edge, violations);
      if (isEdgeValid) {
        verifiedEdges++;
      } else {
        invalidEdges++;
      }

      // Check edge evidence references
      if (edge.evidenceRefs && edge.evidenceRefs.length > 0) {
        for (const evRef of edge.evidenceRefs) {
          if (!evidenceStore) {
            missingEvidence.push(evRef);
          } else {
            const evObj = evidenceStore.get(evRef);
            if (!evObj) {
              missingEvidence.push(evRef);
            } else {
              const evResult = EvidenceVerificationEngine.verifyEvidence(evObj);
              if (!evResult.valid || evResult.verdict === 'FAIL' || evResult.verdict === 'INVALID') {
                violations.push(`Edge '${edge.id}' evidence '${evRef}' failed verification: ${evResult.verdict}`);
              }
            }
          }
        }
      }
    }

    // 3. Cycle Detection
    const graphCycles = this.detectCycles(graph);
    if (graphCycles.length > 0) {
      cyclesDetected.push(...graphCycles);
      violations.push(`Cycle detected in graph lineage: ${graphCycles.join(' -> ')}`);
    }

    // 4. Lineage Completeness check
    const lineageStatus = this.verifyCompleteLineage(graph, violations);

    // Compute Overall Status
    let structureStatus: 'PASS' | 'FAIL' | 'INVALID' = 'PASS';
    if (invalidNodes > 0 || invalidEdges > 0 || brokenReferences.length > 0) {
      structureStatus = 'FAIL';
    }

    let status: ProvenanceVerificationStatus = 'PASS';

    if (violations.length > 0) {
      status = 'FAIL';
    } else if (missingEvidence.length > 0 || lineageStatus === 'UNPROVEN') {
      status = 'UNPROVEN';
    }

    return {
      status,
      graphHash,
      verifiedNodes,
      invalidNodes,
      verifiedEdges,
      invalidEdges,
      missingEvidence: Array.from(new Set(missingEvidence)).sort(),
      brokenReferences: Array.from(new Set(brokenReferences)).sort(),
      cyclesDetected: Array.from(new Set(cyclesDetected)).sort(),
      violations: Array.from(new Set(violations)).sort(),
      checkedAt,
      structureStatus,
      lineageStatus
    };
  }

  /**
   * Verify deterministic Node ID and property structure
   */
  public static verifyNodeIdentity(node: ProvenanceNode, violations: string[]): boolean {
    let isValid = true;

    if (!node.engineeringIdentityId || node.engineeringIdentityId.trim() === '') {
      violations.push(`Node '${node.id}' missing engineeringIdentityId`);
      isValid = false;
    }

    if (!node.canonicalHash || node.canonicalHash.trim() === '') {
      violations.push(`Node '${node.id}' missing canonicalHash`);
      isValid = false;
    }

    // Verify deterministic Node ID recomputation
    const expectedId = ProvenanceGraphSerializer.computeNodeId(
      node.engineeringIdentityId,
      node.type,
      node.canonicalHash,
      node.version || '1.0.0'
    );

    if (node.id !== expectedId) {
      violations.push(`Node ID mismatch for '${node.id}'. Expected deterministic ID '${expectedId}'`);
      isValid = false;
    }

    return isValid;
  }

  /**
   * Verify Edge endpoints exist, relationHash matches, and Edge ID is valid
   */
  public static verifyEdgeIntegrity(
    graph: ProvenanceGraph,
    edge: ProvenanceEdge,
    violations: string[]
  ): boolean {
    let isValid = true;

    if (!graph.hasNode(edge.fromNodeId)) {
      violations.push(`Edge '${edge.id}' fromNodeId '${edge.fromNodeId}' does not exist in graph`);
      isValid = false;
    }

    if (!graph.hasNode(edge.toNodeId)) {
      violations.push(`Edge '${edge.id}' toNodeId '${edge.toNodeId}' does not exist in graph`);
      isValid = false;
    }

    if (edge.fromNodeId === edge.toNodeId) {
      violations.push(`Edge '${edge.id}' self-loop on node '${edge.fromNodeId}' is forbidden`);
      isValid = false;
    }

    // Verify relationHash
    const expectedRelationHash = ProvenanceGraphSerializer.computeRelationHash(
      edge.fromNodeId,
      edge.type,
      edge.toNodeId,
      edge.metadata as Record<string, unknown>
    );

    if (edge.relationHash !== expectedRelationHash) {
      violations.push(`Edge '${edge.id}' relationHash mismatch. Expected '${expectedRelationHash}', got '${edge.relationHash}'`);
      isValid = false;
    }

    // Verify Edge ID
    const expectedEdgeId = ProvenanceGraphSerializer.computeEdgeId(
      edge.fromNodeId,
      edge.type,
      edge.toNodeId,
      edge.relationHash
    );

    if (edge.id !== expectedEdgeId) {
      violations.push(`Edge ID mismatch for '${edge.id}'. Expected deterministic ID '${expectedEdgeId}'`);
      isValid = false;
    }

    return isValid;
  }

  /**
   * Cycle detection using DFS depth traversal
   */
  public static detectCycles(graph: ProvenanceGraph): string[] {
    const nodes = graph.getNodes();
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycleNodes: string[] = [];

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const children = graph.getDirectChildren(nodeId);
      for (const child of children) {
        if (!visited.has(child.id)) {
          if (dfs(child.id, path)) return true;
        } else if (recStack.has(child.id)) {
          cycleNodes.push(...path, child.id);
          return true;
        }
      }

      recStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycleNodes;
  }

  /**
   * Lineage completeness check
   */
  public static verifyCompleteLineage(
    graph: ProvenanceGraph,
    violations: string[]
  ): 'PASS' | 'FAIL' | 'UNPROVEN' {
    const nodes = graph.getNodes();
    if (nodes.length === 0) return 'PASS';

    let hasUnproven = false;

    for (const node of nodes) {
      if (node.type === 'MANUFACTURING' || node.type === 'RESULT') {
        const ancestors = graph.getAncestors(node.id);
        const hasDesignOrGeom = ancestors.some(
          a => a.type === 'DESIGN' || a.type === 'GEOMETRY'
        );
        if (!hasDesignOrGeom) {
          hasUnproven = true;
          // Incomplete lineage is UNPROVEN, not a hard structural violation
        }
      }
    }

    return hasUnproven ? 'UNPROVEN' : 'PASS';
  }
}
