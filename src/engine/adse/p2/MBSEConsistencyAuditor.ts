/**
 * SECP — ADSE-P2 MBSE Consistency Auditor
 * Performs multi-dimensional, automated rule audits across structural, requirement, behavioral, parametric, and flow models.
 */

import { MBSEElementRegistry } from './MBSEElementRegistry';
import { MBSEBehavioralEngine } from './MBSEBehavioralEngine';
import { MBSEParametricEngine } from './MBSEParametricEngine';
import { MBSEFlowEngine } from './MBSEFlowEngine';
import { 
  MBSEFinding, 
  MBSEConsistencyReport, 
  MBSEFindingSeverity 
} from './types';
import { createHash } from 'crypto';

export class MBSEConsistencyAuditor {
  private registry: MBSEElementRegistry;
  private behavioral: MBSEBehavioralEngine;
  private parametric: MBSEParametricEngine;
  private flow: MBSEFlowEngine;

  constructor(
    registry: MBSEElementRegistry,
    behavioral: MBSEBehavioralEngine,
    parametric: MBSEParametricEngine,
    flow: MBSEFlowEngine
  ) {
    this.registry = registry;
    this.behavioral = behavioral;
    this.parametric = parametric;
    this.flow = flow;
  }

  /**
   * Performs an authoritative multi-dimensional consistency audit on the current MBSE model.
   */
  public auditSystemConsistency(configurationId: string, revisionId: string): MBSEConsistencyReport {
    const findings: MBSEFinding[] = [];
    let checksCount = 0;

    // 1. Structural Audit: Check for Unallocated Functions
    const functions = this.registry.getElementsByType('Function');
    for (const fn of functions) {
      checksCount++;
      const rels = this.registry.getRelationshipsForSource(fn.mbseId);
      const isAllocated = rels.some(r => r.relationshipType === 'ALLOCATES' || r.relationshipType === 'PERFORMS');
      
      if (!isAllocated) {
        findings.push(this.createFinding({
          severity: 'WARNING',
          category: 'STRUCTURAL',
          sourceMbseId: fn.mbseId,
          ruleCode: 'UNALLOCATED_FUNCTION',
          explanation: `Function '${fn.displayName}' is not allocated or performed by any Subsystem or Component.`,
          configurationId,
          revisionId
        }));
      }
    }

    // 2. Flow Audit: Unconnected Flow Ports & Direction Mismatches
    const flowPorts = this.flow.getAllFlowPorts();
    for (const port of flowPorts) {
      checksCount++;
      const sourceRels = this.registry.getRelationshipsForSource(port.mbseId)
        .filter(r => r.relationshipType === 'CONNECTS' || r.relationshipType === 'FLOWS_TO');
      const targetRels = this.registry.getRelationshipsForTarget(port.mbseId)
        .filter(r => r.relationshipType === 'CONNECTS' || r.relationshipType === 'FLOWS_TO');
      const isConnected = sourceRels.length > 0 || targetRels.length > 0;

      if (!isConnected) {
        findings.push(this.createFinding({
          severity: 'WARNING',
          category: 'FLOW',
          sourceMbseId: port.mbseId,
          ruleCode: 'UNCONNECTED_FLOW_PORT',
          explanation: `FlowPort '${port.name}' on element '${port.ownerMbseId}' has no active connectors or item flows.`,
          configurationId,
          revisionId
        }));
      }
    }

    // 3. Parametric Audit: Check for Unbound Constraint Parameters
    const constraintBlocks = this.registry.getElementsByType('ConstraintBlock');
    for (const cb of constraintBlocks) {
      checksCount++;
      const block = this.parametric.getConstraintBlock(cb.mbseId);
      if (block) {
        for (const param of block.parameters) {
          if (!param.valuePropertyMbseId) {
            findings.push(this.createFinding({
              severity: 'CRITICAL',
              category: 'PARAMETRIC',
              sourceMbseId: cb.mbseId,
              ruleCode: 'UNBOUND_CONSTRAINT_PARAMETER',
              explanation: `ConstraintBlock '${cb.displayName}' parameter '${param.name}' is not bound to any ValueProperty.`,
              configurationId,
              revisionId
            }));
          }
        }
      }
    }

    // 4. Requirement Audit: Check for Unsatisfied Requirements
    const requirements = this.registry.getElementsByType('Requirement');
    for (const req of requirements) {
      checksCount++;
      const incomingRels = this.registry.getRelationshipsForTarget(req.mbseId);
      const isSatisfied = incomingRels.some(r => r.relationshipType === 'SATISFIES' || r.relationshipType === 'IMPLEMENTS');

      if (!isSatisfied) {
        findings.push(this.createFinding({
          severity: 'WARNING',
          category: 'REQUIREMENT',
          sourceMbseId: req.mbseId,
          ruleCode: 'UNSATISFIED_REQUIREMENT',
          explanation: `Requirement '${req.displayName}' is not satisfied by any Function, Component, or Subsystem.`,
          configurationId,
          revisionId
        }));
      }
    }

    // 5. Behavioral Audit: Check for States without outgoing transitions (unless marked isFinal)
    const states = this.registry.getElementsByType('State');
    for (const stateElem of states) {
      checksCount++;
      const stateObj = this.behavioral.getState(stateElem.mbseId);
      if (stateObj && !stateObj.isFinal) {
        const transitions = this.behavioral.getTransitionsForState(stateElem.mbseId);
        if (transitions.length === 0) {
          findings.push(this.createFinding({
            severity: 'INFO',
            category: 'BEHAVIORAL',
            sourceMbseId: stateElem.mbseId,
            ruleCode: 'DEADEND_STATE',
            explanation: `Non-final State '${stateElem.displayName}' has no outgoing transitions.`,
            configurationId,
            revisionId
          }));
        }
      }
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const warningCount = findings.filter(f => f.severity === 'WARNING').length;
    const infoCount = findings.filter(f => f.severity === 'INFO').length;

    return {
      timestamp: new Date().toISOString(),
      configurationId,
      revisionId,
      totalChecksPassed: Math.max(0, checksCount - findings.length),
      totalFindings: findings.length,
      criticalCount,
      warningCount,
      infoCount,
      findings,
      isConsistent: criticalCount === 0
    };
  }

  private createFinding(params: {
    severity: MBSEFindingSeverity;
    category: any;
    sourceMbseId: string;
    ruleCode: string;
    explanation: string;
    configurationId: string;
    revisionId: string;
  }): MBSEFinding {
    const findingId = `FINDING-${params.ruleCode}-${params.sourceMbseId}`;
    const provenanceId = `PROV-AUDIT-${createHash('sha256').update(findingId + params.revisionId).digest('hex').substring(0, 12)}`;

    return {
      findingId,
      severity: params.severity,
      category: params.category,
      sourceMbseId: params.sourceMbseId,
      ruleCode: params.ruleCode,
      explanation: params.explanation,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };
  }
}
