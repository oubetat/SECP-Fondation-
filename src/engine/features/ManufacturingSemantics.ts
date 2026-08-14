import { FeatureDefinition } from './FeatureTypes';

/**
 * PATCH-SECP-048-B — Manufacturing Semantics
 * Adds semantic engineering data to B-Rep features.
 */

export interface ManufacturingData {
  material?: string;
  surfaceFinish?: string; // Ra value
  toleranceClass?: 'FINE' | 'MEDIUM' | 'COARSE';
  isCriticalDimension: boolean;
  notes?: string;
}

export class ManufacturingSemanticsManager {
  private semanticMap: Map<string, ManufacturingData> = new Map();

  /**
   * Decorates a feature with manufacturing metadata
   */
  public tagFeature(featureId: string, data: ManufacturingData): void {
    this.semanticMap.set(featureId, data);
  }

  public getSemanticData(featureId: string): ManufacturingData | undefined {
    return this.semanticMap.get(featureId);
  }

  /**
   * Validates if a feature is "Manufacturable" based on its parameters and semantics
   */
  public checkManufacturability(feature: FeatureDefinition): { possible: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const data = this.getSemanticData(feature.featureId);

    if (feature.type === 'FILLET') {
      const radius = feature.parameters.radius || 0;
      if (radius < 0.5) {
        warnings.push('Small fillet radius may be difficult to machine precisely.');
      }
    }

    if (data?.toleranceClass === 'FINE' && !data.surfaceFinish) {
      warnings.push('Fine tolerance typically requires a specified surface finish.');
    }

    return {
      possible: warnings.length === 0,
      warnings
    };
  }
}
