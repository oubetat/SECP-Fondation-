import { AssemblyConstraint, AssemblyComponentPose } from './AssemblyConstraintModel';
import { AssemblyConstraintEvaluator } from './AssemblyConstraint';

export class AssemblySolverDiagnostics {
  /**
   * Performs Degrees of Freedom (DOF) accounting for all active components
   */
  public static analyzeDegreesOfFreedom(
    components: AssemblyComponentPose[],
    constraints: AssemblyConstraint[],
    groundedComponentId?: string
  ): {
    componentDOFs: Record<string, {
      initialDOF: number;
      remainingDOF: number;
      constrainedDOF: number;
      redundantDOF: number;
      conflictingDOF: number;
      unconstrainedDirections: string[];
    }>;
    totalAssemblyDOF: number;
  } {
    const componentDOFs: Record<string, {
      initialDOF: number;
      remainingDOF: number;
      constrainedDOF: number;
      redundantDOF: number;
      conflictingDOF: number;
      unconstrainedDirections: string[];
    }> = {};

    let totalAssemblyDOF = 0;

    // Check duplicate/redundant constraints
    const redundancies = new Set<string>();
    const conflicts = new Set<string>();

    // 1. Detect pairwise redundancies and conflicts
    for (let i = 0; i < constraints.length; i++) {
      const c1 = constraints[i];
      for (let j = i + 1; j < constraints.length; j++) {
        const c2 = constraints[j];
        if (c1.suppressed || c2.suppressed || !c1.enabled || !c2.enabled) continue;

        const samePair = (c1.componentA === c2.componentA && c1.componentB === c2.componentB) ||
                         (c1.componentA === c2.componentB && c1.componentB === c2.componentA);

        if (samePair) {
          if (c1.constraintType === c2.constraintType) {
            if (c1.constraintType === 'DISTANCE') {
              if (Math.abs((c1.parameters.offsetMm ?? 0) - (c2.parameters.offsetMm ?? 0)) > 1e-4) {
                conflicts.add(c1.constraintId);
                conflicts.add(c2.constraintId);
              } else {
                redundancies.add(c2.constraintId);
              }
            } else if (c1.constraintType === 'ANGLE') {
              if (Math.abs((c1.parameters.angleDeg ?? 0) - (c2.parameters.angleDeg ?? 0)) > 1e-4) {
                conflicts.add(c1.constraintId);
                conflicts.add(c2.constraintId);
              } else {
                redundancies.add(c2.constraintId);
              }
            } else {
              redundancies.add(c2.constraintId);
            }
          } else {
            // Parallel vs Perpendicular
            if ((c1.constraintType === 'PARALLEL' && c2.constraintType === 'PERPENDICULAR') ||
                (c1.constraintType === 'PERPENDICULAR' && c2.constraintType === 'PARALLEL')) {
              conflicts.add(c1.constraintId);
              conflicts.add(c2.constraintId);
            }
            // Coincident vs non-zero distance
            if ((c1.constraintType === 'COINCIDENT' && c2.constraintType === 'DISTANCE' && (c2.parameters.offsetMm ?? 0) !== 0) ||
                (c2.constraintType === 'COINCIDENT' && c1.constraintType === 'DISTANCE' && (c1.parameters.offsetMm ?? 0) !== 0)) {
              conflicts.add(c1.constraintId);
              conflicts.add(c2.constraintId);
            }
          }
        }
      }
    }

    // 2. Compute individual components' DOF
    for (const comp of components) {
      const isGrounded = comp.instanceId === groundedComponentId;
      if (isGrounded) {
        componentDOFs[comp.instanceId] = {
          initialDOF: 6,
          remainingDOF: 0,
          constrainedDOF: 6,
          redundantDOF: 0,
          conflictingDOF: 0,
          unconstrainedDirections: [],
        };
        continue;
      }

      // Filter active constraints targeting this component
      const activeConstraints = constraints.filter(
        c => !c.suppressed && c.enabled && (c.componentA === comp.instanceId || c.componentB === comp.instanceId)
      );

      let constrainedDOF = 0;
      let componentRedundant = 0;
      let componentConflicting = 0;

      const freeDirs = {
        tx: true, ty: true, tz: true,
        rx: true, ry: true, rz: true,
      };

      for (const c of activeConstraints) {
        const isRedundant = redundancies.has(c.constraintId);
        const isConflicting = conflicts.has(c.constraintId);

        if (isRedundant) {
          componentRedundant++;
          continue;
        }
        if (isConflicting) {
          componentConflicting++;
        }

        // Apply DOF constraints
        switch (c.constraintType) {
          case 'FIXED':
            constrainedDOF += 6;
            freeDirs.tx = false; freeDirs.ty = false; freeDirs.tz = false;
            freeDirs.rx = false; freeDirs.ry = false; freeDirs.rz = false;
            break;

          case 'COINCIDENT':
            if (c.geometryReferenceA.topologyType === 'FACE') {
              // Planar contact removes 3 DOF (1 translation, 2 tilt rotations)
              constrainedDOF += 3;
              freeDirs.tz = false;
              freeDirs.rx = false;
              freeDirs.ry = false;
            } else {
              // Point-point coincident removes 3 translation DOFs
              constrainedDOF += 3;
              freeDirs.tx = false;
              freeDirs.ty = false;
              freeDirs.tz = false;
            }
            break;

          case 'CONCENTRIC':
            // Removes 4 DOFs: 2 radial translations, 2 tilt rotations
            constrainedDOF += 4;
            freeDirs.tx = false;
            freeDirs.ty = false;
            freeDirs.rx = false;
            freeDirs.ry = false;
            break;

          case 'DISTANCE':
            // Locks 1 translational DOF
            constrainedDOF += 1;
            if (freeDirs.tz) freeDirs.tz = false;
            else if (freeDirs.tx) freeDirs.tx = false;
            else freeDirs.ty = false;
            break;

          case 'ANGLE':
            // Locks 1 rotational DOF
            constrainedDOF += 1;
            if (freeDirs.rz) freeDirs.rz = false;
            else if (freeDirs.ry) freeDirs.ry = false;
            else freeDirs.rx = false;
            break;

          case 'PARALLEL':
            // Locks 2 rotational DOFs
            constrainedDOF += 2;
            freeDirs.rx = false;
            freeDirs.ry = false;
            break;

          case 'PERPENDICULAR':
            // Locks 1 rotational DOF
            constrainedDOF += 1;
            freeDirs.rz = false;
            break;

          default:
            break;
        }
      }

      const remainingDOF = Math.max(0, 6 - constrainedDOF);
      const unconstrainedDirections: string[] = [];
      if (freeDirs.tx) unconstrainedDirections.push('tx');
      if (freeDirs.ty) unconstrainedDirections.push('ty');
      if (freeDirs.tz) unconstrainedDirections.push('tz');
      if (freeDirs.rx) unconstrainedDirections.push('rx');
      if (freeDirs.ry) unconstrainedDirections.push('ry');
      if (freeDirs.rz) unconstrainedDirections.push('rz');

      componentDOFs[comp.instanceId] = {
        initialDOF: 6,
        remainingDOF,
        constrainedDOF: Math.min(6, constrainedDOF),
        redundantDOF: componentRedundant,
        conflictingDOF: componentConflicting,
        unconstrainedDirections,
      };

      totalAssemblyDOF += remainingDOF;
    }

    return { componentDOFs, totalAssemblyDOF };
  }
}
