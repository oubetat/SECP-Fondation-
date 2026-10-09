import { 
  ManufacturingFeature, 
  FeatureValidationStatus, 
  ManufacturingFeatureType 
} from "./types";

export class ManufacturingFeatureValidator {
  /**
   * Validates a feature against its B-Rep geometry and topological constraints.
   */
  public static validateFeature(feature: ManufacturingFeature, bRepModel: any): { 
    status: FeatureValidationStatus; 
    details?: string;
  } {
    // 1. Check Geometry References
    if (!feature.geometryReferences || feature.geometryReferences.length === 0) {
      return { status: FeatureValidationStatus.INVALID, details: "Feature missing geometry references" };
    }

    // 2. Feature-Specific Validation
    switch (feature.featureType) {
      case ManufacturingFeatureType.HOLE:
        return this.validateHole(feature);
      case ManufacturingFeatureType.POCKET:
        return this.validatePocket(feature);
      default:
        return { status: FeatureValidationStatus.UNRESOLVED, details: "Feature type validation not yet implemented" };
    }
  }

  private static validateHole(feature: ManufacturingFeature): { status: FeatureValidationStatus; details?: string } {
    const diameter = feature.parameters["diameter"];
    const depth = feature.parameters["depth"];

    if (!diameter || (diameter.value as number) <= 0) {
      return { status: FeatureValidationStatus.INVALID, details: "Invalid hole diameter (<= 0)" };
    }

    if (!depth || (depth.value as number) <= 0) {
      return { status: FeatureValidationStatus.INVALID, details: "Invalid hole depth (<= 0)" };
    }

    // Topological check: A hole must be cylindrical
    // (In a real system, we would verify the B-Rep entity type here)

    return { status: FeatureValidationStatus.VALID };
  }

  private static validatePocket(feature: ManufacturingFeature): { status: FeatureValidationStatus; details?: string } {
    const depth = feature.parameters["depth"];

    if (!depth || (depth.value as number) < 0) {
      return { status: FeatureValidationStatus.INVALID, details: "Invalid pocket depth (< 0)" };
    }

    return { status: FeatureValidationStatus.VALID };
  }

  /**
   * Checks for circular dependencies in the feature graph.
   */
  public static checkCyclicDependencies(features: ManufacturingFeature[]): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const hasCycle = (id: string): boolean => {
      if (stack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      stack.add(id);

      const feature = features.find(f => f.featureId === id);
      if (feature && feature.dependencies) {
        for (const dep of feature.dependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      stack.delete(id);
      return false;
    };

    for (const f of features) {
      if (hasCycle(f.featureId)) return true;
    }

    return false;
  }
}
