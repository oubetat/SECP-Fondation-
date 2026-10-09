/**
 * SECP Industrial OS - Digital Thread Consistency Checker (PATCH-295)
 * Analyzes graph topology, orphan nodes, broken pointers, invalid revision cross-links,
 * circular dependency loops, and evaluates overall Digital Thread Integrity Score.
 */

import {
  DigitalThreadNode,
  DigitalThreadEdge,
  ThreadConsistencyReport,
  DigitalThreadNodeType,
  DigitalThreadRelationshipType
} from './DigitalThreadTypes';

// Valid typed matrix for source -> relationship -> target
export const VALID_RELATIONSHIP_RULES: Array<{
  sourceType: DigitalThreadNodeType | '*';
  relationship: DigitalThreadRelationshipType;
  targetType: DigitalThreadNodeType | '*';
}> = [
  // Requirement lineage
  { sourceType: 'FEATURE', relationship: 'DERIVED_FROM', targetType: 'REQUIREMENT' },
  { sourceType: 'PART', relationship: 'DERIVED_FROM', targetType: 'REQUIREMENT' },
  { sourceType: 'ASSEMBLY', relationship: 'DERIVED_FROM', targetType: 'REQUIREMENT' },
  { sourceType: 'SIMULATION_RESULT', relationship: 'VERIFIES', targetType: 'REQUIREMENT' },
  { sourceType: 'VALIDATION_RECORD', relationship: 'VALIDATES', targetType: 'REQUIREMENT' },
  { sourceType: 'QUALITY_RECORD', relationship: 'VERIFIES', targetType: 'REQUIREMENT' },

  // CAD / B-Rep design lineage
  { sourceType: 'SKETCH', relationship: 'CONTAINS', targetType: 'FEATURE' },
  { sourceType: 'FEATURE', relationship: 'DERIVED_FROM', targetType: 'SKETCH' },
  { sourceType: 'BODY', relationship: 'GENERATED_FROM', targetType: 'FEATURE' },
  { sourceType: 'PART', relationship: 'CONTAINS', targetType: 'BODY' },
  { sourceType: 'PART', relationship: 'CONTAINS', targetType: 'FEATURE' },
  { sourceType: 'ASSEMBLY', relationship: 'CONTAINS', targetType: 'PART' },
  { sourceType: 'PART', relationship: 'INSTANCE_OF', targetType: 'ASSEMBLY' },
  { sourceType: 'DRAWING', relationship: 'BASED_ON', targetType: 'PART' },
  { sourceType: 'DRAWING', relationship: 'BASED_ON', targetType: 'ASSEMBLY' },
  { sourceType: 'DRAWING', relationship: 'BASED_ON', targetType: 'REVISION' },

  // Revision & Lifecycle
  { sourceType: 'PART', relationship: 'CONTAINS', targetType: 'REVISION' },
  { sourceType: 'REVISION', relationship: 'SUPERSEDES', targetType: 'REVISION' },
  { sourceType: 'PART', relationship: 'SUPERSEDES', targetType: 'PART' },

  // Simulation lineage (FEM / CFD / Thermal)
  { sourceType: 'MESH', relationship: 'GENERATED_FROM', targetType: 'PART' },
  { sourceType: 'MESH', relationship: 'GENERATED_FROM', targetType: 'REVISION' },
  { sourceType: 'BOUNDARY_CONDITION', relationship: 'DEPENDS_ON', targetType: 'PART' },
  { sourceType: 'BOUNDARY_CONDITION', relationship: 'DEPENDS_ON', targetType: 'REVISION' },
  { sourceType: 'SIMULATION_CONFIG', relationship: 'BASED_ON', targetType: 'PART' },
  { sourceType: 'SIMULATION_RUN', relationship: 'ANALYZES', targetType: 'PART' },
  { sourceType: 'SIMULATION_RUN', relationship: 'ANALYZES', targetType: 'REVISION' },
  { sourceType: 'SIMULATION_RUN', relationship: 'DEPENDS_ON', targetType: 'MESH' },
  { sourceType: 'SIMULATION_RUN', relationship: 'DEPENDS_ON', targetType: 'MATERIAL' },
  { sourceType: 'SIMULATION_RUN', relationship: 'DEPENDS_ON', targetType: 'BOUNDARY_CONDITION' },
  { sourceType: 'SIMULATION_RUN', relationship: 'DEPENDS_ON', targetType: 'SIMULATION_CONFIG' },
  { sourceType: 'SIMULATION_RESULT', relationship: 'GENERATED_FROM', targetType: 'SIMULATION_RUN' },
  { sourceType: 'SAFETY_FACTOR', relationship: 'DERIVED_FROM', targetType: 'SIMULATION_RESULT' },
  { sourceType: 'VALIDATION_RECORD', relationship: 'VALIDATES', targetType: 'SIMULATION_RESULT' },
  { sourceType: 'VALIDATION_RECORD', relationship: 'VALIDATES', targetType: 'REVISION' },
  { sourceType: 'VERIFICATION_RECORD', relationship: 'VERIFIES', targetType: 'SIMULATION_RUN' },
  { sourceType: 'VERIFICATION_RECORD', relationship: 'VERIFIES', targetType: 'REVISION' },

  // CAM & Manufacturing
  { sourceType: 'CAM_FEATURE', relationship: 'DERIVED_FROM', targetType: 'PART' },
  { sourceType: 'CAM_FEATURE', relationship: 'DERIVED_FROM', targetType: 'REVISION' },
  { sourceType: 'CAM_OPERATION', relationship: 'BASED_ON', targetType: 'CAM_FEATURE' },
  { sourceType: 'CAM_OPERATION', relationship: 'DEPENDS_ON', targetType: 'MATERIAL' },
  { sourceType: 'TOOLPATH', relationship: 'GENERATED_FROM', targetType: 'CAM_OPERATION' },
  { sourceType: 'GCODE', relationship: 'GENERATED_FROM', targetType: 'TOOLPATH' },
  { sourceType: 'GCODE', relationship: 'DEPENDS_ON', targetType: 'POST_PROCESSOR' },
  { sourceType: 'GCODE', relationship: 'DEPENDS_ON', targetType: 'MACHINE' },
  { sourceType: 'PRODUCTION_RUN', relationship: 'MANUFACTURES', targetType: 'PART' },
  { sourceType: 'PRODUCTION_RUN', relationship: 'MANUFACTURES', targetType: 'REVISION' },
  { sourceType: 'PRODUCTION_RUN', relationship: 'DEPENDS_ON', targetType: 'GCODE' },
  { sourceType: 'PRODUCTION_RUN', relationship: 'DEPENDS_ON', targetType: 'MACHINE' },

  // Supplier & Collaboration
  { sourceType: 'SUPPLIER_PACKAGE', relationship: 'DERIVED_FROM', targetType: 'PART' },
  { sourceType: 'SUPPLIER_PACKAGE', relationship: 'DERIVED_FROM', targetType: 'REVISION' },
  { sourceType: 'SUPPLIER_PACKAGE', relationship: 'CONTAINS', targetType: 'DRAWING' },
  { sourceType: 'SUPPLIER_PACKAGE', relationship: 'SUPPLIED_BY', targetType: 'SUPPLIER_PACKAGE' },
  { sourceType: 'SUPPLIER_QUOTE', relationship: 'BASED_ON', targetType: 'SUPPLIER_PACKAGE' },
  { sourceType: 'SUPPLIER_DFM', relationship: 'AFFECTS', targetType: 'PART' },
  { sourceType: 'SUPPLIER_DFM', relationship: 'AFFECTS', targetType: 'REVISION' },
  { sourceType: 'SUPPLIER_CHANGE_REQUEST', relationship: 'TRIGGERS', targetType: 'ECO' },
  { sourceType: 'SUPPLIER_CHANGE_REQUEST', relationship: 'AFFECTS', targetType: 'PART' },

  // Change Management & ECO & Approvals
  { sourceType: 'ECO', relationship: 'MODIFIES', targetType: 'PART' },
  { sourceType: 'ECO', relationship: 'MODIFIES', targetType: 'REVISION' },
  { sourceType: 'ECO', relationship: 'MODIFIES', targetType: 'ASSEMBLY' },
  { sourceType: 'APPROVAL', relationship: 'APPROVED_BY', targetType: 'ECO' },
  { sourceType: 'APPROVAL', relationship: 'APPROVED_BY', targetType: 'REVISION' },
  { sourceType: 'APPROVAL', relationship: 'APPROVED_BY', targetType: 'SUPPLIER_PACKAGE' },

  // Quality & Evidence & Twin
  { sourceType: 'QUALITY_RECORD', relationship: 'VALIDATES', targetType: 'PRODUCTION_RUN' },
  { sourceType: 'QUALITY_RECORD', relationship: 'VALIDATES', targetType: 'PART' },
  { sourceType: 'QUALITY_RECORD', relationship: 'VALIDATES', targetType: 'REVISION' },
  { sourceType: 'EVIDENCE', relationship: 'EVIDENCED_BY', targetType: '*' },
  { sourceType: '*', relationship: 'EVIDENCED_BY', targetType: 'EVIDENCE' },
  { sourceType: 'GATE_RESULT', relationship: 'VALIDATES', targetType: '*' },
  { sourceType: 'DIGITAL_TWIN', relationship: 'BASED_ON', targetType: 'PART' },
  { sourceType: 'DIGITAL_TWIN', relationship: 'BASED_ON', targetType: 'REVISION' },
  { sourceType: 'DIGITAL_TWIN', relationship: 'DEPENDS_ON', targetType: 'PRODUCTION_RUN' }
];

