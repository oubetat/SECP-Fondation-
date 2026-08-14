/**
 * PATCH-SECP-045 — Assembly Constraint Resolver
 * Normalization layer converting raw CAD Assembly constraints into mathematical solver-ready representations.
 * Explicitly maps geometric entities, mathematical residual equations, and DOF contributions.
 * Strictly returns 'UNSUPPORTED' for invalid or non-executable constraint definitions.
 */

import { AssemblyConstraint, AssemblyConstraintType } from './AssemblyConstraintTypes';
import { NormalizedConstraint } from './KinematicTypes';
import { Tolerance } from '../geometry/GeometryTolerance';

export class AssemblyConstraintResolver {
  private static readonly SUPPORTED_CONSTRAINTS: Set<AssemblyConstraintType> = new Set([
    'MATE',
    'ALIGN',
    'CONCENTRIC',
    'DISTANCE',
    'ANGLE',
    'PERPENDICULAR',
    'PARALLEL',
    'LOCK'
  ]);

  /**
   * Normalizes a raw AssemblyConstraint into a strongly typed, mathematically rigorous NormalizedConstraint
   */
  public static normalize(constraint: AssemblyConstraint): NormalizedConstraint {
    if (!constraint || !constraint.constraintId) {
      return {
        constraintId: constraint?.constraintId || 'invalid-id',
        sourceComponentId: constraint?.componentA || '',
        targetComponentId: constraint?.componentB || '',
        type: constraint?.type || ('UNKNOWN' as any),
        geometricReferences: [],
        mathematicalRelation: 'INVALID_EMPTY_CONSTRAINT',
        dofContribution: 0,
        tolerance: Tolerance.VALIDATION,
        status: 'INVALID'
      };
    }

    const geoRefs = [constraint.geometryRefA, constraint.geometryRefB].filter(Boolean);

    if (!this.SUPPORTED_CONSTRAINTS.has(constraint.type)) {
      return {
        constraintId: constraint.constraintId,
        sourceComponentId: constraint.componentA,
        targetComponentId: constraint.componentB,
        type: constraint.type,
        geometricReferences: geoRefs,
        mathematicalRelation: `UNSUPPORTED_RELATION(${constraint.type})`,
        dofContribution: 0,
        tolerance: Tolerance.VALIDATION,
        status: 'UNSUPPORTED'
      };
    }

    const offset = constraint.parameters?.offsetMm ?? 0;
    const angle = constraint.parameters?.angleDeg ?? 0;

    switch (constraint.type) {
      case 'MATE':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'dot(n_A, p_A - p_B) = 0 AND dot(n_A, n_B) = -1',
          dofContribution: 3, // Removes 1 translation (normal) and 2 rotations (out of plane)
          tolerance: Tolerance.MODELING,
          status: 'READY',
          offsetValue: offset
        };

      case 'ALIGN':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'cross(axis_A, axis_B) = 0',
          dofContribution: 2, // Removes 2 rotational tilt DOFs
          tolerance: Tolerance.ANGULAR,
          status: 'READY'
        };

      case 'CONCENTRIC':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'cross(axis_A, axis_B) = 0 AND cross(axis_A, p_B - p_A) = 0',
          dofContribution: 4, // Removes 2 translations (radial) and 2 rotations (tilt)
          tolerance: Tolerance.MODELING,
          status: 'READY'
        };

      case 'DISTANCE':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: '||p_A - p_B|| - d = 0 OR dot(n_A, p_B - p_A) - d = 0',
          dofContribution: 1, // Removes 1 distance DOF
          tolerance: Tolerance.MODELING,
          status: 'READY',
          offsetValue: offset
        };

      case 'ANGLE':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'acos(dot(n_A, n_B)) - theta = 0',
          dofContribution: 1, // Removes 1 rotational DOF
          tolerance: Tolerance.ANGULAR,
          status: 'READY',
          offsetValue: angle
        };

      case 'PARALLEL':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'cross(n_A, n_B) = 0',
          dofContribution: 2, // Removes 2 rotational tilt DOFs
          tolerance: Tolerance.ANGULAR,
          status: 'READY'
        };

      case 'PERPENDICULAR':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'dot(n_A, n_B) = 0',
          dofContribution: 1, // Removes 1 rotational DOF
          tolerance: Tolerance.ANGULAR,
          status: 'READY'
        };

      case 'LOCK':
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'T_relative = constant (6 DOF locked)',
          dofContribution: 6, // Removes all 6 DOFs
          tolerance: Tolerance.VALIDATION,
          status: 'READY'
        };

      default:
        return {
          constraintId: constraint.constraintId,
          sourceComponentId: constraint.componentA,
          targetComponentId: constraint.componentB,
          type: constraint.type,
          geometricReferences: geoRefs,
          mathematicalRelation: 'GENERIC_CONSTRAINT',
          dofContribution: 1,
          tolerance: Tolerance.VALIDATION,
          status: 'UNSUPPORTED'
        };
    }
  }

  /**
   * Normalizes a batch of Assembly Constraints
   */
  public static normalizeAll(constraints: AssemblyConstraint[]): NormalizedConstraint[] {
    return constraints.map(c => this.normalize(c));
  }
}
