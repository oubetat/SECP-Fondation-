import {
  IndustrialSketchDefinition,
  IndustrialSketchConstraint,
  IndustrialSketchEntity,
  ConstraintCausalityReport,
  ConstraintCausalityNode,
  SketchDOFReport,
  SolverSolutionState,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D
} from './IndustrialConstraintTypes';

export class ConstraintGraphEngine {
  private sketch: IndustrialSketchDefinition;
  private entityToConstraints: Map<string, Set<string>> = new Map();
  private constraintToEntities: Map<string, Set<string>> = new Map();

  constructor(sketch: IndustrialSketchDefinition) {
    this.sketch = sketch;
    this.buildGraph();
  }

  public rebuildGraph(sketch: IndustrialSketchDefinition): void {
    this.sketch = sketch;
    this.buildGraph();
  }

  private buildGraph(): void {
    this.entityToConstraints.clear();
    this.constraintToEntities.clear();

    // Initialize entity maps
    for (const entityId of Object.keys(this.sketch.entities)) {
      this.entityToConstraints.set(entityId, new Set());
    }

    // Process constraints
    for (const [cId, constraint] of Object.entries(this.sketch.constraints)) {
      if (constraint.suppressionState === 'SUPPRESSED') continue;

      const entitySet = new Set<string>();
      for (const eId of constraint.entityIds) {
        if (this.sketch.entities[eId]) {
          entitySet.add(eId);
          if (!this.entityToConstraints.has(eId)) {
            this.entityToConstraints.set(eId, new Set());
          }
          this.entityToConstraints.get(eId)!.add(cId);
        } else {
          // If entity ID is a point inside line/circle
          for (const [key, ent] of Object.entries(this.sketch.entities)) {
            if (ent.type === 'LINE' && (ent.startPointId === eId || ent.endPointId === eId)) {
              entitySet.add(key);
              this.entityToConstraints.get(key)?.add(cId);
            } else if ((ent.type === 'CIRCLE' || ent.type === 'ARC') && ent.centerPointId === eId) {
              entitySet.add(key);
              this.entityToConstraints.get(key)?.add(cId);
            }
          }
        }
      }
      this.constraintToEntities.set(cId, entitySet);
    }
  }

  /**
   * Compute Degrees of Freedom (DOF) for the sketch.
   * Point = 2 DOF (x, y), unless fixed (0 DOF).
   * Line = 4 DOF (start x, y, end x, y) minus point linkages.
   * Circle = 3 DOF (center x, y, radius).
   * Arc = 5 DOF (center x, y, start x, y, end x, y, radius).
   */
  public computeDOFReport(): SketchDOFReport {
    let totalDOF = 0;

    // Calculate raw degrees of freedom for free entities
    for (const ent of Object.values(this.sketch.entities)) {
      if (ent.type === 'POINT') {
        totalDOF += ent.isFixed ? 0 : 2;
      } else if (ent.type === 'CIRCLE') {
        totalDOF += 1; // Radius (center is usually a point)
      } else if (ent.type === 'ARC') {
        totalDOF += 1; // Radius
      }
    }

    let constrainedDOF = 0;
    const activeConstraints = Object.values(this.sketch.constraints).filter(c => c.suppressionState !== 'SUPPRESSED');
    const redundantConstraintIds: string[] = [];
    const conflictingConstraintIds: string[] = [];

    // Analyze constraints contribution
    for (const c of activeConstraints) {
      const dofRemoved = this.getDOFRemovedByConstraint(c);
      constrainedDOF += dofRemoved;
    }

    const remainingDOF = totalDOF - constrainedDOF;

    // Determine state & check inconsistency / over-constraint
    let state: SolverSolutionState = 'SOLVED';

    if (this.detectInconsistency()) {
      state = 'INCONSISTENT';
      conflictingConstraintIds.push(...this.getConflictingConstraintSet());
    } else if (remainingDOF < 0) {
      state = 'OVER_CONSTRAINED';
      conflictingConstraintIds.push(...this.getConflictingConstraintSet());
    } else if (remainingDOF > 0) {
      state = 'UNDER_CONSTRAINED';
    } else {
      state = 'FULLY_CONSTRAINED';
    }

    return {
      totalDegreesOfFreedom: totalDOF,
      constrainedDegreesOfFreedom: constrainedDOF,
      remainingDegreesOfFreedom: Math.max(0, remainingDOF),
      state,
      redundantConstraintIds,
      conflictingConstraintIds
    };
  }

  /**
   * Extract affected sub-graph for incremental solving when a constraint or parameter is updated.
   */
  public extractAffectedSubGraph(modifiedConstraintId: string): {
    affectedEntityIds: string[];
    affectedConstraintIds: string[];
  } {
    const affectedEntityIds = new Set<string>();
    const affectedConstraintIds = new Set<string>();

    const queue: string[] = [modifiedConstraintId];
    affectedConstraintIds.add(modifiedConstraintId);

    while (queue.length > 0) {
      const currCId = queue.shift()!;
      const entities = this.constraintToEntities.get(currCId) || new Set();

      for (const eId of entities) {
        if (!affectedEntityIds.has(eId)) {
          affectedEntityIds.add(eId);
          // Add all constraints attached to this entity
          const relatedConstraints = this.entityToConstraints.get(eId) || new Set();
          for (const relCId of relatedConstraints) {
            if (!affectedConstraintIds.has(relCId)) {
              affectedConstraintIds.add(relCId);
              queue.push(relCId);
            }
          }
        }
      }
    }

    return {
      affectedEntityIds: Array.from(affectedEntityIds),
      affectedConstraintIds: Array.from(affectedConstraintIds)
    };
  }

