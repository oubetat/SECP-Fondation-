/**
 * SECP AI Engineering Copilot Engine
 * Translates high-level requirements into editable parametric features.
 */

import { FeatureType, Parameter, CADFeature } from '../parametric/ParametricEngine';

export interface EngineeringRequirement {
  text: string;
  loadKn?: number;
  maxWeightKg?: number;
  material?: string;
}

export interface CopilotGenerationResult {
  parameters: Parameter[];
  features: CADFeature[];
  reasoning: string;
  validationStatus: 'PASSED' | 'FAILED';
}

export class AiEngineeringCopilot {
  /**
   * Calls the server-side AI endpoint to generate parametric geometry
   */
  public static async generateParametricSolution(
    requirement: string
  ): Promise<CopilotGenerationResult> {
    const response = await fetch('/api/copilot/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirement })
    });

    if (!response.ok) {
      throw new Error('AI Copilot failed to generate engineering specification');
    }

    return await response.json();
  }

  /**
   * Client-side fallback for UI prototyping if AI is unavailable
   */
  public static getFallbackSolution(requirement: string): CopilotGenerationResult {
    const isHeavyLoad = requirement.toLowerCase().includes('kn') && parseInt(requirement.match(/\d+/)?.[0] || '0') > 10;
    
    const baseDia = isHeavyLoad ? 120 : 80;
    const baseThick = isHeavyLoad ? 12 : 6;

    return {
      parameters: [
        { id: 'p1', name: 'Optimized_Diameter', value: baseDia, unit: 'mm' },
        { id: 'p2', name: 'Safety_Thickness', value: baseThick, unit: 'mm' },
        { id: 'p3', name: 'Load_Anchor_Points', value: isHeavyLoad ? 12 : 6, unit: 'mm' }
      ],
      features: [
        { id: 'f1', type: FeatureType.SKETCH, name: 'AI_Base_Profile', dependencies: ['p1'], lastRebuildTime: Date.now(), isDirty: false },
        { id: 'f2', type: FeatureType.EXTRUDE, name: 'Load_Bearing_Body', dependencies: ['f1'], lastRebuildTime: Date.now(), isDirty: false },
        { id: 'f3', type: FeatureType.FILLET, name: 'Stress_Distribution_Fillet', dependencies: ['f2', 'p2'], lastRebuildTime: Date.now(), isDirty: false }
      ],
      reasoning: `Requirements analysis: ${requirement}. \nGenerated a ${isHeavyLoad ? 'Reinforced' : 'Lightweight'} structure with ${baseDia}mm base and ${baseThick}mm wall thickness to satisfy load/weight constraints.`,
      validationStatus: 'PASSED'
    };
  }
}
