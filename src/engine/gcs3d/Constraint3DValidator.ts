/**
 * SECP CAD Kernel — GCS 3D Constraint & Geometry Validator
 * Phase 2 (PATCH-026)
 */

import { Model3D } from './Constraint3DTypes';
import { Constraint3D } from './Constraint3DModel';
import { Constraint3DDiagnostic } from './Constraint3DSolverDiagnostics';
import { GeometricTolerance } from '../cad-kernel/predicates/GeometricTolerance';

export interface Constraint3DValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly Constraint3DDiagnostic[];
}

export class Constraint3DValidator {
  /**
   * Performs deep verification of model ownership, entity existence, parameter finiteness,
   * non-zero/non-degenerate vector norms, non-negative radii, and duplicate IDs.
   */
  public static validate(
    model: Model3D,
    constraints: readonly Constraint3D[]
  ): Constraint3DValidationResult {
    const diagnostics: Constraint3DDiagnostic[] = [];
    const constraintIds = new Set<string>();
    const entityIds = new Set(model.entities.map(e => e.id.identityId));

    // 1. Validate Constraint Structures
    for (const constraint of constraints) {
      const cId = constraint.id.identityId;

      // Duplicate constraint IDs
      if (constraintIds.has(cId)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'DUPLICATE_CONSTRAINT_ID',
          constraintId: cId,
          message: `Duplicate constraint ID detected: ${cId}`,
        });
      }
      constraintIds.add(cId);

      // Cross-model reference check
      if (constraint.modelId.identityId !== model.id.identityId) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'CROSS_MODEL_REFERENCE',
          constraintId: cId,
          message: `Constraint references model ${constraint.modelId.identityId}, but is being solved on model ${model.id.identityId}`,
        });
      }

      // Entity existence
      for (const ref of constraint.references) {
        const eId = ref.entityId.identityId;
        if (!entityIds.has(eId)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'MISSING_ENTITY_REFERENCE',
            constraintId: cId,
            message: `Constraint references non-existent entity: ${eId}`,
          });
        }
      }

      // Non-finite parameters in constraint parameters
      if (constraint.parameters.value !== undefined && !Number.isFinite(constraint.parameters.value)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'NON_FINITE_PARAMETER',
          constraintId: cId,
          message: `Constraint parameter value is not a finite real number`,
        });
      }
    }

    // 2. Validate Geometry Entities
    for (const entity of model.entities) {
      const id = entity.id.identityId;
      const geom = entity.geometry;

      if (geom.type === 'POINT_3D') {
        const d = geom.data;
        if (!Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.z)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Entity ${id} contains non-finite point coordinate values`,
          });
        }
      } else if (geom.type === 'LINE_3D' || geom.type === 'AXIS_3D') {
        const d = geom.data;
        if (!Number.isFinite(d.origin.x) || !Number.isFinite(d.origin.y) || !Number.isFinite(d.origin.z) ||
            !Number.isFinite(d.direction.x) || !Number.isFinite(d.direction.y) || !Number.isFinite(d.direction.z)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Entity ${id} contains non-finite origin or direction coordinates`,
          });
        }

        const lenSq = d.direction.x ** 2 + d.direction.y ** 2 + d.direction.z ** 2;
        if (lenSq <= GeometricTolerance.DEFAULT.absoluteLength * GeometricTolerance.DEFAULT.absoluteLength) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'ZERO_DIRECTION_VECTOR',
            message: `Entity ${id} direction vector length is zero or within absolute tolerance limit`,
          });
        }
      } else if (geom.type === 'PLANE') {
        const d = geom.data;
        if (!Number.isFinite(d.origin.x) || !Number.isFinite(d.origin.y) || !Number.isFinite(d.origin.z) ||
            !Number.isFinite(d.normal.x) || !Number.isFinite(d.normal.y) || !Number.isFinite(d.normal.z)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Plane ${id} contains non-finite coordinate values`,
          });
        }

        const lenSq = d.normal.x ** 2 + d.normal.y ** 2 + d.normal.z ** 2;
        if (lenSq <= GeometricTolerance.DEFAULT.absoluteLength * GeometricTolerance.DEFAULT.absoluteLength) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'ZERO_NORMAL_VECTOR',
            message: `Plane ${id} normal vector length is zero or within absolute tolerance limit`,
          });
        }
      } else if (geom.type === 'CIRCLE_3D') {
        const d = geom.data;
        if (!Number.isFinite(d.center.x) || !Number.isFinite(d.normal.x) || !Number.isFinite(d.radius)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Circle ${id} contains non-finite parameters`,
          });
        }
        if (d.radius < 0) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NEGATIVE_RADIUS',
            message: `Circle ${id} radius must be non-negative (got ${d.radius})`,
          });
        }
      } else if (geom.type === 'CYLINDER_AXIS') {
        const d = geom.data;
        if (!Number.isFinite(d.origin.x) || !Number.isFinite(d.direction.x) || !Number.isFinite(d.radius)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Cylinder axis ${id} contains non-finite parameters`,
          });
        }
        if (d.radius < 0) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NEGATIVE_RADIUS',
            message: `Cylinder ${id} radius must be non-negative (got ${d.radius})`,
          });
        }
      } else if (geom.type === 'SPHERE') {
        const d = geom.data;
        if (!Number.isFinite(d.center.x) || !Number.isFinite(d.radius)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NON_FINITE_PARAMETER',
            message: `Sphere ${id} contains non-finite parameters`,
          });
        }
        if (d.radius < 0) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'NEGATIVE_RADIUS',
            message: `Sphere ${id} radius must be non-negative (got ${d.radius})`,
          });
        }
      }
    }

    return {
      valid: !diagnostics.some(d => d.severity === 'ERROR'),
      diagnostics,
    };
  }
}
