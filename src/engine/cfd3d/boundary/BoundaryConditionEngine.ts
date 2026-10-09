/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-245 — Boundary Condition Engine
 */

import { CfdMesh } from '../mesh/CfdMesh';
import { 
  BoundaryCondition, 
  BoundaryType, 
  BoundaryValidationResult 
} from './BoundaryConditionTypes';

/**
 * BoundaryConditionEngine: Manages the mapping between physical boundaries and numerical solvers.
 */
export class BoundaryConditionEngine {
  private conditions: Map<string, BoundaryCondition> = new Map();

  constructor(private mesh: CfdMesh) {}

  /**
   * Registers a boundary condition for a specific patch.
   */
  public setCondition(condition: BoundaryCondition): BoundaryValidationResult {
    const validation = this.validateCondition(condition);
    if (validation.isValid) {
      this.conditions.set(condition.patchId, condition);
    }
    return validation;
  }

  public getCondition(patchId: string): BoundaryCondition | undefined {
    return this.conditions.get(patchId);
  }

  /**
   * Validates the condition against physical and topological constraints.
   */
  private validateCondition(condition: BoundaryCondition): BoundaryValidationResult {
    const errors: string[] = [];
    
    // 1. Patch existence check
    const patch = Array.from(this.mesh.patches.values()).find(p => p.id === condition.patchId);
    if (!patch) {
      errors.push(`Boundary patch with ID ${condition.patchId} not found in mesh.`);
    }

    // 2. Value validation
    if (condition.type === BoundaryType.VELOCITY_INLET) {
      if (isNaN(condition.velocity.x) || isNaN(condition.velocity.y) || isNaN(condition.velocity.z)) {
        errors.push('Velocity values contain NaN.');
      }
    }

    if (condition.type === BoundaryType.PRESSURE_OUTLET) {
      if (isNaN(condition.pressure)) {
        errors.push('Pressure value is NaN.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Returns all faces associated with a specific boundary condition.
   */
  public getBoundaryFaces(condition: BoundaryCondition): string[] {
    const patch = Array.from(this.mesh.patches.values()).find(p => p.id === condition.patchId);
    return patch ? patch.faceIds : [];
  }
}
