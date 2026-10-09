import { FeatureDefinition, DesignHistory, FeatureParameter, FeatureType } from './FeatureTypes';

/**
 * PATCH-SECP-047-C — Feature History (Model Tree)
 * Manages the chronological sequence of modeling operations.
 * This is the "Source of Truth" for the parametric model.
 */

export class FeatureHistoryManager {
  private history: DesignHistory;

  constructor(modelId: string) {
    this.history = {
      modelId,
      features: [],
      parameters: [],
      revision: 0,
      lastRegenerated: new Date().toISOString()
    };

    // Add Root Feature
    this.addRootFeature();
  }

  private addRootFeature(): void {
    const root: FeatureDefinition = {
      featureId: 'root',
      type: 'ROOT',
      name: 'Origin',
      parameters: {},
      references: [],
      status: 'ACTIVE',
      suppressionState: 'ACTIVE',
      revision: 0,
      deterministicHash: 'root-hash'
    };
    this.history.features.push(root);
  }

  public addFeature(feature: FeatureDefinition): void {
    // Basic validation: ensure ID is unique
    if (this.history.features.some(f => f.featureId === feature.featureId)) {
      throw new Error(`Feature ID ${feature.featureId} already exists.`);
    }
    this.history.features.push(feature);
    this.history.revision++;
  }

  public getFeature(id: string): FeatureDefinition | undefined {
    return this.history.features.find(f => f.featureId === id);
  }

  public updateParameter(featureId: string, paramKey: string, newValue: any): void {
    const feature = this.getFeature(featureId);
    if (!feature) throw new Error(`Feature ${featureId} not found.`);
    
    feature.parameters[paramKey] = newValue;
    feature.revision++;
    this.history.revision++;
  }

  public setSuppression(featureId: string, suppressed: boolean): void {
    const feature = this.getFeature(featureId);
    if (!feature) throw new Error(`Feature ${featureId} not found.`);
    
    feature.suppressionState = suppressed ? 'SUPPRESSED' : 'ACTIVE';
    feature.status = suppressed ? 'SUPPRESSED' : 'ACTIVE';
    this.history.revision++;
  }

  public getHistory(): DesignHistory {
    return { ...this.history };
  }

  public getFeatures(): FeatureDefinition[] {
    return [...this.history.features];
  }

  /**
   * Returns features in chronological order
   */
  public getOrderedFeatures(): FeatureDefinition[] {
    return [...this.history.features]; // Already stored chronologically by addition order
  }
}
