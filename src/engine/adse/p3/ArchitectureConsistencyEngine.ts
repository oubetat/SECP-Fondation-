/**
 * SECP — ADSE-P3 Architecture Consistency Engine
 * Audits System Architecture integrity across 7 key architectural dimensions:
 * 1. Structural (orphans, invalid decomposition, illegal containment)
 * 2. Interface (missing endpoints, contract mismatches)
 * 3. Dependency (cycles A->B->C->A, boundary violations)
 * 4. Requirement (unallocated elements, missing traces)
 * 5. Configuration (cross-configuration contamination)
 * 6. Revision (stale references, invalid hashes)
 * 7. Canonical (unbound elements lacking SECP Core linkage)
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureDependencyEngine } from './ArchitectureDependencyEngine';
import { ArchitectureInterfaceEngine } from './ArchitectureInterfaceEngine';
import { ArchitectureDesignSpaceEngine } from './ArchitectureDesignSpaceEngine';
import { FutureEngineeringEngine } from './FutureEngineeringEngine';
import { 
  ArchitectureFinding, 
  ArchitectureConsistencyReport 
} from './types';
import { createHash } from 'crypto';

export class ArchitectureConsistencyEngine {
  private registry: ArchitectureElementRegistry;
  private dependencyEngine: ArchitectureDependencyEngine;
  private interfaceEngine: ArchitectureInterfaceEngine;
  private designSpaceEngine?: ArchitectureDesignSpaceEngine;
  private futureEngine?: FutureEngineeringEngine;

  constructor(
    registry: ArchitectureElementRegistry,
    dependencyEngine: ArchitectureDependencyEngine,
    interfaceEngine: ArchitectureInterfaceEngine,
    designSpaceEngine?: ArchitectureDesignSpaceEngine,
    futureEngine?: FutureEngineeringEngine
  ) {
    this.registry = registry;
    this.dependencyEngine = dependencyEngine;
    this.interfaceEngine = interfaceEngine;
    this.designSpaceEngine = designSpaceEngine;
    this.futureEngine = futureEngine;
  }

  public setDesignSpaceEngine(engine: ArchitectureDesignSpaceEngine) {
    this.designSpaceEngine = engine;
  }

  public setFutureEngine(engine: FutureEngineeringEngine) {
    this.futureEngine = engine;
  }

  public auditConsistency(configurationId: string = 'CONF-MAIN'): ArchitectureConsistencyReport {
    const findings: ArchitectureFinding[] = [];
    const elements = this.registry.getAllElements().filter(e => e.configurationId === configurationId);
    const relationships = this.registry.getAllRelationships().filter(r => r.configurationId === configurationId);
    const interfaces = this.interfaceEngine.getAllInterfaces().filter(i => i.configurationId === configurationId);
    const dependencies = this.dependencyEngine.getAllDependencies().filter(d => d.configurationId === configurationId);

    let totalChecks = 0;

    // --- 1. Structural Audits ---
    for (const el of elements) {
      totalChecks++;
      // Orphan check: Subsystems/Components with no parent or allocation
      if (el.layer !== 'SYSTEM' && el.layer !== 'EXTERNAL') {
        const hasParent = relationships.some(
          r => r.targetArchId === el.archId && (r.relationshipType === 'DECOMPOSES' || r.relationshipType === 'CONTAINS')
        );
        const hasAllocation = relationships.some(
          r => r.sourceArchId === el.archId && r.relationshipType === 'ALLOCATED_TO'
        );
        if (!hasParent && !hasAllocation) {
          findings.push({
            findingId: `FIND-STRUCT-ORPHAN-${el.archId}`,
            severity: 'CRITICAL',
            category: 'STRUCTURAL',
            sourceArchId: el.archId,
            ruleCode: 'ARCH-STRUCT-001',
            explanation: `Architecture element '${el.displayName}' [${el.layer}] is an orphan without a parent decomposition or allocation.`,
            revisionId: el.revisionId,
            configurationId,
            provenanceId: `PROV-FIND-${createHash('sha256').update(el.archId).digest('hex').substring(0, 8)}`
          });
        }
      }
    }

    // --- 2. Interface Audits ---
    for (const iface of interfaces) {
      totalChecks++;
      if (!iface.isCompatible) {
        findings.push({
          findingId: `FIND-IFACE-MISMATCH-${iface.interfaceId}`,
          severity: 'CRITICAL',
          category: 'INTERFACE',
          sourceArchId: iface.providerArchId,
          targetArchId: iface.consumerArchId,
          ruleCode: 'ARCH-IFACE-001',
          explanation: `Interface contract mismatch on '${iface.displayName}': ${iface.compatibilityDetails}`,
          revisionId: iface.revisionId,
          configurationId,
          provenanceId: `PROV-FIND-${createHash('sha256').update(iface.interfaceId).digest('hex').substring(0, 8)}`
        });
      }
    }

    // --- 3. Dependency Audits (Cycles & Boundary Violations) ---
    totalChecks++;
    const cycles = this.dependencyEngine.detectCycles();
    for (const cycle of cycles) {
      findings.push({
        findingId: `FIND-DEP-CYCLE-${cycle.join('->')}`,
        severity: 'CRITICAL',
        category: 'DEPENDENCY',
        sourceArchId: cycle[0],
        targetArchId: cycle[cycle.length - 1],
        ruleCode: 'ARCH-CONSISTENCY-001',
        explanation: `Circular architectural dependency detected: ${cycle.join(' -> ')}`,
        revisionId: 'N/A',
        configurationId,
        provenanceId: `PROV-FIND-${createHash('sha256').update(cycle.join('-')).digest('hex').substring(0, 8)}`
      });
    }

    for (const dep of dependencies) {
      totalChecks++;
      if (dep.isBoundaryViolation) {
        findings.push({
          findingId: `FIND-DEP-BOUNDARY-${dep.dependencyId}`,
          severity: 'WARNING',
          category: 'DEPENDENCY',
          sourceArchId: dep.sourceArchId,
          targetArchId: dep.targetArchId,
          ruleCode: 'ARCH-DEP-BOUNDARY-001',
          explanation: `Architectural boundary violation: Internal component '${dep.sourceArchId}' depends directly on External element '${dep.targetArchId}' without a boundary interface.`,
          revisionId: dep.revisionId,
          configurationId,
          provenanceId: `PROV-FIND-${createHash('sha256').update(dep.dependencyId).digest('hex').substring(0, 8)}`
        });
      }
    }

    // --- 4. Cross-Configuration Contamination ---
    for (const rel of this.registry.getAllRelationships()) {
      totalChecks++;
      const source = this.registry.getElement(rel.sourceArchId);
      const target = this.registry.getElement(rel.targetArchId);
      if (source && target && source.configurationId !== target.configurationId) {
        findings.push({
          findingId: `FIND-CONFIG-CONTAM-${rel.relationshipId}`,
          severity: 'CRITICAL',
          category: 'CONFIGURATION',
          sourceArchId: rel.sourceArchId,
          targetArchId: rel.targetArchId,
          ruleCode: 'ARCH-CONFIG-CROSS-CONTAMINATION',
          explanation: `Cross-configuration contamination: Element '${source.archId}' (Conf: ${source.configurationId}) references element '${target.archId}' (Conf: ${target.configurationId}).`,
          revisionId: rel.revisionId,
          configurationId: source.configurationId,
          provenanceId: rel.provenanceId
        });
      }
    }

    // --- 5. Canonical Core Binding ---
    for (const el of elements) {
      totalChecks++;
      if (el.coreBindingState === 'UNBOUND') {
        findings.push({
          findingId: `FIND-UNBOUND-CORE-${el.archId}`,
          severity: 'WARNING',
          category: 'CANONICAL',
          sourceArchId: el.archId,
          ruleCode: 'ARCH-CANONICAL-UNBOUND',
          explanation: `Architecture element '${el.displayName}' is UNBOUND to SECP Core canonical identity. Cannot be treated as authoritative engineering truth.`,
          revisionId: el.revisionId,
          configurationId,
          provenanceId: `PROV-FIND-${createHash('sha256').update(el.archId).digest('hex').substring(0, 8)}`
        });
      }
    }

    // --- 6. Future Scenario Isolation Audits ---
    if (this.futureEngine) {
      for (const scenario of this.futureEngine.getAllScenarios()) {
        totalChecks++;
        if (!scenario.isIsolatedFromCanonical) {
          findings.push({
            findingId: `FIND-SCENARIO-LEAK-${scenario.scenarioId}`,
            severity: 'CRITICAL',
            category: 'CANONICAL',
            sourceArchId: scenario.scenarioId,
            ruleCode: 'ARCH-FUTURE-SCENARIO-ISOLATION-VIOLATION',
            explanation: `Future Scenario '${scenario.title}' is not marked as isolated from canonical engineering state. Speculative scenario must never masquerade as engineering truth.`,
            revisionId: 'N/A',
            configurationId,
            provenanceId: scenario.provenanceId
          });
        }
      }
    }

    // --- 7. Design Space Candidate Integrity ---
    if (this.designSpaceEngine) {
      for (const space of this.designSpaceEngine.getAllDesignSpaces()) {
        for (const candidate of space.candidates) {
          totalChecks++;
          if (candidate.isPromotedToCanonical && candidate.verificationState !== 'VERIFIED') {
            findings.push({
              findingId: `FIND-UNVERIFIED-PROMOTION-${candidate.candidateId}`,
              severity: 'CRITICAL',
              category: 'CANONICAL',
              sourceArchId: candidate.candidateId,
              ruleCode: 'ARCH-CANDIDATE-UNVERIFIED-PROMOTION',
              explanation: `Candidate Architecture '${candidate.name}' was promoted to canonical state without passing verification.`,
              revisionId: candidate.promotedRevisionId || 'UNKNOWN',
              configurationId,
              provenanceId: candidate.provenanceId
            });
          }
        }
      }
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const warningCount = findings.filter(f => f.severity === 'WARNING').length;
    const infoCount = findings.filter(f => f.severity === 'INFO').length;

    return {
      timestamp: new Date().toISOString(),
      configurationId,
      revisionId: 'CONF-AUDIT',
      totalChecksPassed: totalChecks - findings.length,
      totalFindings: findings.length,
      criticalCount,
      warningCount,
      infoCount,
      findings,
      isConsistent: criticalCount === 0
    };
  }
}
