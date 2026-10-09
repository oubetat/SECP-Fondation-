import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ConfigurationApplicability } from './types';

export class ConfigurationApplicabilityEngine {
  private registry: ConfigurationRegistry;

  constructor(registry: ConfigurationRegistry) {
    this.registry = registry;
  }

  /**
   * Validates correctness and semantic integrity of an applicability range.
   * Enforces zero overlapping, non-negative ranges, and resolves range correctness.
   */
  public validateApplicability(app: ConfigurationApplicability): void {
    if (app.serialNumberMin !== undefined && app.serialNumberMax !== undefined) {
      if (app.serialNumberMin < 0 || app.serialNumberMax < 0) {
        throw new Error(`INVALID_APPLICABILITY_RANGE: Serial numbers cannot be negative (${app.serialNumberMin} to ${app.serialNumberMax}).`);
      }
      if (app.serialNumberMin > app.serialNumberMax) {
        throw new Error(`INVALID_APPLICABILITY_RANGE: Min serial number '${app.serialNumberMin}' cannot exceed max '${app.serialNumberMax}'.`);
      }
    }
  }

  /**
   * Evaluates if two applicability profiles have overlapping and contradictory serial bounds.
   */
  public detectApplicabilityOverlap(appA: ConfigurationApplicability, appB: ConfigurationApplicability): boolean {
    if (appA.targetId === appB.targetId) return false; // Same target

    // Check serial range overlap
    if (
      appA.serialNumberMin !== undefined &&
      appA.serialNumberMax !== undefined &&
      appB.serialNumberMin !== undefined &&
      appB.serialNumberMax !== undefined
    ) {
      const isOverlap = appA.serialNumberMin <= appB.serialNumberMax && appB.serialNumberMin <= appA.serialNumberMax;
      
      // If they overlap in serial range and have the same mission profile, it's contradictory
      if (isOverlap && appA.missionProfile === appB.missionProfile) {
        return true;
      }
    }

    return false;
  }

  /**
   * Asserts that no overlapping contradictory effectivities exist in the active registry.
   */
  public assertGlobalApplicabilityIntegrity(): void {
    const apps = Array.from(this.registry.applicabilities.values());

    for (let i = 0; i < apps.length; i++) {
      this.validateApplicability(apps[i]);
      for (let j = i + 1; j < apps.length; j++) {
        if (this.detectApplicabilityOverlap(apps[i], apps[j])) {
          throw new Error(`CONTRADICTORY_APPLICABILITY_OVERLAP: Applicability profile '${apps[i].applicabilityId}' conflicts with profile '${apps[j].applicabilityId}' on overlapping serial bounds and mission profiles.`);
        }
      }
    }
  }
}
