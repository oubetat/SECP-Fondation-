/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Registry
 */

import { BoundaryPatch } from './BoundaryPatch';
import { BoundaryConditionIdentity, BoundaryFieldType } from './BoundaryConditionTypes';

export class BoundaryConditionRegistry {
  private readonly patchMap = new Map<string, BoundaryPatch>();
  private readonly conditionMap = new Map<string, BoundaryConditionIdentity>();

  public registerPatch(patch: BoundaryPatch): void {
    if (this.patchMap.has(patch.patchId)) {
      throw new Error(`Patch ID '${patch.patchId}' is already registered.`);
    }
    this.patchMap.set(patch.patchId, patch);
  }

  public registerCondition(condition: BoundaryConditionIdentity): void {
    if (this.conditionMap.has(condition.boundaryConditionId)) {
      throw new Error(`Boundary condition ID '${condition.boundaryConditionId}' is already registered.`);
    }
    this.conditionMap.set(condition.boundaryConditionId, condition);
  }

  public getPatch(patchId: string): BoundaryPatch | undefined {
    return this.patchMap.get(patchId);
  }

  public getCondition(conditionId: string): BoundaryConditionIdentity | undefined {
    return this.conditionMap.get(conditionId);
  }

  public getAllPatches(): BoundaryPatch[] {
    return Array.from(this.patchMap.values());
  }

  public getAllConditions(): BoundaryConditionIdentity[] {
    return Array.from(this.conditionMap.values());
  }

  public getConditionForPatch(patchId: string, fieldType: BoundaryFieldType): BoundaryConditionIdentity | undefined {
    for (const cond of this.conditionMap.values()) {
      if (cond.boundaryPatchId === patchId && cond.fieldType === fieldType) {
        return cond;
      }
    }
    return undefined;
  }

  public clear(): void {
    this.patchMap.clear();
    this.conditionMap.clear();
  }
}
