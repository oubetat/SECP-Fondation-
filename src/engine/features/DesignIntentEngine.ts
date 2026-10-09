import { FeatureDefinition } from './FeatureTypes';

/**
 * PATCH-SECP-048-A — Design Intent Graph
 * Tracks the "Why" behind the geometry.
 * Example: "Hole_1 must always be concentric to Face_2".
 */

export type IntentType = 
  | 'CONCENTRICITY' 
  | 'COINCIDENCE' 
  | 'MINIMUM_WALL_THICKNESS' 
  | 'SYMMETRY' 
  | 'MANUFACTURING_LIMIT';

export interface DesignIntent {
  intentId: string;
  type: IntentType;
  description: string;
  sourceFeatureIds: string[];
  targetTopologyReferences: any[];
  parameters: Record<string, any>;
  isMandatory: boolean;
}

export class DesignIntentEngine {
  private intents: Map<string, DesignIntent> = new Map();

  public addIntent(intent: DesignIntent): void {
    this.intents.set(intent.intentId, intent);
  }

  /**
   * Validates that the current design history satisfies all intents
   */
  public validateIntents(features: FeatureDefinition[]): { isValid: boolean; failures: string[] } {
    const failures: string[] = [];
    
    for (const intent of this.intents.values()) {
      // Logic to verify intent against features and parameters
      // For 048-A, we implement basic rule checking
      if (intent.type === 'MINIMUM_WALL_THICKNESS') {
        const minThickness = intent.parameters.min || 1.0;
        // Check if any extrusion or shell feature violates this
        for (const f of features) {
          if (f.type === 'EXTRUSION' && (f.parameters.thickness || 10) < minThickness) {
            failures.push(`Intent ${intent.intentId} violated: Feature ${f.featureId} thickness < ${minThickness}`);
          }
        }
      }
    }

    return {
      isValid: failures.length === 0,
      failures
    };
  }

  public getIntents(): DesignIntent[] {
    return Array.from(this.intents.values());
  }
}
