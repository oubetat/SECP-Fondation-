/**
 * PATCH-SECP-072: Assembly Validation Engine
 * Runs geometric and constraint sanity checks on mechanical mate systems.
 * Detects over-constrained configurations, redundant mates, or impossible joints.
 */

import { AssemblyStructure } from './AssemblyTopologyTypes';
import { KinematicConstraintEngine } from './KinematicConstraintEngine';

export interface AssemblyValidationReport {
  isValid: boolean;
  dofCount: number;
  isOverConstrained: boolean;
  issues: string[];
}

export class AssemblyValidationEngine {
  public static validateAssembly(assembly: AssemblyStructure): AssemblyValidationReport {
    const issues: string[] = [];
    const dof = KinematicConstraintEngine.calculateDOF(assembly);

    // 1. Check for floating components (under-constrained warning)
    const instancesCount = Object.keys(assembly.instances).length;
    if (instancesCount > 1 && dof === instancesCount * 6) {
      issues.push('Assembly has floating components with zero active mates.');
    }

    // 2. Over-constrained state checks
    const activeConstraints = assembly.mates.length + assembly.joints.length;
    const initialDOF = instancesCount * 6;
    const isOverConstrained = activeConstraints > initialDOF;
    if (isOverConstrained) {
      issues.push('Assembly constraint system is over-constrained (redundant or conflicting mates).');
    }

    // 3. Invalid mate references
    assembly.mates.forEach(mate => {
      const parentA = assembly.instances[mate.primaryInstanceId];
      const parentB = assembly.instances[mate.secondaryInstanceId];
      if (!parentA || !parentB) {
        issues.push(`Mate ${mate.mateId} references missing component instances.`);
      }
    });

    const isValid = issues.length === 0 || !isOverConstrained;

    return {
      isValid,
      dofCount: dof,
      isOverConstrained,
      issues
    };
  }
}
