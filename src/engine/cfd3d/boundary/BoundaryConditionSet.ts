/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Set
 */

import { BoundaryPatch } from './BoundaryPatch';
import { BoundaryConditionIdentity, BoundaryFieldType } from './BoundaryConditionTypes';

export class BoundaryConditionSet {
  public readonly patches: readonly BoundaryPatch[];
  public readonly conditions: readonly BoundaryConditionIdentity[];

  constructor(
    patches: readonly BoundaryPatch[] = [],
    conditions: readonly BoundaryConditionIdentity[] = []
  ) {
    this.patches = Object.freeze([...patches]);
    this.conditions = Object.freeze([...conditions]);
  }

  public getPatch(patchId: string): BoundaryPatch | undefined {
    return this.patches.find(p => p.patchId === patchId);
  }

  public getConditionForPatch(patchId: string, fieldType: BoundaryFieldType): BoundaryConditionIdentity | undefined {
    return this.conditions.find(c => c.boundaryPatchId === patchId && c.fieldType === fieldType);
  }

  public getConditionsForPatch(patchId: string): BoundaryConditionIdentity[] {
    return this.conditions.filter(c => c.boundaryPatchId === patchId);
  }
}
