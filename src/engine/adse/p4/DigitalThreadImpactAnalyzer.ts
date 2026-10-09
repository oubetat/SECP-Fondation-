/**
 * SECP — ADSE-P4 Digital Thread Impact Analyzer
 * Propagates changes across the digital thread to discover affected artifacts across all engineering stages.
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { DigitalThreadTraceabilityEngine } from './DigitalThreadTraceabilityEngine';
import { ImpactPath, DigitalThreadNode, DigitalThreadEdge } from './types';

export class DigitalThreadImpactAnalyzer {
  private registry: DigitalThreadRegistry;
  private traceability: DigitalThreadTraceabilityEngine;

  constructor(registry: DigitalThreadRegistry, traceability: DigitalThreadTraceabilityEngine) {
    this.registry = registry;
    this.traceability = traceability;
  }

  /**
   * Analyzes the full blast radius of modifying a node in the digital thread.
   */
  public analyzeImpact(changedNodeId: string): ImpactPath {
    const rootNode = this.registry.getNode(changedNodeId);
    if (!rootNode) {
      throw new Error(`IMPACT_ANALYSIS_ERROR: Node '${changedNodeId}' not found in thread registry.`);
    }

    // Traverses downstream through all edges
    const fwd = this.traceability.forwardTrace(changedNodeId);
    const affectedNodes = fwd.nodes.filter(n => n.nodeId !== changedNodeId);
    const affectedEdges = fwd.edges;

    const affectedRequirements: string[] = [];
    const affectedArchitecture: string[] = [];
    const affectedExecutions: string[] = [];
    const affectedVerifications: string[] = [];
    const affectedEvidences: string[] = [];
    const affectedPublications: string[] = [];

    for (const node of affectedNodes) {
      switch (node.nodeType) {
        case 'Requirement':
          affectedRequirements.push(node.canonicalId);
          break;
        case 'Architecture':
        case 'ArchitectureElement':
        case 'Interface':
        case 'Dependency':
        case 'Allocation':
        case 'Constraint':
          affectedArchitecture.push(node.canonicalId);
          break;
        case 'Execution':
          affectedExecutions.push(node.canonicalId);
          break;
        case 'VerificationIntent':
        case 'VerificationResult':
          affectedVerifications.push(node.canonicalId);
          break;
        case 'Evidence':
          affectedEvidences.push(node.canonicalId);
          break;
        case 'Publication':
          affectedPublications.push(node.canonicalId);
          break;
      }
    }

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (affectedEvidences.length > 0 || affectedPublications.length > 0) {
      severity = 'CRITICAL';
    } else if (affectedVerifications.length > 0 || affectedExecutions.length > 0) {
      severity = 'HIGH';
    } else if (affectedArchitecture.length > 0) {
      severity = 'MEDIUM';
    }

    return {
      changedNodeId,
      affectedNodes,
      affectedEdges,
      affectedRequirements,
      affectedArchitecture,
      affectedExecutions,
      affectedVerifications,
      affectedEvidences,
      affectedPublications,
      severity
    };
  }
}
