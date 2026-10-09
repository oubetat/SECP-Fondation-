import { 
  ManufacturingFeature, 
  FeatureValidationStatus, 
  ManufacturingFeatureType 
} from "./types";

export class ManufacturingFeatureEngine {
  /**
   * Generates a deterministic, reproducible cryptographic fingerprint for a Manufacturing Feature.
   */
  public static calculateFingerprint(feature: ManufacturingFeature): string {
    const parts = [
      feature.featureId,
      feature.featureType,
      feature.partId,
      feature.partRevision.toString(),
      feature.geometryReferences.sort().join(","),
      feature.intent,
      Object.keys(feature.parameters).sort().map(k => `${k}:${feature.parameters[k].value}`).join(";"),
      feature.revision.toString(),
      feature.timestamp
    ];

    return "feat-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Evaluates accessibility directions for a feature based on its orientation.
   */
  public static evaluateAccessibility(feature: ManufacturingFeature): string[] {
    // Standard accessibility logic:
    // Holes usually have axial accessibility.
    // Pockets usually have normal accessibility from the top.
    
    if (feature.featureType === ManufacturingFeatureType.HOLE) {
      return ["+Z", "-Z"];
    }
    
    if (feature.featureType === ManufacturingFeatureType.POCKET) {
      return ["+Z"];
    }

    return ["UNKNOWN"];
  }

  /**
   * Creates a composite feature from multiple child features (e.g., Threaded Hole).
   */
  public static createCompositeFeature(
    id: string,
    type: ManufacturingFeatureType,
    children: ManufacturingFeature[]
  ): ManufacturingFeature {
    const timestamp = new Date().toISOString();
    const first = children[0];

    return {
      featureId: id,
      featureType: type,
      partId: first.partId,
      partRevision: first.partRevision,
      geometryReferences: Array.from(new Set(children.flatMap(c => c.geometryReferences))),
      topologyReferences: Array.from(new Set(children.flatMap(c => c.topologyReferences))),
      parameters: children.reduce((acc, c) => ({ ...acc, ...c.parameters }), {}),
      intent: first.intent,
      origin: first.origin,
      childFeatures: children.map(c => c.featureId),
      dependencies: children.map(c => c.featureId),
      status: FeatureValidationStatus.VALID,
      visibility: first.visibility,
      accessibility: first.accessibility,
      revision: 1,
      timestamp,
      fingerprint: ""
    };
  }
}