export class DigitalThreadConsistencyChecker {
  /**
   * Validate typed relationship compatibility
   */
  public static isValidRelationship(
    sourceType: DigitalThreadNodeType,
    relationship: DigitalThreadRelationshipType,
    targetType: DigitalThreadNodeType
  ): boolean {
    return VALID_RELATIONSHIP_RULES.some(rule => {
      const matchSource = rule.sourceType === '*' || rule.sourceType === sourceType;
      const matchRel = rule.relationship === relationship;
      const matchTarget = rule.targetType === '*' || rule.targetType === targetType;
      return matchSource && matchRel && matchTarget;
    });
  }

  /**
   * Comprehensive graph consistency evaluation
   */
  public static evaluateConsistency(
    nodes: Map<string, DigitalThreadNode>,
    edges: Map<string, DigitalThreadEdge>
  ): ThreadConsistencyReport {
    const brokenEdges: Array<{ edgeId: string; missingNodeId: string; isSource: boolean }> = [];
    const orphanResults: string[] = [];
    const orphanEvidence: string[] = [];
    const invalidRevisionLinks: Array<{ edgeId: string; reason: string }> = [];
    const unverifiedReleases: string[] = [];

    // 1. Check broken edges
    edges.forEach(edge => {
      const sourceExists = nodes.has(edge.sourceNodeId);
      const targetExists = nodes.has(edge.targetNodeId);

      if (!sourceExists) {
        brokenEdges.push({ edgeId: edge.id, missingNodeId: edge.sourceNodeId, isSource: true });
      }
      if (!targetExists) {
        brokenEdges.push({ edgeId: edge.id, missingNodeId: edge.targetNodeId, isSource: false });
      }

      if (sourceExists && targetExists) {
        const sNode = nodes.get(edge.sourceNodeId)!;
        const tNode = nodes.get(edge.targetNodeId)!;

        // Check typed compatibility
        if (!this.isValidRelationship(sNode.type, edge.relationshipType, tNode.type)) {
          invalidRevisionLinks.push({
            edgeId: edge.id,
            reason: `Invalid relationship: ${sNode.type} cannot connect to ${tNode.type} via ${edge.relationshipType}`
          });
        }

        // Check project & tenant cross-boundary sanity
        if (sNode.tenantId !== tNode.tenantId) {
          invalidRevisionLinks.push({
            edgeId: edge.id,
            reason: `Tenant isolation violation: Edge crosses tenant ${sNode.tenantId} to ${tNode.tenantId}`
          });
        }
      }
    });

    // 2. Identify orphaned results or evidence
    const incomingEdgeTargetMap = new Map<string, DigitalThreadEdge[]>();
    const outgoingEdgeSourceMap = new Map<string, DigitalThreadEdge[]>();

    edges.forEach(edge => {
      if (!incomingEdgeTargetMap.has(edge.targetNodeId)) {
        incomingEdgeTargetMap.set(edge.targetNodeId, []);
      }
      incomingEdgeTargetMap.get(edge.targetNodeId)!.push(edge);

      if (!outgoingEdgeSourceMap.has(edge.sourceNodeId)) {
        outgoingEdgeSourceMap.set(edge.sourceNodeId, []);
      }
      outgoingEdgeSourceMap.get(edge.sourceNodeId)!.push(edge);
    });

    nodes.forEach(node => {
      // Simulation Results must be generated from a Simulation Run and have upstream geometry
      if (node.type === 'SIMULATION_RESULT') {
        const incoming = incomingEdgeTargetMap.get(node.id) || [];
        const hasSourceRun = incoming.some(e => {
          const src = nodes.get(e.sourceNodeId);
          return src && src.type === 'SIMULATION_RUN';
        }) || outgoingEdgeSourceMap.get(node.id)?.some(e => {
          const tgt = nodes.get(e.targetNodeId);
          return tgt && tgt.type === 'SIMULATION_RUN' && e.relationshipType === 'GENERATED_FROM';
        });

        if (!hasSourceRun) {
          orphanResults.push(node.id);
        }
      }

      // Evidence must be attached to an engineering artifact or result
      if (node.type === 'EVIDENCE') {
        const incoming = incomingEdgeTargetMap.get(node.id) || [];
        const outgoing = outgoingEdgeSourceMap.get(node.id) || [];
        if (incoming.length === 0 && outgoing.length === 0) {
          orphanEvidence.push(node.id);
        }
      }

      // Released items must have validation / approval records
      if (node.status === 'RELEASED' && (node.type === 'PART' || node.type === 'REVISION')) {
        const hasApprovalOrValidation = (incomingEdgeTargetMap.get(node.id) || []).some(e => {
          const src = nodes.get(e.sourceNodeId);
          return src && (src.type === 'APPROVAL' || src.type === 'VALIDATION_RECORD' || src.type === 'GATE_RESULT');
        });
        if (!hasApprovalOrValidation) {
          unverifiedReleases.push(node.id);
        }
      }
    });

    // 3. Cycle Detection (Tarjan's algorithm / DFS for DAG cycles on non-bidirectional dependencies)
    const cycles = this.findCycles(nodes, edges);

    // Compute overall integrity score
    let score = 100;
    score -= brokenEdges.length * 20;
    score -= orphanResults.length * 10;
    score -= orphanEvidence.length * 5;
    score -= invalidRevisionLinks.length * 15;
    score -= cycles.length * 25;
    score = Math.max(0, Math.min(100, score));

    return {
      valid: brokenEdges.length === 0 && invalidRevisionLinks.length === 0 && cycles.length === 0 && score >= 80,
      integrityScore: score,
      brokenEdges,
      orphanResults,
      orphanEvidence,
      circularDependencies: cycles,
      invalidRevisionLinks,
      unverifiedReleases,
      evaluatedNodesCount: nodes.size,
      evaluatedEdgesCount: edges.size,
      timestamp: Date.now()
    };
  }

  /**
   * Cycle Detection algorithm on directed edges (excluding SUPERSEDES which is a forward-only temporal chain)
   */
  private static findCycles(
    nodes: Map<string, DigitalThreadNode>,
    edges: Map<string, DigitalThreadEdge>
  ): string[][] {
    const adj = new Map<string, string[]>();
    nodes.forEach((_, id) => adj.set(id, []));

    edges.forEach(edge => {
      // Don't count non-directed relations or harmless annotations
      if (edge.relationshipType !== 'EVIDENCED_BY') {
        adj.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      }
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];
    const path: string[] = [];

    const dfs = (curr: string) => {
      visited.add(curr);
      recStack.add(curr);
      path.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const nxt of neighbors) {
        if (!visited.has(nxt)) {
          dfs(nxt);
        } else if (recStack.has(nxt)) {
          // Cycle found
          const cycleStartIdx = path.indexOf(nxt);
          if (cycleStartIdx >= 0) {
            cycles.push([...path.slice(cycleStartIdx), nxt]);
          }
        }
      }

      recStack.delete(curr);
      path.pop();
    };

    nodes.forEach((_, id) => {
      if (!visited.has(id)) {
        dfs(id);
      }
    });

    return cycles;
  }
}