  /**
   * Analyze causality and build causal chains explaining conflicts.
   */
  public analyzeConstraintCausality(): ConstraintCausalityReport {
    const dofReport = this.computeDOFReport();
    if (dofReport.state !== 'OVER_CONSTRAINED' && dofReport.state !== 'INCONSISTENT') {
      return {
        isConflict: false,
        conflictSet: [],
        causalChains: [],
        explanation: 'No constraint conflict detected in current sketch.'
      };
    }

    const conflictSet = this.getConflictingConstraintSet();
    const causalChains: ConstraintCausalityNode[] = [];

    for (let i = 0; i < conflictSet.length; i++) {
      const cId = conflictSet[i];
      const c = this.sketch.constraints[cId];
      if (!c) continue;

      const parentCauses = conflictSet.filter(id => id !== cId);
      causalChains.push({
        constraintId: cId,
        type: c.type,
        conflictingEntityIds: c.entityIds,
        reason: `Constraint '${cId}' [${c.type}] creates over-constraint / inconsistency with existing fixed/dimensional constraints.`,
        causedByConstraintIds: parentCauses
      });
    }

    const explanation = `Conflict detected involving ${conflictSet.length} constraints: [${conflictSet.join(', ')}]. DOF remaining: ${dofReport.remainingDegreesOfFreedom}.`;

    return {
      isConflict: true,
      conflictSet,
      causalChains,
      explanation
    };
  }

  private getDOFRemovedByConstraint(c: IndustrialSketchConstraint): number {
    switch (c.type) {
      case 'COINCIDENT': return 2; // Constrains (x,y)
      case 'HORIZONTAL': return 1; // Constrains dy = 0
      case 'VERTICAL': return 1;   // Constrains dx = 0
      case 'PARALLEL': return 1;   // Constrains angle
      case 'PERPENDICULAR': return 1; // Constrains angle
      case 'TANGENT': return 1;    // Constrains distance = radius
      case 'CONCENTRIC': return 2; // Constrains center (x,y)
      case 'EQUAL': return 1;      // Constrains length or radius
      case 'SYMMETRIC': return 2;  // Constrains 2 points about line
      case 'DISTANCE': return 1;   // Constrains scalar distance
      case 'ANGLE': return 1;      // Constrains angle
      case 'RADIUS': return 1;     // Constrains radius
      case 'DIAMETER': return 1;   // Constrains 2 * radius
      default: return 1;
    }
  }

  private detectInconsistency(): boolean {
    // Check for contradictory constraints (e.g. HORIZONTAL and VERTICAL on same line, or contradictory DISTANCEs)
    const activeConstraints = Object.values(this.sketch.constraints).filter(c => c.suppressionState !== 'SUPPRESSED');

    for (const c of activeConstraints) {
      if (c.type === 'HORIZONTAL') {
        const hasVert = activeConstraints.some(other =>
          other.type === 'VERTICAL' &&
          other.entityIds.length === c.entityIds.length &&
          other.entityIds.every(id => c.entityIds.includes(id))
        );
        if (hasVert) return true;
      }
      if (c.type === 'DISTANCE') {
        const duplicateWithDiffVal = activeConstraints.some(other =>
          other.id !== c.id &&
          other.type === 'DISTANCE' &&
          other.entityIds.length === c.entityIds.length &&
          other.entityIds.every(id => c.entityIds.includes(id)) &&
          other.value !== undefined && c.value !== undefined &&
          Math.abs((other.value || 0) - (c.value || 0)) > 1e-3
        );
        if (duplicateWithDiffVal) return true;
      }
    }
    return false;
  }

  private getConflictingConstraintSet(): string[] {
    const activeConstraints = Object.values(this.sketch.constraints).filter(c => c.suppressionState !== 'SUPPRESSED');
    const conflicts: string[] = [];

    for (const c of activeConstraints) {
      if (c.type === 'HORIZONTAL') {
        const vert = activeConstraints.find(other =>
          other.type === 'VERTICAL' &&
          other.entityIds.length === c.entityIds.length &&
          other.entityIds.every(id => c.entityIds.includes(id))
        );
        if (vert) {
          if (!conflicts.includes(c.id)) conflicts.push(c.id);
          if (!conflicts.includes(vert.id)) conflicts.push(vert.id);
        }
      }
      if (c.type === 'DISTANCE') {
        const dupes = activeConstraints.filter(other =>
          other.type === 'DISTANCE' &&
          other.entityIds.length === c.entityIds.length &&
          other.entityIds.every(id => c.entityIds.includes(id))
        );
        if (dupes.length > 1) {
          dupes.forEach(d => { if (!conflicts.includes(d.id)) conflicts.push(d.id); });
        }
      }
    }

    if (conflicts.length === 0 && activeConstraints.length > 0) {
      // Return last added constraints causing over-constraint
      conflicts.push(...activeConstraints.slice(-2).map(c => c.id));
    }

    return conflicts;
  }

  public getConstraintGraphHash(): string {
    const activeConstraints = Object.values(this.sketch.constraints)
      .filter(c => c.suppressionState !== 'SUPPRESSED')
      .map(c => `${c.id}:${c.type}:${c.entityIds.join(',')}:${c.value || ''}`)
      .sort()
      .join('|');

    let hash = 0;
    for (let i = 0; i < activeConstraints.length; i++) {
      const char = activeConstraints.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha256-cgraph-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}
