import { 
  AssemblyComponent, 
  AssemblyConstraint, 
  ConstraintDiagnosticResult, 
  ConstraintDiagnosticStatus
} from './AssemblyConstraintTypes';
import { DOFReport } from './KinematicTypes';

/**
 * PATCH-SECP-046-C — Constraint Diagnostic Engine
 * Provides deep insights into assembly health, detecting under/over-constrainment,
 * conflicts, and isolating problematic sets of constraints.
 */
export class ConstraintDiagnosticEngine {
  
  /**
   * Performs full diagnostics on a specific constraint
   */
  public static diagnoseConstraint(
    constraint: AssemblyConstraint,
    components: AssemblyComponent[],
    allConstraints: AssemblyConstraint[],
    dofReport: DOFReport
  ): ConstraintDiagnosticResult {
    
    // 1. Check for Dangling References
    const compA = components.find(c => c.instanceId === constraint.componentA);
    const compB = components.find(c => c.instanceId === constraint.componentB);

    if (!compA || !compB) {
      return {
        constraintId: constraint.constraintId,
        status: 'DANGLING_REFERENCE',
        affectedComponents: [constraint.componentA, constraint.componentB],
        affectedDOF: 0,
        residual: 0,
        message: `Constraint refers to missing component(s): ${!compA ? constraint.componentA : ''} ${!compB ? constraint.componentB : ''}`
      };
    }

    // 2. Check for Conflicts / Large Residuals
    if (constraint.status === 'CONFLICTING' || constraint.solverError > (constraint.parameters.tolerance || 1e-4)) {
      // Try to identify what it conflicts with
      const relatedConstraints = allConstraints.filter(c => 
        c.constraintId !== constraint.constraintId && 
        (c.componentA === constraint.componentA || c.componentB === constraint.componentA ||
         c.componentA === constraint.componentB || c.componentB === constraint.componentB)
      );

      return {
        constraintId: constraint.constraintId,
        status: 'CONFLICTING',
        affectedComponents: [constraint.componentA, constraint.componentB],
        affectedDOF: 0, // Conflict means it's fighting over existing DOF
        conflictsWith: relatedConstraints.map(c => c.constraintId),
        residual: constraint.solverError,
        message: `Constraint residual ${constraint.solverError.toExponential(4)} exceeds tolerance.`
      };
    }

    // 3. Analyze DOF context
    const dofA = dofReport.componentDofs[constraint.componentA];
    const dofB = dofReport.componentDofs[constraint.componentB];

    if (dofA && dofB) {
       if (dofA.isFixed && dofB.isFixed) {
         return {
           constraintId: constraint.constraintId,
           status: 'OVER_CONSTRAINED',
           affectedComponents: [constraint.componentA, constraint.componentB],
           affectedDOF: 0,
           residual: constraint.solverError,
           message: "Constraint applied between two fixed components (Redundant)."
         };
       }
    }

    // 4. If none of the above, it's valid (or at least satisfied)
    return {
      constraintId: constraint.constraintId,
      status: 'VALID',
      affectedComponents: [constraint.componentA, constraint.componentB],
      affectedDOF: 0, // Needs deep integration with DOF analyzer to be precise
      residual: constraint.solverError
    };
  }

  /**
   * Identifies the Minimal Conflict Set (MCS) for a failed solve
   */
  public static isolateConflicts(
    constraints: AssemblyConstraint[],
    components: AssemblyComponent[]
  ): string[] {
    // Basic implementation: return all constraints with high residuals or status 'CONFLICTING'
    return constraints
      .filter(c => c.status === 'CONFLICTING' || c.solverError > (c.parameters.tolerance || 1e-3))
      .map(c => c.constraintId);
  }

  /**
   * Summarizes assembly health
   */
  public static getAssemblyHealthSummary(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[],
    dofReport: DOFReport
  ): { status: string, score: number, criticalIssues: string[] } {
    const issues: string[] = [];
    let score = 100;

    if (dofReport.status === 'OVER_CONSTRAINED') {
      issues.push(`Assembly is over-constrained.`);
      score -= 20;
    }

    const conflicting = constraints.filter(c => c.status === 'CONFLICTING');
    if (conflicting.length > 0) {
      issues.push(`Detected ${conflicting.length} conflicting constraints.`);
      score -= 40;
    }

    const dangling = constraints.filter(c => {
      return !components.some(comp => comp.instanceId === c.componentA) ||
             !components.some(comp => comp.instanceId === c.componentB);
    });
    if (dangling.length > 0) {
      issues.push(`Detected ${dangling.length} dangling constraints.`);
      score -= 30;
    }

    return {
      status: score > 80 ? 'HEALTHY' : (score > 50 ? 'WARNING' : 'CRITICAL'),
      score: Math.max(0, score),
      criticalIssues: issues
    };
  }
}
