import { PrescribedDisplacementInput } from './types';

export interface ConstraintValidationResult {
  isValid: boolean;
  conflictDetected: boolean;
  errors: string[];
  constrainedCount: number;
}

export class ConstraintManager {
  private constraints: PrescribedDisplacementInput[];

  constructor(constraints: PrescribedDisplacementInput[] = []) {
    this.constraints = constraints;
  }

  getConstraints(): PrescribedDisplacementInput[] {
    return [...this.constraints];
  }

  validate(nodeIds: Set<string>): ConstraintValidationResult {
    const errors: string[] = [];
    const seenMap = new Map<string, number>();
    let conflictDetected = false;

    for (const c of this.constraints) {
      if (!nodeIds.has(c.nodeId)) {
        errors.push(`Constraint references non-existent node ID: ${c.nodeId}`);
      }
      if (!Number.isFinite(c.value)) {
        errors.push(`Constraint on node ${c.nodeId} DOF ${c.dof} has non-finite value: ${c.value}`);
      }

      const key = `${c.nodeId}:${c.dof}`;
      if (seenMap.has(key)) {
        const existingVal = seenMap.get(key)!;
        if (Math.abs(existingVal - c.value) > 1e-12) {
          conflictDetected = true;
          errors.push(
            `Conflicting constraints on ${c.nodeId}:${c.dof} (${existingVal} vs ${c.value}). CONSTRAINT_CONFLICT.`
          );
        }
      } else {
        seenMap.set(key, c.value);
      }
    }

    return {
      isValid: errors.length === 0,
      conflictDetected,
      errors,
      constrainedCount: seenMap.size
    };
  }
}
