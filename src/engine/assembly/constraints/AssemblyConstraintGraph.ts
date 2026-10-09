import { AssemblyConstraint, AssemblyConstraintType } from './AssemblyConstraintModel';

export class AssemblyConstraintGraph {
  private components: Set<string> = new Set();
  private constraints: Map<string, AssemblyConstraint> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // componentId -> set of constraintIds

  /**
   * Add a component node to the graph
   */
  public addComponent(componentId: string): void {
    if (!componentId) return;
    this.components.add(componentId);
    if (!this.adjacency.has(componentId)) {
      this.adjacency.set(componentId, new Set());
    }
  }

  /**
   * Remove a component node and its associated constraints
   */
  public removeComponent(componentId: string): void {
    this.components.delete(componentId);
    const associated = this.adjacency.get(componentId);
    if (associated) {
      for (const cid of associated) {
        this.removeConstraint(cid);
      }
    }
    this.adjacency.delete(componentId);
  }

  /**
   * Insert/update a constraint edge in the graph
   */
  public addConstraint(constraint: AssemblyConstraint): void {
    this.constraints.set(constraint.constraintId, constraint);

    this.addComponent(constraint.componentA);
    this.addComponent(constraint.componentB);

    if (!constraint.suppressed && constraint.enabled) {
      this.adjacency.get(constraint.componentA)!.add(constraint.constraintId);
      this.adjacency.get(constraint.componentB)!.add(constraint.constraintId);
    }
  }

  /**
   * Remove a constraint edge
   */
  public removeConstraint(constraintId: string): void {
    const c = this.constraints.get(constraintId);
    if (c) {
      this.adjacency.get(c.componentA)?.delete(constraintId);
      this.adjacency.get(c.componentB)?.delete(constraintId);
    }
    this.constraints.delete(constraintId);
  }

  /**
   * Suppress/unsuppress a constraint
   */
  public setSuppressed(constraintId: string, suppressed: boolean): void {
    const c = this.constraints.get(constraintId);
    if (c) {
      c.suppressed = suppressed;
      if (suppressed) {
        this.adjacency.get(c.componentA)?.delete(constraintId);
        this.adjacency.get(c.componentB)?.delete(constraintId);
      } else if (c.enabled) {
        this.adjacency.get(c.componentA)?.add(constraintId);
        this.adjacency.get(c.componentB)?.add(constraintId);
      }
    }
  }

  /**
   * Returns all active, unsuppressed constraints
   */
  public getActiveConstraints(): AssemblyConstraint[] {
    return Array.from(this.constraints.values()).filter(c => !c.suppressed && c.enabled);
  }

  /**
   * Identifies all independent connected component groups of assembly components
   */
  public findConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    const activeConstraints = this.getActiveConstraints();

    for (const compId of this.components) {
      if (visited.has(compId)) continue;

      const currentGroup: string[] = [];
      const queue: string[] = [compId];
      visited.add(compId);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        currentGroup.push(curr);

        // Find all active neighbors of curr component
        const related = activeConstraints.filter(c => c.componentA === curr || c.componentB === curr);
        for (const c of related) {
          const neighbor = c.componentA === curr ? c.componentB : c.componentA;
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      components.push(currentGroup);
    }

    return components;
  }

  /**
   * Traverse downstream dependents from a changed component
   */
  public getDownstreamDependents(startComponentId: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const queue: string[] = [startComponentId];
    visited.add(startComponentId);

    const activeConstraints = this.getActiveConstraints();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr !== startComponentId) {
        order.push(curr);
      }

      const related = activeConstraints.filter(c => c.componentA === curr || c.componentB === curr);
      for (const c of related) {
        const neighbor = c.componentA === curr ? c.componentB : c.componentA;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return order;
  }

  /**
   * Determine solve execution order starting from grounded components
   */
  public determineSolveOrdering(groundedComponentId?: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [];

    if (groundedComponentId && this.components.has(groundedComponentId)) {
      queue.push(groundedComponentId);
      visited.add(groundedComponentId);
    } else {
      // Find any fixed/grounded components
      const activeConstraints = this.getActiveConstraints();
      const fixedConstraint = activeConstraints.find(c => c.constraintType === 'FIXED');
      if (fixedConstraint) {
        queue.push(fixedConstraint.componentA);
        visited.add(fixedConstraint.componentA);
      } else if (this.components.size > 0) {
        // Fall back to first component
        const first = Array.from(this.components)[0];
        queue.push(first);
        visited.add(first);
      }
    }

    const activeConstraints = this.getActiveConstraints();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);

      const related = activeConstraints.filter(c => c.componentA === curr || c.componentB === curr);
      for (const c of related) {
        const neighbor = c.componentA === curr ? c.componentB : c.componentA;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Add any remaining disconnected components
    for (const compId of this.components) {
      if (!visited.has(compId)) {
        order.push(compId);
        visited.add(compId);
      }
    }

    return order;
  }

