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
    
    const cId = constraint.constraintId || constraint.id || '';
    const compAKey = constraint.componentA || '';
    const compBKey = constraint.componentB || '';

    // 1. Check for Dangling References
    const compA = components.find(c => c.instanceId === compAKey);
    const compB = components.find(c => c.instanceId === compBKey);

    if (!compA || !compB) {
      return {
        constraintId: cId,
        status: 'DANGLING_REFERENCE',
        affectedComponents: [compAKey, compBKey],
        affectedDOF: 0,
        residual: 0,
        message: `Constraint refers to missing component(s): ${!compA ? compAKey : ''} ${!compB ? compBKey : ''}`
      };
    }

    const solverErr = constraint.solverError ?? 0;
    const tol = constraint.parameters?.tolerance || 1e-4;

    // 2. Check for Conflicts / Large Residuals
    if (constraint.status === 'CONFLICTING' || solverErr > tol) {
      // Try to identify what it conflicts with
      const relatedConstraints = allConstraints.filter(c => 
        (c.constraintId || c.id) !== cId && 
        (c.componentA === compAKey || c.componentB === compAKey ||
         c.componentA === compBKey || c.componentB === compBKey)
      );

      return {
        constraintId: cId,
        status: 'CONFLICTING',
        affectedComponents: [compAKey, compBKey],
        affectedDOF: 0, // Conflict means it's fighting over existing DOF
        conflictsWith: relatedConstraints.map(c => c.constraintId || c.id || ''),
        residual: solverErr,
        message: `Constraint residual ${solverErr.toExponential(4)} exceeds tolerance.`
      };
    }

    // 3. Analyze DOF context
    const dofA = compAKey && dofReport.componentDofs ? dofReport.componentDofs[compAKey] : undefined;
    const dofB = compBKey && dofReport.componentDofs ? dofReport.componentDofs[compBKey] : undefined;

    if (dofA && dofB) {
       if (dofA.isFixed && dofB.isFixed) {
         return {
           constraintId: cId,
           status: 'OVER_CONSTRAINED',
           affectedComponents: [compAKey, compBKey],
           affectedDOF: 0,
           residual: solverErr,
           message: "Constraint applied between two fixed components (Redundant)."
         };
       }
    }

    // 4. If none of the above, it's valid (or at least satisfied)
    return {
      constraintId: cId,
      status: 'VALID',
      affectedComponents: [compAKey, compBKey],
      affectedDOF: 0, // Needs deep integration with DOF analyzer to be precise
      residual: solverErr
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
      .filter(c => c.status === 'CONFLICTING' || (c.solverError ?? 0) > (c.parameters?.tolerance || 1e-3))
      .map(c => c.constraintId || c.id || '');
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
