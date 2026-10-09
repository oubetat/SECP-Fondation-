/**
 * SECP — ADSE-P3 Architecture Constraint & Impact Analyzer
 * Manages architectural constraints (structural, allocation, interface, resource)
 * and evaluates bidirectional change impact (Requirements -> Architecture -> Verification).
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureDependencyEngine } from './ArchitectureDependencyEngine';
import { ArchitectureInterfaceEngine } from './ArchitectureInterfaceEngine';
import { ArchitectureDecisionEngine } from './ArchitectureDecisionEngine';
import { ArchitectureConstraint, ArchitectureImpactReport } from './types';

export class ArchitectureImpactAnalyzer {
  private registry: ArchitectureElementRegistry;
  private dependencyEngine: ArchitectureDependencyEngine;
  private interfaceEngine: ArchitectureInterfaceEngine;
  private decisionEngine?: ArchitectureDecisionEngine;
  private constraints: Map<string, ArchitectureConstraint> = new Map();

  constructor(
    registry: ArchitectureElementRegistry,
    dependencyEngine: ArchitectureDependencyEngine,
    interfaceEngine: ArchitectureInterfaceEngine,
    decisionEngine?: ArchitectureDecisionEngine
  ) {
    this.registry = registry;
    this.dependencyEngine = dependencyEngine;
    this.interfaceEngine = interfaceEngine;
    this.decisionEngine = decisionEngine;
  }

  public setDecisionEngine(decisionEngine: ArchitectureDecisionEngine) {
    this.decisionEngine = decisionEngine;
  }

  public registerConstraint(constraint: ArchitectureConstraint): ArchitectureConstraint {
    if (this.constraints.has(constraint.constraintId)) {
      throw new Error(`CONSTRAINT_ERROR: Architecture constraint '${constraint.constraintId}' already exists.`);
    }

    // Verify affected elements exist
    for (const archId of constraint.affectedArchIds) {
      if (!this.registry.getElement(archId)) {
        throw new Error(`CONSTRAINT_ERROR: Affected element '${archId}' not found.`);
      }
    }

    this.constraints.set(constraint.constraintId, constraint);
    return constraint;
  }

  public getAllConstraints(): ArchitectureConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * Performs an authoritative Impact Analysis if an architecture element changes or requirement updates.
   */
  public analyzeImpact(changedArchId: string): ArchitectureImpactReport {
    const root = this.registry.getElement(changedArchId);
    if (!root) {
      throw new Error(`IMPACT_ERROR: Architecture element '${changedArchId}' not found.`);
    }

    const directAffectedIds = new Set<string>();
    const indirectAffectedIds = new Set<string>();
    const affectedRequirements = new Set<string>();
    const affectedDecisions = new Set<string>();
    const affectedInterfaces = new Set<string>();
    const affectedDependencies = new Set<string>();

    if (root.p1RequirementId) {
      affectedRequirements.add(root.p1RequirementId);
    }

    // 1. Check direct relationships
    const relsFrom = this.registry.getRelationshipsForSource(changedArchId);
    for (const r of relsFrom) {
      directAffectedIds.add(r.targetArchId);
    }
    const relsTo = this.registry.getRelationshipsForTarget(changedArchId);
    for (const r of relsTo) {
      directAffectedIds.add(r.sourceArchId);
    }

    // 2. Check Interfaces
    const interfaces = this.interfaceEngine.getInterfacesForElement(changedArchId);
    for (const i of interfaces) {
      affectedInterfaces.add(i.interfaceId);
      directAffectedIds.add(i.providerArchId === changedArchId ? i.consumerArchId : i.providerArchId);
    }

    // 3. Check Dependencies (Downstream consumers)
    const dependencies = this.dependencyEngine.getDependenciesForElement(changedArchId);
    for (const d of dependencies) {
      affectedDependencies.add(d.dependencyId);
      if (d.targetArchId === changedArchId) {
        // Elements depending on the changed element are directly affected!
        directAffectedIds.add(d.sourceArchId);
      }
    }

    // 4. Check Decisions
    if (this.decisionEngine) {
      for (const dec of this.decisionEngine.getAllDecisions()) {
        if (dec.affectedElementArchIds.includes(changedArchId)) {
          affectedDecisions.add(dec.decisionId);
          for (const reqId of dec.requirementIds) {
            affectedRequirements.add(reqId);
          }
        }
      }
    }

    // 5. Expand indirect (Level 2 dependencies)
    for (const directId of directAffectedIds) {
      const subDeps = this.dependencyEngine.getDependenciesForElement(directId);
      for (const sd of subDeps) {
        if (sd.targetArchId === directId && sd.sourceArchId !== changedArchId && !directAffectedIds.has(sd.sourceArchId)) {
          indirectAffectedIds.add(sd.sourceArchId);
        }
      }
    }

    const totalImpactCount = directAffectedIds.size + indirectAffectedIds.size + affectedInterfaces.size;
    let riskAssessment = 'LOW';
    if (totalImpactCount > 8 || affectedDecisions.size > 2) riskAssessment = 'HIGH';
    else if (totalImpactCount > 3) riskAssessment = 'MEDIUM';

    return {
      sourceArchId: changedArchId,
      directAffectedIds: Array.from(directAffectedIds),
      indirectAffectedIds: Array.from(indirectAffectedIds),
      affectedRequirements: Array.from(affectedRequirements),
      affectedDecisions: Array.from(affectedDecisions),
      affectedInterfaces: Array.from(affectedInterfaces),
      affectedDependencies: Array.from(affectedDependencies),
      riskAssessment
    };
  }

  public clear(): void {
    this.constraints.clear();
  }
}
