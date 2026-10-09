/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Machining Physics: Stepdown, Stepover & Cutting Parameters
 */

import { CuttingTool, ToolType, CuttingParameters, EntryStrategyType, CoolantState, OperationStrategyType } from './ToolpathTypes';

export interface WorkpieceMaterialProperties {
  id: string;
  name: string;
  hardnessHbr: number;
  recommendedSurfaceSpeedMMin: number; // Vc in m/min
  feedPerToothMm: number;               // Fz in mm/tooth
  maxAxialEngagementRatio: number;      // fraction of tool diameter (Ap/D)
  maxRadialEngagementRatio: number;     // fraction of tool diameter (Ae/D)
}

export const STANDARD_MATERIALS: Record<string, WorkpieceMaterialProperties> = {
  ALUMINUM_6061_T6: {
    id: 'AL_6061',
    name: 'Aluminum 6061-T6',
    hardnessHbr: 95,
    recommendedSurfaceSpeedMMin: 350,
    feedPerToothMm: 0.08,
    maxAxialEngagementRatio: 1.0,
    maxRadialEngagementRatio: 0.65,
  },
  STEEL_1018_LOW_CARBON: {
    id: 'STEEL_1018',
    name: 'Mild Steel AISI 1018',
    hardnessHbr: 126,
    recommendedSurfaceSpeedMMin: 120,
    feedPerToothMm: 0.04,
    maxAxialEngagementRatio: 0.5,
    maxRadialEngagementRatio: 0.45,
  },
  STAINLESS_STEEL_304: {
    id: 'SS_304',
    name: 'Stainless Steel AISI 304',
    hardnessHbr: 180,
    recommendedSurfaceSpeedMMin: 75,
    feedPerToothMm: 0.03,
    maxAxialEngagementRatio: 0.35,
    maxRadialEngagementRatio: 0.35,
  },
  BRASS_C360: {
    id: 'BRASS_C360',
    name: 'Free-Cutting Brass C360',
    hardnessHbr: 110,
    recommendedSurfaceSpeedMMin: 280,
    feedPerToothMm: 0.06,
    maxAxialEngagementRatio: 0.8,
    maxRadialEngagementRatio: 0.6,
  },
};

export class StepdownCalculator {
  /**
   * Calculates maximum safe axial depth of cut (Ap) based on tool diameter, flutes, and material
   */
  public static calculateMaxStepdown(
    tool: CuttingTool,
    material: WorkpieceMaterialProperties = STANDARD_MATERIALS.ALUMINUM_6061_T6,
    strategy: OperationStrategyType = OperationStrategyType.POCKET_ROUGHING
  ): number {
    let multiplier = material.maxAxialEngagementRatio;

    if (strategy === OperationStrategyType.FACING) {
      multiplier = Math.min(multiplier, 0.25); // Light cuts for facing passes
    } else if (strategy === OperationStrategyType.SLOT_MILLING) {
      multiplier = Math.min(multiplier, 0.4);  // High radial engagement requires shallower axial step
    } else if (strategy === OperationStrategyType.POCKET_FINISHING) {
      multiplier = Math.min(multiplier, 0.5);
    } else if (strategy === OperationStrategyType.ADAPTIVE_ROUGHING) {
      multiplier = Math.min(tool.fluteLengthMm / tool.diameterMm, 1.5); // Deep axial with low radial engagement
    }

    const calculatedStepdown = tool.diameterMm * multiplier;
    // Must never exceed tool cutting flute length
    return Math.min(calculatedStepdown, tool.fluteLengthMm);
  }
}

