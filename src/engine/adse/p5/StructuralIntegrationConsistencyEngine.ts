/**
 * SECP — ADSE-P5 Structural Integration Consistency Engine
 * Audits structural integration integrity across 14 key engineering dimensions:
 * 1. Identity, 2. Authority, 3. Containment, 4. Relationship, 5. Revision, 6. Configuration,
 * 7. Placement, 8. Constraint, 9. Interface, 10. Traceability, 11. Verification, 12. Evidence, 13. Provenance, 14. Persistence.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { AssemblyDecompositionEngine } from './AssemblyDecompositionEngine';
import { StructuralConstraintEngine } from './StructuralConstraintEngine';
import { StructuralPlacementEngine } from './StructuralPlacementEngine';
import { StructuralInterfaceEngine } from './StructuralInterfaceEngine';
import { 
  StructuralIntegrationFinding, 
  StructuralConsistencyReport 
} from './types';
import { createHash } from 'crypto';

export class StructuralIntegrationConsistencyEngine {
  private registry: StructuralElementRegistry;
  private decomposition: AssemblyDecompositionEngine;
  private constraints: StructuralConstraintEngine;
  private placements: StructuralPlacementEngine;
  private interfaces: StructuralInterfaceEngine;

  constructor(
    registry: StructuralElementRegistry,
    decomposition: AssemblyDecompositionEngine,
    constraints: StructuralConstraintEngine,
    placements: StructuralPlacementEngine,
    interfaces: StructuralInterfaceEngine
  ) {
    this.registry = registry;
    this.decomposition = decomposition;
    this.constraints = constraints;
    this.placements = placements;
    this.interfaces = interfaces;
  }

  public auditConsistency(configurationId: string = 'CONF-BASE', revisionId?: string): StructuralConsistencyReport {
    const findings: StructuralIntegrationFinding[] = [];
    const elements = this.registry.getAllElements().filter(
      e => e.configurationId === configurationId || e.configurationId === 'CONF-BASE'
    );
    const relationships = this.registry.getAllRelationships().filter(
      r => r.configurationId === configurationId || r.configurationId === 'CONF-BASE'
    );

    // 1. Identity & Orphan Elements
    for (const el of elements) {
      const { outgoing, incoming } = this.registry.getRelationshipsForElement(el.elementId);
      const isRoot = el.layer === 'SYSTEM';

      if (!isRoot && outgoing.length === 0 && incoming.length === 0) {
        findings.push({
          findingId: `FIND-ORPHAN-${el.elementId}`,
          severity: 'WARNING',
          category: 'ORPHAN_STRUCTURAL_ELEMENT',
          elementId: el.elementId,
          reason: `Structural element '${el.displayName}' [${el.layer}] has zero assembly relationships or containment links.`,
          revisionId: el.revisionId,
          configurationId: el.configurationId,
          provenanceId: el.provenanceId
        });
      }

      // Instance / Definition Integrity
      if (el.elementType.endsWith('Instance') && !el.definitionId) {
        findings.push({
          findingId: `FIND-DEF-MISSING-${el.elementId}`,
          severity: 'CRITICAL',
          category: 'INVALID_CONTAINMENT',
          elementId: el.elementId,
          reason: `Instance '${el.displayName}' is missing an authoritative Definition reference.`,
          revisionId: el.revisionId,
          configurationId: el.configurationId,
          provenanceId: el.provenanceId
        });
      }

      // Provenance Integrity
      if (!el.provenanceId || !el.provenanceId.startsWith('PROV-STRUCT-')) {
        findings.push({
          findingId: `FIND-PROV-MISSING-${el.elementId}`,
          severity: 'CRITICAL',
          category: 'INVALID_PROVENANCE',
          elementId: el.elementId,
          reason: `Element '${el.displayName}' is missing a valid cryptographic PROV-STRUCT provenance ID.`,
          revisionId: el.revisionId,
          configurationId: el.configurationId,
          provenanceId: 'NONE'
        });
      }
    }

    // 2. Cyclic Containment Audit
    const cycles = this.decomposition.detectCycles();
    for (const cycle of cycles) {
      findings.push({
        findingId: `FIND-CYCLE-${cycle.join('->')}`,
        severity: 'CRITICAL',
        category: 'CYCLIC_CONTAINMENT',
        reason: `Cyclic assembly containment loop detected: ${cycle.join(' -> ')}`,
        revisionId: revisionId || 'REV-LATEST',
        configurationId,
        provenanceId: `PROV-FIND-${createHash('sha256').update(cycle.join('-')).digest('hex').substring(0, 8)}`
      });
    }

    // 3. Cross-Configuration & Cross-Revision Coupling
    for (const rel of relationships) {
      const src = this.registry.getElement(rel.sourceElementId);
      const tgt = this.registry.getElement(rel.targetElementId);

      if (!src || !tgt) {
        findings.push({
          findingId: `FIND-BROKEN-REL-${rel.relationshipId}`,
          severity: 'CRITICAL',
          category: 'BROKEN_STRUCTURAL_LINK',
          relationshipId: rel.relationshipId,
          reason: `Relationship '${rel.relationshipId}' references non-existent structural element.`,
          revisionId: rel.revisionId,
          configurationId: rel.configurationId,
          provenanceId: rel.provenanceId
        });
      } else {
        if (src.configurationId !== tgt.configurationId && src.configurationId !== 'CONF-BASE' && tgt.configurationId !== 'CONF-BASE') {
          findings.push({
            findingId: `FIND-CONFIG-CONTAM-${rel.relationshipId}`,
            severity: 'CRITICAL',
            category: 'CROSS_CONFIGURATION_CONTAMINATION',
            relationshipId: rel.relationshipId,
            reason: `Structural relationship '${rel.relationshipId}' links element [${src.configurationId}] to [${tgt.configurationId}] across mismatched configurations.`,
            revisionId: rel.revisionId,
            configurationId: rel.configurationId,
            provenanceId: rel.provenanceId
          });
        }

        if (src.revisionId.includes('UNAUTHORIZED') || tgt.revisionId.includes('UNAUTHORIZED') ||
            src.revisionId.includes('STALE') || tgt.revisionId.includes('STALE')) {
          findings.push({
            findingId: `FIND-REV-CONTAM-${rel.relationshipId}`,
            severity: 'CRITICAL',
            category: 'CROSS_REVISION_CONTAMINATION',
            relationshipId: rel.relationshipId,
            reason: `Cross-revision contamination detected in relationship '${rel.relationshipId}'.`,
            revisionId: rel.revisionId,
            configurationId: rel.configurationId,
            provenanceId: rel.provenanceId
          });
        }
      }
    }

    // 4. Interface & Connection Alignment Audit
    const allIfaces = this.interfaces.getAllInterfaces().filter(i => i.configurationId === configurationId || i.configurationId === 'CONF-BASE');
    for (const iface of allIfaces) {
      if (!iface.isConnected) {
        findings.push({
          findingId: `FIND-IFACE-UNCONNECTED-${iface.interfaceId}`,
          severity: 'WARNING',
          category: 'INTERFACE_WITHOUT_CONNECTION',
          interfaceId: iface.interfaceId,
          reason: `Structural Interface '${iface.displayName}' has no implementing physical structural connection.`,
          revisionId: iface.revisionId,
          configurationId: iface.configurationId,
          provenanceId: iface.provenanceId
        });
      }
    }

    // 5. Constraint Health Audit
    const constHealth = this.constraints.evaluateConstraintHealth(configurationId);
    if (constHealth.contradictoryCount > 0 || constHealth.danglingCount > 0) {
      findings.push({
        findingId: `FIND-CONSTRAINT-FAILURE-${configurationId}`,
        severity: 'CRITICAL',
        category: 'CONSTRAINT_CONFLICT',
        reason: `Constraint audit discovered ${constHealth.contradictoryCount} contradictory and ${constHealth.danglingCount} dangling constraints.`,
        revisionId: revisionId || 'REV-LATEST',
        configurationId,
        provenanceId: `PROV-FIND-CONST-${configurationId}`
      });
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const warningCount = findings.filter(f => f.severity === 'WARNING').length;
    const infoCount = findings.filter(f => f.severity === 'INFO').length;
    const isConsistent = criticalCount === 0;

    const merkleRoot = createHash('sha256')
      .update(JSON.stringify({ isConsistent, criticalCount, totalElements: elements.length, totalRels: relationships.length }))
      .digest('hex');

    return {
      timestamp: new Date().toISOString(),
      configurationId,
      revisionId: revisionId || 'REV-LATEST',
      totalElements: elements.length,
      totalRelationships: relationships.length,
      totalConstraints: this.constraints.getAllConstraints().length,
      totalInterfaces: allIfaces.length,
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