  /**
   * Detects redundant constraints in the current graph
   */
  public detectRedundancies(): AssemblyConstraint[] {
    const redundancies: AssemblyConstraint[] = [];
    const active = this.getActiveConstraints();

    for (let i = 0; i < active.length; i++) {
      const c1 = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const c2 = active[j];

        const sameComponentPair =
          (c1.componentA === c2.componentA && c1.componentB === c2.componentB) ||
          (c1.componentA === c2.componentB && c1.componentB === c2.componentA);

        if (sameComponentPair) {
          // Dual FIXED constraints grounding the same component pair are redundant
          if (c1.constraintType === 'FIXED' && c2.constraintType === 'FIXED') {
            redundancies.push(c2);
          }

          // Identical references and constraint types
          const sameRefA =
            c1.geometryReferenceA.topologyType === c2.geometryReferenceA.topologyType &&
            c1.geometryReferenceA.topologyIndex === c2.geometryReferenceA.topologyIndex;
          const sameRefB =
            c1.geometryReferenceB.topologyType === c2.geometryReferenceB.topologyType &&
            c1.geometryReferenceB.topologyIndex === c2.geometryReferenceB.topologyIndex;

          if (sameRefA && sameRefB && c1.constraintType === c2.constraintType) {
            // Distance with same value is redundant
            if (c1.constraintType === 'DISTANCE' || c1.constraintType === 'COINCIDENT') {
              const off1 = c1.parameters.offsetMm ?? 0;
              const off2 = c2.parameters.offsetMm ?? 0;
              if (Math.abs(off1 - off2) < 1e-5) {
                redundancies.push(c2);
              }
            } else {
              redundancies.push(c2);
            }
          }
        }
      }
    }

    return redundancies;
  }

  /**
   * Detects contradictory constraint conflicts
   */
  public detectConflicts(): { c1: AssemblyConstraint; c2: AssemblyConstraint; reason: string } | null {
    const active = this.getActiveConstraints();

    for (let i = 0; i < active.length; i++) {
      const c1 = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const c2 = active[j];

        const sameComponentPair =
          (c1.componentA === c2.componentA && c1.componentB === c2.componentB) ||
          (c1.componentA === c2.componentB && c1.componentB === c2.componentA);

        if (sameComponentPair) {
          // Check contradictory distance values on same references
          const sameRefA =
            c1.geometryReferenceA.topologyType === c2.geometryReferenceA.topologyType &&
            c1.geometryReferenceA.topologyIndex === c2.geometryReferenceA.topologyIndex;
          const sameRefB =
            c1.geometryReferenceB.topologyType === c2.geometryReferenceB.topologyType &&
            c1.geometryReferenceB.topologyIndex === c2.geometryReferenceB.topologyIndex;

          if (sameRefA && sameRefB) {
            if (c1.constraintType === 'DISTANCE' && c2.constraintType === 'DISTANCE') {
              const off1 = c1.parameters.offsetMm ?? 0;
              const off2 = c2.parameters.offsetMm ?? 0;
              if (Math.abs(off1 - off2) > 1e-4) {
                return {
                  c1,
                  c2,
                  reason: `Contradictory distance constraints on same geometry reference: ${off1}mm vs ${off2}mm.`,
                };
              }
            }

            if (c1.constraintType === 'ANGLE' && c2.constraintType === 'ANGLE') {
              const ang1 = c1.parameters.angleDeg ?? 0;
              const ang2 = c2.parameters.angleDeg ?? 0;
              if (Math.abs(ang1 - ang2) > 1e-4) {
                return {
                  c1,
                  c2,
                  reason: `Contradictory angle constraints on same geometry reference: ${ang1}° vs ${ang2}°.`,
                };
              }
            }

            // Parallel vs Perpendicular
            if (
              (c1.constraintType === 'PARALLEL' && c2.constraintType === 'PERPENDICULAR') ||
              (c2.constraintType === 'PARALLEL' && c1.constraintType === 'PERPENDICULAR')
            ) {
              return {
                c1,
                c2,
                reason: 'Parallel and Perpendicular are mutually exclusive on the same geometry references.',
              };
            }

            // Coincident contact vs non-zero Distance
            if (
              (c1.constraintType === 'COINCIDENT' && c2.constraintType === 'DISTANCE' && (c2.parameters.offsetMm ?? 0) !== 0) ||
              (c2.constraintType === 'COINCIDENT' && c1.constraintType === 'DISTANCE' && (c1.parameters.offsetMm ?? 0) !== 0)
            ) {
              return {
                c1,
                c2,
                reason: 'Coincident planar contact conflicts with non-zero Distance constraint.',
              };
            }
          }
        }
      }
    }

    return null;
  }
}
