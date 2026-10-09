import { 
  ToolDefinition, 
  ToolAssembly, 
  ToolSelectionResult, 
  ToolSelectionVerdict, 
  ManufacturingToolType, 
  ToolOperationCompatibilityType 
} from "./types";
import { ManufacturingFeature, ManufacturingFeatureType } from "../features/types";

export class ToolSelectionEngine {
  /**
   * Search and filter tools inside a library based on constraints.
   */
  public static filterTools(
    tools: ToolDefinition[],
    filters: {
      toolType?: ManufacturingToolType;
      material?: string;
      maxDiameter?: number;
      minDiameter?: number;
    }
  ): ToolDefinition[] {
    return tools.filter(tool => {
      if (filters.toolType && tool.toolType !== filters.toolType) return false;
      if (filters.material && tool.material !== filters.material) return false;
      if (filters.maxDiameter && tool.geometry.cuttingDiameter > filters.maxDiameter) return false;
      if (filters.minDiameter && tool.geometry.cuttingDiameter < filters.minDiameter) return false;
      return true;
    });
  }

  /**
   * Finds and ranks candidate tools for a given manufacturing feature and workpiece material.
   */
  public static selectToolsForFeature(
    feature: ManufacturingFeature,
    tools: ToolDefinition[],
    assemblies: ToolAssembly[],
    workpieceMaterialId: string
  ): ToolSelectionResult[] {
    const results: ToolSelectionResult[] = [];

    // Map feature type to required tool type
    let requiredToolType: ManufacturingToolType = ManufacturingToolType.UNKNOWN;
    if (feature.featureType === ManufacturingFeatureType.HOLE) {
      requiredToolType = ManufacturingToolType.DRILL;
    } else if (feature.featureType === ManufacturingFeatureType.POCKET) {
      requiredToolType = ManufacturingToolType.END_MILL;
    } else if (feature.featureType === ManufacturingFeatureType.SLOT) {
      requiredToolType = ManufacturingToolType.END_MILL;
    } else if (feature.featureType === ManufacturingFeatureType.CHAMFER) {
      requiredToolType = ManufacturingToolType.CHAMFER_MILL;
    }

    const candidateTools = tools.filter(t => t.toolType === requiredToolType || requiredToolType === ManufacturingToolType.UNKNOWN);

    for (const tool of candidateTools) {
      const associatedAssembly = assemblies.find(a => a.toolId === tool.toolId);

      const constraintsSatisfied: string[] = [];
      const constraintsFailed: string[] = [];
      const tradeoffs: string[] = [];

      let verdict = ToolSelectionVerdict.ELIGIBLE;
      let score = 50; // base score out of 100

      // Constraint 1: Check feature dimensional bounds (diameter check)
      const requestedDiameter = feature.parameters["diameter"]?.value as number;
      if (requestedDiameter !== undefined) {
        if (tool.geometry.cuttingDiameter === requestedDiameter) {
          constraintsSatisfied.push(`Perfect diameter match (${tool.geometry.cuttingDiameter}mm)`);
          score += 20;
        } else if (tool.geometry.cuttingDiameter < requestedDiameter) {
          constraintsSatisfied.push(`Tool diameter (${tool.geometry.cuttingDiameter}mm) is smaller than feature diameter (${requestedDiameter}mm), can interpolate`);
          tradeoffs.push("Requires spiral interpolation path which increases machining time");
          score += 5;
        } else {
          constraintsFailed.push(`Tool diameter (${tool.geometry.cuttingDiameter}mm) exceeds feature diameter (${requestedDiameter}mm)`);
          verdict = ToolSelectionVerdict.INELIGIBLE;
          score = 0;
        }
      }

      // Constraint 2: Check Tool Reach (Depth check)
      const requestedDepth = feature.parameters["depth"]?.value as number;
      if (requestedDepth !== undefined) {
        if (tool.geometry.cuttingLength >= requestedDepth) {
          constraintsSatisfied.push(`Flute cutting length (${tool.geometry.cuttingLength}mm) covers feature depth (${requestedDepth}mm)`);
          score += 10;
        } else if (associatedAssembly && associatedAssembly.effectiveReach >= requestedDepth) {
          constraintsSatisfied.push(`Assembly effective reach (${associatedAssembly.effectiveReach}mm) covers depth via shank/neck relief`);
          tradeoffs.push("Risk of neck rub or chip evacuation issues for deep cuts");
          verdict = ToolSelectionVerdict.CONDITIONALLY_ELIGIBLE;
          score += 2;
        } else {
          constraintsFailed.push(`Insufficient cutting length (${tool.geometry.cuttingLength}mm) and assembly reach for feature depth (${requestedDepth}mm)`);
          verdict = ToolSelectionVerdict.INELIGIBLE;
          score = 0;
        }
      }

      // Constraint 3: Check material specific cutting rules compatibility
      const hasMaterialRule = tool.materialsCuttingRules.some(r => r.materialId === workpieceMaterialId);
      if (hasMaterialRule) {
        constraintsSatisfied.push(`Validated cutting parameters exist for workpiece material '${workpieceMaterialId}'`);
        score += 15;
      } else {
        tradeoffs.push(`No material-specific cutting rules found for '${workpieceMaterialId}'. Using defaults.`);
        score -= 10;
      }

      // Constraint 4: Check Operation Compatibility
      const opComp = tool.operationCompatibility[feature.intent];
      if (opComp === ToolOperationCompatibilityType.INCOMPATIBLE) {
        constraintsFailed.push(`Tool is incompatible with requested operation: ${feature.intent}`);
        verdict = ToolSelectionVerdict.INELIGIBLE;
        score = 0;
      } else if (opComp === ToolOperationCompatibilityType.COMPATIBLE) {
        constraintsSatisfied.push(`Compatible with operation intent: ${feature.intent}`);
        score += 5;
      }

      // Calculate final score bounds
      score = Math.max(0, Math.min(100, score));

      results.push({
        toolId: tool.toolId,
        assemblyId: associatedAssembly?.assemblyId,
        verdict: verdict,
        rankingScore: score,
        explanation: {
          whySelected: verdict === ToolSelectionVerdict.ELIGIBLE 
            ? `Excellent fit for ${feature.featureType} feature processing`
            : verdict === ToolSelectionVerdict.CONDITIONALLY_ELIGIBLE
            ? `Feasible with limited performance envelopes`
            : "Does not meet geometric or process constraints",
          constraintsSatisfied,
          constraintsFailed,
          tradeoffs
        }
      });
    }

    // Rank by score descending, eligible first
    return results.sort((a, b) => b.rankingScore - a.rankingScore);
  }
}
