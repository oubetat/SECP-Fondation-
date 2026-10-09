import { AssemblyConstraint, AssemblyComponentPose } from './AssemblyConstraintModel';
import { validateRotationMatrix, AssemblyConstraintEvaluator } from './AssemblyConstraint';

export class AssemblyConstraintValidator {
  /**
   * Validates all component transforms, specifically checking rotation orthogonality and determinants.
   * NaN or Infinity values will instantly invalidate the pose.
   */
  public static validatePoses(
    components: AssemblyComponentPose[],
    tolerance: number = 1e-4
  ): { valid: boolean; reason?: string } {
    for (const comp of components) {
      const R = [
        [comp.transform[0][0], comp.transform[0][1], comp.transform[0][2]],
        [comp.transform[1][0], comp.transform[1][1], comp.transform[1][2]],
        [comp.transform[2][0], comp.transform[2][1], comp.transform[2][2]],
      ];

      // 1. Check translation coordinate limits
      const t = comp.position;
      if (
        isNaN(t.x) || !isFinite(t.x) ||
        isNaN(t.y) || !isFinite(t.y) ||
        isNaN(t.z) || !isFinite(t.z)
      ) {
        return { valid: false, reason: `Component ${comp.instanceId} translation contains NaN or Infinity` };
      }

      // 2. Validate Euler orientation
      const rot = comp.orientation;
      if (
        isNaN(rot.x) || !isFinite(rot.x) ||
        isNaN(rot.y) || !isFinite(rot.y) ||
        isNaN(rot.z) || !isFinite(rot.z)
      ) {
        return { valid: false, reason: `Component ${comp.instanceId} orientation contains NaN or Infinity` };
      }

      // 3. Validate rotation matrix
      const rotValidation = validateRotationMatrix(R, tolerance);
      if (!rotValidation.valid) {
        return { valid: false, reason: `Component ${comp.instanceId} rotation matrix is invalid: ${rotValidation.reason}` };
      }
    }

    return { valid: true };
  }

  /**
   * Checks for invalid, dangling, or topological references
   */
  public static validateGeometryReferences(
    constraints: AssemblyConstraint[],
    componentIds: Set<string>
  ): { valid: boolean; invalidConstraintId?: string; reason?: string } {
    for (const c of constraints) {
      if (c.suppressed || !c.enabled) continue;

      if (!componentIds.has(c.componentA)) {
        return {
          valid: false,
          invalidConstraintId: c.constraintId,
          reason: `GeometryReferenceA references missing component: ${c.componentA}`,
        };
      }
      if (!componentIds.has(c.componentB)) {
        return {
          valid: false,
          invalidConstraintId: c.constraintId,
          reason: `GeometryReferenceB references missing component: ${c.componentB}`,
        };
      }

      const refA = c.geometryReferenceA;
      const refB = c.geometryReferenceB;

      if (!refA || !refB) {
        return {
          valid: false,
          invalidConstraintId: c.constraintId,
          reason: `Constraint ${c.constraintId} is missing geometry references.`,
        };
      }

      if (refA.topologyIndex < 0) {
        return {
          valid: false,
          invalidConstraintId: c.constraintId,
          reason: `GeometryReferenceA has invalid topology index: ${refA.topologyIndex}`,
        };
      }
      if (refB.topologyIndex < 0) {
        return {
          valid: false,
          invalidConstraintId: c.constraintId,
          reason: `GeometryReferenceB has invalid topology index: ${refB.topologyIndex}`,
        };
      }

      // Verify cached normals/points are not NaN or Infinity
      if (refA.cachedNormal) {
        const n = refA.cachedNormal;
        if (isNaN(n.x) || !isFinite(n.x) || isNaN(n.y) || !isFinite(n.y) || isNaN(n.z) || !isFinite(n.z)) {
          return {
            valid: false,
            invalidConstraintId: c.constraintId,
            reason: 'GeometryReferenceA cached normal has NaN or non-finite values',
          };
        }
      }

      if (refB.cachedNormal) {
        const n = refB.cachedNormal;
        if (isNaN(n.x) || !isFinite(n.x) || isNaN(n.y) || !isFinite(n.y) || isNaN(n.z) || !isFinite(n.z)) {
          return {
            valid: false,
            invalidConstraintId: c.constraintId,
            reason: 'GeometryReferenceB cached normal has NaN or non-finite values',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Evaluates each active constraint's residual and records verification details
   */
  public static verifyConstraints(
    constraints: AssemblyConstraint[],
    poses: Record<string, AssemblyComponentPose>
  ): Array<{
    constraintId: string;
    residual: number;
    tolerance: number;
    satisfied: boolean;
    diagnostic?: string;
  }> {
    const results: any[] = [];

    for (const c of constraints) {
      if (c.suppressed || !c.enabled) {
        results.push({
          constraintId: c.constraintId,
          residual: 0,
          tolerance: c.tolerance,
          satisfied: true,
          diagnostic: 'Suppressed / Disabled constraint',
        });
        continue;
      }

      const poseA = poses[c.componentA];
      const poseB = poses[c.componentB];

      if (!poseA || !poseB) {
        results.push({
          constraintId: c.constraintId,
          residual: NaN,
          tolerance: c.tolerance,
          satisfied: false,
          diagnostic: 'Missing associated component poses',
        });
        continue;
      }

      const residual = AssemblyConstraintEvaluator.computeResidual(c, poseA, poseB);

      if (isNaN(residual)) {
        results.push({
          constraintId: c.constraintId,
          residual: NaN,
          tolerance: c.tolerance,
          satisfied: false,
          diagnostic: 'Constraint evaluated to NaN residual. Numerical or reference anomaly.',
        });
        continue;
      }

      const satisfied = residual <= c.tolerance;

      results.push({
        constraintId: c.constraintId,
        residual,
        tolerance: c.tolerance,
        satisfied,
        diagnostic: satisfied
          ? `Satisfied. Residual: ${residual.toExponential(4)}`
          : `Violated. Residual: ${residual.toExponential(4)} (Tolerance: ${c.tolerance.toExponential(4)})`,
      });
    }

    return results;
  }
}
