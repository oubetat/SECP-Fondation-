/**
 * SECP — ADSE-P5 Structural Impact Analyzer
 * Extends P4 Digital Thread blast-radius propagation into physical structural integration,
 * evaluating affected requirements, architecture, parts, connections, constraints, placements, and verifications.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralConstraintEngine } from './StructuralConstraintEngine';
import { StructuralInterfaceEngine } from './StructuralInterfaceEngine';
import { StructuralPlacementEngine } from './StructuralPlacementEngine';
import { StructuralImpactReport, StructuralElement } from './types';

export class StructuralImpactAnalyzer {
  private registry: StructuralElementRegistry;
  private constraints: StructuralConstraintEngine;
  private interfaces: StructuralInterfaceEngine;
  private placements: StructuralPlacementEngine;

  constructor(
    registry: StructuralElementRegistry,
    constraints: StructuralConstraintEngine,
    interfaces: StructuralInterfaceEngine,
    placements: StructuralPlacementEngine
  ) {
    this.registry = registry;
    this.constraints = constraints;
    this.interfaces = interfaces;
    this.placements = placements;
  }

  /**
   * Performs an authoritative blast-radius impact analysis when a structural element or transform is modified.
   */
  public analyzeImpact(changedElementId: string): StructuralImpactReport {
    const root = this.registry.getElement(changedElementId);
    if (!root) {
      throw new Error(`IMPACT_ANALYSIS_ERROR: Structural element '${changedElementId}' not found.`);
    }

    const visitedNodes = new Set<string>();
    const affectedStructuralElements: string[] = [];
    const affectedRequirements: string[] = [];
    const affectedMbseElements: string[] = [];
    const affectedArchitecture: string[] = [];
    const affectedConstraints: string[] = [];
    const affectedInterfaces: string[] = [];
    const affectedPlacements: string[] = [];
    const affectedVerifications: string[] = [];
    const affectedEvidences: string[] = [];
    const affectedPublications: string[] = [];

    const queue = [changedElementId];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      if (visitedNodes.has(currId)) continue;
      visitedNodes.add(currId);

      const elem = this.registry.getElement(currId);
      if (elem) {
        if (elem.elementId !== changedElementId) {
          affectedStructuralElements.push(elem.elementId);
        }
        if (elem.p1ReqId) affectedRequirements.push(elem.p1ReqId);
        if (elem.p2MbseId) affectedMbseElements.push(elem.p2MbseId);
        if (elem.p3ArchId) affectedArchitecture.push(elem.p3ArchId);

        // Check placement transform
        if (this.placements.getPlacement(elem.elementId)) {
          affectedPlacements.push(elem.elementId);
        }

        // Downstream relationships
        const { outgoing, incoming } = this.registry.getRelationshipsForElement(elem.elementId);
        for (const rel of [...outgoing, ...incoming]) {
          const neighbor = rel.sourceElementId === currId ? rel.targetElementId : rel.sourceElementId;
          if (!visitedNodes.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }

    // Check associated constraints
    for (const c of this.constraints.getAllConstraints()) {
      if (visitedNodes.has(c.sourceElementId) || visitedNodes.has(c.targetElementId)) {
        affectedConstraints.push(c.constraintId);
        if (c.verifiedByIntentId) affectedVerifications.push(c.verifiedByIntentId);
        if (c.evidenceId) affectedEvidences.push(c.evidenceId);
      }
    }

    // Check associated interfaces & connections
    for (const iface of this.interfaces.getAllInterfaces()) {
      if (visitedNodes.has(iface.providerElementId) || visitedNodes.has(iface.consumerElementId)) {
        affectedInterfaces.push(iface.interfaceId);
      }
    }

    for (const conn of this.interfaces.getAllConnections()) {
      if (visitedNodes.has(conn.sourcePartId) || visitedNodes.has(conn.targetPartId)) {
        if (conn.verifiedByIntentId) affectedVerifications.push(conn.verifiedByIntentId);
        if (conn.evidenceId) affectedEvidences.push(conn.evidenceId);
      }
    }

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (affectedEvidences.length > 0 || affectedPublications.length > 0) {
      severity = 'CRITICAL';
    } else if (affectedVerifications.length > 0 || affectedConstraints.length > 0) {
      severity = 'HIGH';
    } else if (affectedArchitecture.length > 0 || affectedStructuralElements.length > 0) {
      severity = 'MEDIUM';
    }

    return {
      changedElementId,
      affectedRequirements: Array.from(new Set(affectedRequirements)),
      affectedMbseElements: Array.from(new Set(affectedMbseElements)),
      affectedArchitecture: Array.from(new Set(affectedArchitecture)),
      affectedStructuralElements: Array.from(new Set(affectedStructuralElements)),
      affectedInterfaces: Array.from(new Set(affectedInterfaces)),
      affectedConstraints: Array.from(new Set(affectedConstraints)),
      affectedPlacements: Array.from(new Set(affectedPlacements)),
      affectedVerifications: Array.from(new Set(affectedVerifications)),
      affectedEvidences: Array.from(new Set(affectedEvidences)),
      affectedPublications: Array.from(new Set(affectedPublications)),
      severity
    };
  }
}
