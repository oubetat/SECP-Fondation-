/**
 * SECP — ADSE-P4 Digital Thread Consistency Engine
 * Audits the Digital Truth Thread for deterministic forensic integrity.
 * Detects orphans, broken links, revision/configuration mismatches, missing provenance, and forged authorities.
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { DigitalThreadRevisionEngine } from './DigitalThreadRevisionEngine';
import { DigitalThreadConfigurationEngine } from './DigitalThreadConfigurationEngine';
import { 
  ThreadConsistencyFinding, 
  ThreadIntegrityReport, 
  ThreadFindingCategory, 
  ThreadFindingSeverity,
  DigitalThreadNode,
  DigitalThreadEdge
} from './types';
import { createHash } from 'crypto';

export class DigitalThreadConsistencyEngine {
  private registry: DigitalThreadRegistry;
  private revisionEngine: DigitalThreadRevisionEngine;
  private configEngine: DigitalThreadConfigurationEngine;

  constructor(
    registry: DigitalThreadRegistry,
    revisionEngine: DigitalThreadRevisionEngine,
    configEngine: DigitalThreadConfigurationEngine
  ) {
    this.registry = registry;
    this.revisionEngine = revisionEngine;
    this.configEngine = configEngine;
  }

  public auditThread(configurationId: string = 'CONF-BASE', revisionId?: string): ThreadIntegrityReport {
    const findings: ThreadConsistencyFinding[] = [];
    const nodes = this.registry.getAllNodes().filter(
      n => n.configurationId === configurationId || ['CONF-COMMON', 'CONF-BASE', 'GLOBAL', 'BASE'].includes(n.configurationId)
    );
    const edges = this.registry.getAllEdges().filter(
      e => e.configurationId === configurationId || ['CONF-COMMON', 'CONF-BASE', 'GLOBAL', 'BASE'].includes(e.configurationId)
    );

    const nodeIds = new Set(nodes.map(n => n.nodeId));

    // 1. Orphan Nodes Check
    for (const node of nodes) {
      const { outgoing, incoming } = this.registry.getEdgesForNode(node.nodeId);
      const activeEdges = [...outgoing, ...incoming].filter(e => e.configurationId === configurationId || e.configurationId === node.configurationId);
      
      // Standalone single nodes that are not system roots
      if (activeEdges.length === 0 && node.nodeType !== 'SystemModel' && node.nodeType !== 'PersistenceSnapshot') {
        findings.push({
          findingId: `FIND-ORPHAN-${node.nodeId}`,
          severity: 'WARNING',
          category: 'ORPHAN_NODE',
          nodeId: node.nodeId,
          reason: `Node '${node.displayName}' [${node.nodeType}] has zero incoming or outgoing digital thread edges.`,
          authority: node.authoritySource,
          revisionId: node.revisionId,
          configurationId: node.configurationId,
          provenanceId: node.provenanceId
        });
      }

      // 2. Missing Provenance Check
      if (!node.provenanceId || !node.provenanceId.startsWith('PROV-')) {
        findings.push({
          findingId: `FIND-PROV-MISSING-${node.nodeId}`,
          severity: 'CRITICAL',
          category: 'MISSING_PROVENANCE',
          nodeId: node.nodeId,
          reason: `Node '${node.displayName}' is missing a valid cryptographic provenance ID.`,
          authority: node.authoritySource,
          revisionId: node.revisionId,
          configurationId: node.configurationId,
          provenanceId: 'NONE'
        });
      }

      // 3. Authority Type Alignment Check
      if (node.nodeType === 'Requirement' && !node.authoritySource.includes('P1')) {
        findings.push({
          findingId: `FIND-AUTH-MISMATCH-${node.nodeId}`,
          severity: 'CRITICAL',
          category: 'INVALID_AUTHORITY',
          nodeId: node.nodeId,
          reason: `Requirement node '${node.canonicalId}' claims non-P1 authority '${node.authoritySource}'.`,
          authority: node.authoritySource,
          revisionId: node.revisionId,
          configurationId: node.configurationId,
          provenanceId: node.provenanceId
        });
      }
    }

    // 4. Edge Validation & Dangling References
    for (const edge of edges) {
      if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
        findings.push({
          findingId: `FIND-DANGLING-EDGE-${edge.edgeId}`,
          severity: 'CRITICAL',
          category: 'DANGLING_REFERENCE',
          edgeId: edge.edgeId,
          reason: `Edge '${edge.edgeId}' references node outside current configuration slice.`,
          authority: edge.authoritySource,
          revisionId: edge.revisionId,
          configurationId: edge.configurationId,
          provenanceId: edge.provenanceId
        });
      }

      // 5. Cross-Configuration Coupling Check
      const configCoupling = this.configEngine.validateConfigurationCoupling(edge.sourceNodeId, edge.targetNodeId);
      if (!configCoupling.isValid) {
        findings.push({
          findingId: `FIND-CONFIG-MISMATCH-${edge.edgeId}`,
          severity: 'CRITICAL',
          category: 'CONFIGURATION_MISMATCH',
          edgeId: edge.edgeId,
          reason: configCoupling.reason || 'Cross-configuration contamination detected.',
          authority: edge.authoritySource,
          revisionId: edge.revisionId,
          configurationId: edge.configurationId,
          provenanceId: edge.provenanceId
        });
      }

      // 6. Cross-Revision Coupling Check
      const revCoupling = this.revisionEngine.validateRevisionCoupling(edge.sourceNodeId, edge.targetNodeId);
      if (!revCoupling.isValid) {
        findings.push({
          findingId: `FIND-REV-MISMATCH-${edge.edgeId}`,
          severity: 'CRITICAL',
          category: 'REVISION_MISMATCH',
          edgeId: edge.edgeId,
          reason: revCoupling.reason || 'Cross-revision contamination detected.',
          authority: edge.authoritySource,
          revisionId: edge.revisionId,
          configurationId: edge.configurationId,
          provenanceId: edge.provenanceId
        });
      }
    }

    // 7. Evidence Authority Validation (Evidence node must connect to VerificationResult)
    const evidenceNodes = nodes.filter(n => n.nodeType === 'Evidence');
    for (const ev of evidenceNodes) {
      const { incoming } = this.registry.getEdgesForNode(ev.nodeId);
      const hasVerification = incoming.some(e => e.edgeType === 'SUPPORTED_BY' || e.edgeType === 'VERIFIED_BY');
      if (!hasVerification && incoming.length === 0) {
        findings.push({
          findingId: `FIND-UNSUPPORTED-EVIDENCE-${ev.nodeId}`,
          severity: 'CRITICAL',
          category: 'UNSUPPORTED_EVIDENCE',
          nodeId: ev.nodeId,
          reason: `Evidence node '${ev.displayName}' is not anchored to any authoritative verification result.`,
          authority: ev.authoritySource,
          revisionId: ev.revisionId,
          configurationId: ev.configurationId,
          provenanceId: ev.provenanceId
        });
      }
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const warningCount = findings.filter(f => f.severity === 'WARNING').length;
    const infoCount = findings.filter(f => f.severity === 'INFO').length;
    const isConsistent = criticalCount === 0;

    const merkleRoot = createHash('sha256')
      .update(JSON.stringify({ isConsistent, criticalCount, totalNodes: nodes.length, totalEdges: edges.length }))
      .digest('hex');

    return {
      timestamp: new Date().toISOString(),
      configurationId,
      revisionId: revisionId || 'REV-LATEST',
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalFindings: findings.length,
      criticalCount,
      warningCount,
      infoCount,
      findings,
      isConsistent,
      merkleRoot
    };
  }
}
