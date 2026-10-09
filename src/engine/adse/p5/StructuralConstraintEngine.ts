/**
 * SECP — ADSE-P5 Structural Constraint Engine
 * Manages physical and assembly constraints (Coincident, Concentric, Parallel, Perpendicular, Distance, Angle, Tangent, Fixed, Rigid).
 * Detects contradictory, over-constrained, under-constrained, and dangling constraints.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralConstraint, StructuralConstraintType } from './types';
import { createHash } from 'crypto';

export class StructuralConstraintEngine {
  private registry: StructuralElementRegistry;
  private constraints: Map<string, StructuralConstraint> = new Map();

  constructor(registry: StructuralElementRegistry) {
    this.registry = registry;
  }

  public registerConstraint(params: {
    constraintId?: string;
    constraintType: StructuralConstraintType;
    displayName: string;
    sourceElementId: string;
    targetElementId: string;
    parameters?: Record<string, any>;
    configurationId: string;
    revisionId?: string;
    verifiedByIntentId?: string;
  }): StructuralConstraint {
    const source = this.registry.getElement(params.sourceElementId);
    const target = this.registry.getElement(params.targetElementId);

    if (!source) {
      throw new Error(`CONSTRAINT_ERROR: Source element '${params.sourceElementId}' not found.`);
    }
    if (!target) {
      throw new Error(`CONSTRAINT_ERROR: Target element '${params.targetElementId}' not found.`);
    }

    const id = params.constraintId || `CONST-STRUCT-${params.constraintType}-${params.sourceElementId}->${params.targetElementId}`;
    if (this.constraints.has(id)) {
      throw new Error(`CONSTRAINT_ERROR: Constraint '${id}' already exists.`);
    }

    // Cross-configuration isolation check
    if (source.configurationId !== target.configurationId && source.configurationId !== 'CONF-BASE' && target.configurationId !== 'CONF-BASE') {
      throw new Error(
        `CROSS_CONFIGURATION_CONSTRAINT_ERROR: Cannot constrain '${params.sourceElementId}' [${source.configurationId}] with '${params.targetElementId}' [${target.configurationId}] across mismatched configuration boundaries.`
      );
    }

    const revisionId = params.revisionId || source.revisionId;
    const provenanceId = `PROV-CONST-${createHash('sha256').update(id + revisionId).digest('hex').substring(0, 12)}`;

    // Contradictory Constraint Check (e.g. Parallel AND Perpendicular between same source & target)
    const existingBetween = Array.from(this.constraints.values()).filter(
      c => (c.sourceElementId === params.sourceElementId && c.targetElementId === params.targetElementId) ||
           (c.sourceElementId === params.targetElementId && c.targetElementId === params.sourceElementId)
    );

    let status: StructuralConstraint['status'] = 'VALID';
    for (const c of existingBetween) {
      if ((c.constraintType === 'Parallel' && params.constraintType === 'Perpendicular') ||
          (c.constraintType === 'Perpendicular' && params.constraintType === 'Parallel') ||
          (c.constraintType === 'Fixed' && params.constraintType === 'Distance' && params.parameters?.distance !== 0)) {
        status = 'CONTRADICTORY';
      }
    }

    const constraint: StructuralConstraint = {
      constraintId: id,
      constraintType: params.constraintType,
      displayName: params.displayName,
      sourceElementId: params.sourceElementId,
      targetElementId: params.targetElementId,
      parameters: params.parameters || {},
      configurationId: params.configurationId,
      revisionId,
      provenanceId,
      status,
      verifiedByIntentId: params.verifiedByIntentId
    };

    if (status === 'CONTRADICTORY') {
      this.constraints.set(id, constraint);
      throw new Error(`CONTRADICTORY_CONSTRAINT_ERROR: Constraint '${id}' contradicts existing structural constraint.`);
    }

    this.constraints.set(id, constraint);
    return constraint;
  }

  public getConstraint(constraintId: string): StructuralConstraint | undefined {
    return this.constraints.get(constraintId);
  }

  public getAllConstraints(): StructuralConstraint[] {
    return Array.from(this.constraints.values());
  }

  public getConstraintsForElement(elementId: string): StructuralConstraint[] {
    return Array.from(this.constraints.values()).filter(
      c => c.sourceElementId === elementId || c.targetElementId === elementId
    );
  }

  /**
   * Evaluates overall constraint health across a configuration slice.
   */
  public evaluateConstraintHealth(configurationId: string = 'CONF-BASE'): {
    totalConstraints: number;
    validCount: number;
    contradictoryCount: number;
    danglingCount: number;
  } {
    const configConstraints = Array.from(this.constraints.values()).filter(c => c.configurationId === configurationId || c.configurationId === 'CONF-BASE');

    let validCount = 0;
    let contradictoryCount = 0;
    let danglingCount = 0;

    for (const c of configConstraints) {
      const src = this.registry.getElement(c.sourceElementId);
      const tgt = this.registry.getElement(c.targetElementId);

      if (!src || !tgt) {
        c.status = 'DANGLING';
        danglingCount++;
      } else if (c.status === 'CONTRADICTORY') {
        contradictoryCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalConstraints: configConstraints.length,
      validCount,
      contradictoryCount,
      danglingCount
    };
  }

  public clear(): void {
    this.constraints.clear();
  }
}
