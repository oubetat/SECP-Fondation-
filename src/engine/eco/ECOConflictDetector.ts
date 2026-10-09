import { EngineeringChangeOrder } from './types';

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: string[];
}

export class ECOConflictDetector {

  public static detectConflicts(
    targetEco: EngineeringChangeOrder,
    existingEcos: EngineeringChangeOrder[]
  ): ConflictResult {
    const conflicts: string[] = [];

    for (const otherEco of existingEcos) {
      if (otherEco.ecoId === targetEco.ecoId) continue;
      if (otherEco.status === 'REJECTED' || otherEco.status === 'CANCELLED') continue;

      // 1. Check overlapping affected entities
      const overlappingEntities = targetEco.affectedEntityIds.filter(id => 
        otherEco.affectedEntityIds.includes(id)
      );

      if (overlappingEntities.length > 0) {
        // Check effectivity overlap
        if (this.hasEffectivityOverlap(targetEco.targetEffectivity, otherEco.targetEffectivity)) {
          conflicts.push(`EFFECTIVITY_CONFLICT: ECO ${targetEco.ecoNumber} conflicts with ECO ${otherEco.ecoNumber} on entities [${overlappingEntities.join(', ')}] with overlapping effectivity.`);
        }
      }
    }

    // 2. Check dependency cycles
    if (this.hasDependencyCycle(targetEco, existingEcos)) {
      conflicts.push(`CYCLE_DETECTED: ECO ${targetEco.ecoNumber} creates a circular dependency chain.`);
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  private static hasEffectivityOverlap(effA: any, effB: any): boolean {
    if (!effA || !effB) return false;
    if (effA.configuration && effB.configuration && effA.configuration === effB.configuration) {
      return true;
    }
    if (effA.effectiveDate && effB.effectiveDate && effA.effectiveDate === effB.effectiveDate) {
      return true;
    }
    if (effA.serialRange && effB.serialRange && effA.serialRange === effB.serialRange) {
      return true;
    }
    return false;
  }

  private static hasDependencyCycle(
    targetEco: EngineeringChangeOrder,
    allEcos: EngineeringChangeOrder[]
  ): boolean {
    const ecoMap = new Map<string, EngineeringChangeOrder>();
    for (const eco of allEcos) {
      ecoMap.set(eco.ecoId, eco);
    }
    ecoMap.set(targetEco.ecoId, targetEco);

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (currId: string): boolean => {
      visited.add(currId);
      stack.add(currId);

      const eco = ecoMap.get(currId);
      if (eco && eco.dependsOnEcoIds) {
        for (const depId of eco.dependsOnEcoIds) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (stack.has(depId)) {
            return true;
          }
        }
      }

      stack.delete(currId);
      return false;
    };

    return dfs(targetEco.ecoId);
  }
}