export class StepoverCalculator {
  /**
   * Calculates optimal radial width of cut (Ae) for tool engagement and surface scallop control
   */
  public static calculateOptimalStepover(
    tool: CuttingTool,
    strategy: OperationStrategyType = OperationStrategyType.POCKET_ROUGHING,
    desiredScallopHeightMm: number = 0.01
  ): number {
    if (strategy === OperationStrategyType.FACING) {
      return tool.diameterMm * 0.70; // 70% stepover for face mill / large end mill
    }

    if (strategy === OperationStrategyType.POCKET_ROUGHING) {
      return tool.diameterMm * 0.55; // 55% stepover avoids center cusp uncut regions
    }

    if (strategy === OperationStrategyType.ADAPTIVE_ROUGHING) {
      return tool.diameterMm * 0.15; // 15% light radial engagement for high-speed trochoidal
    }

    if (strategy === OperationStrategyType.PARALLEL_FINISHING || strategy === OperationStrategyType.CONSTANT_Z_FINISHING) {
      if (tool.type === ToolType.BALL_NOSE) {
        // Scallop height h = R - sqrt(R^2 - (Ae/2)^2) => Ae = 2 * sqrt(2*R*h - h^2)
        const R = tool.diameterMm / 2;
        const h = Math.min(desiredScallopHeightMm, R * 0.5);
        const Ae = 2 * Math.sqrt(Math.max(0.001, 2 * R * h - h * h));
        return Math.min(Ae, tool.diameterMm * 0.4);
      }
      return tool.diameterMm * 0.25; // Flat end mill finish pass stepover
    }

    return tool.diameterMm * 0.5;
  }

  /**
   * Calculates theoretical scallop (cusp) height for a ball nose or flat end mill
   */
  public static calculateScallopHeight(tool: CuttingTool, stepoverMm: number): number {
    if (tool.type === ToolType.BALL_NOSE) {
      const R = tool.diameterMm / 2;
      const halfAe = Math.min(stepoverMm / 2, R * 0.99);
      return R - Math.sqrt(R * R - halfAe * halfAe);
    }
    return 0.001; // Flat bottom cutter has flat theoretical bottom between passes
  }
}

export class CuttingParametersEngine {
  /**
   * Computes deterministic RPM, feed, and plunge/ramp speeds
   */
  public static computeParameters(
    tool: CuttingTool,
    strategy: OperationStrategyType,
    material: WorkpieceMaterialProperties = STANDARD_MATERIALS.ALUMINUM_6061_T6,
    entryStrategy: EntryStrategyType = EntryStrategyType.HELIX
  ): CuttingParameters {
    // 1. Spindle RPM: n = (Vc * 1000) / (pi * D)
    const rawRpm = (material.recommendedSurfaceSpeedMMin * 1000) / (Math.PI * tool.diameterMm);
    const spindleRpm = Math.min(Math.round(rawRpm), tool.maxRpm);

    // 2. Feed Rate: Vf = n * Z * Fz
    const rawCuttingFeed = spindleRpm * tool.numberOfFlutes * material.feedPerToothMm;
    const cuttingFeedMmMin = Math.min(Math.round(rawCuttingFeed), tool.maxFeedMmMin);

    // 3. Entry speeds
    const plungeFeedMmMin = Math.round(cuttingFeedMmMin * 0.3); // 30% of feed for plunge
    const rampFeedMmMin = Math.round(cuttingFeedMmMin * 0.6);   // 60% of feed for helical/ramp

    // 4. Depths and Stepover
    const stepdownMm = Number(StepdownCalculator.calculateMaxStepdown(tool, material, strategy).toFixed(3));
    const stepoverMm = Number(StepoverCalculator.calculateOptimalStepover(tool, strategy).toFixed(3));

    // 5. Stock to leave allowances
    const isRoughing = strategy === OperationStrategyType.POCKET_ROUGHING || strategy === OperationStrategyType.ADAPTIVE_ROUGHING;
    const stockToLeaveWallMm = isRoughing ? 0.3 : 0.0;
    const stockToLeaveFloorMm = isRoughing ? 0.2 : 0.0;

    return {
      spindleRpm,
      cuttingFeedMmMin,
      plungeFeedMmMin,
      rampFeedMmMin,
      rapidFeedMmMin: 5000, // 5000 mm/min standard rapid
      stepdownMm,
      stepoverMm,
      stockToLeaveFloorMm,
      stockToLeaveWallMm,
      entryStrategy,
      rampAngleDeg: 3.0,
      helixRadiusMm: Math.max(1.0, tool.diameterMm * 0.35),
      helixPitchMm: 1.5,
      coolant: CoolantState.FLOOD,
    };
  }
}
