/**
 * SECP CAD Kernel — GCS Constraint Validator
 * Phase 2 (PATCH-025)
 */

import { SketchModel } from '../SketchModel';
import { SketchConstraint } from './ConstraintModel';
import { SolverDiagnostic } from './SolverResult';

export interface ConstraintValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly SolverDiagnostic[];
}

export class ConstraintValidator {
  public static validate(
    model: SketchModel,
    constraints: readonly SketchConstraint[]
  ): ConstraintValidationResult {
    const diagnostics: SolverDiagnostic[] = [];
    const constraintIds = new Set<string>();
    const entityIds = new Set(model.entities.map(e => e.id.projectId));

    for (const constraint of constraints) {
      const cId = constraint.id.projectId;

      // 1. Uniqueness
      if (constraintIds.has(cId)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'DUPLICATE_CONSTRAINT_ID',
          constraintId: cId,
          message: `Duplicate constraint ID detected: ${cId}`
        });
      }
      constraintIds.add(cId);

      // 2. Sketch Ownership
      if (constraint.sketchId.projectId !== model.id.projectId) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'SKETCH_OWNERSHIP_MISMATCH',
          constraintId: cId,
          message: `Constraint ${cId} belongs to sketch ${constraint.sketchId.projectId}, but is applied to sketch ${model.id.projectId}`
        });
      }

      // 3. Referenced Entity Existence
      for (const ref of constraint.references) {
        const eId = ref.entityId.projectId;
        if (!entityIds.has(eId)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_CONSTRAINT_REFERENCE',
            constraintId: cId,
            message: `Constraint ${cId} references non-existent entity ${eId}`
          });
        }
      }

      // 4. Parameter Validity
      if (constraint.parameters.value !== undefined && !Number.isFinite(constraint.parameters.value)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'INVALID_PARAMETER_VALUE',
          constraintId: cId,
          message: `Constraint ${cId} has non-finite parameter value`
        });
      }

      // 5. Supported combination (Simplified for PATCH-025)
      const supportedTypes: string[] = [
        'COINCIDENT', 'POINT_ON_POINT', 'HORIZONTAL', 'VERTICAL', 
        'DISTANCE', 'FIX', 'RADIUS'
      ];
      if (!supportedTypes.includes(constraint.type)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'UNSUPPORTED_CONSTRAINT_TYPE',
          constraintId: cId,
          message: `Constraint type ${constraint.type} is not supported in this version`
        });
      }
    }

    return {
      valid: !diagnostics.some(d => d.severity === 'ERROR'),
      diagnostics
    };
  }
}
