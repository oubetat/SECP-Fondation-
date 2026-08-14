/**
 * PATCH-SECP-057 — 057-B: Cutting Tool Model & Holder Geometry
 * Defines standardized tool geometries, toolholders, reach calculations,
 * and flute/stickout constraint verifications.
 */

import { CuttingTool, ToolHolderGeometry, CutterGeometry, ToolType } from './ToolpathTypes';

export class CuttingToolModel {
  /**
   * Creates a standardized cutting tool with an optional toolholder
   */
  public static createTool(
    toolId: string,
    name: string,
    type: ToolType,
    diameterMm: number,
    fluteCount: number,
    fluteLengthMm: number,
    overallLengthMm: number,
    material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD' = 'CARBIDE',
    holder?: ToolHolderGeometry
  ): CuttingTool {
    const cornerRadiusMm = type === 'BALL_NOSE' ? diameterMm / 2 : 0;
    const reachMm = overallLengthMm * 0.7; // Standard stickout reach before holder taper

    return {
      toolId,
      name,
      type,
      diameterMm,
      cornerRadiusMm,
      fluteCount,
      fluteLengthMm,
      overallLengthMm,
      holderDiameterMm: holder ? holder.upperDiameterMm : diameterMm * 2,
      gaugeLengthMm: holder ? holder.lengthMm + reachMm : overallLengthMm + 30,
      reachMm,
      material,
      holder: holder || {
        holderId: `holder-${toolId}`,
        name: `ER32 Collet Chuck - ${toolId}`,
        gaugeDiameterMm: 50,
        upperDiameterMm: 63,
        lengthMm: 70,
        clearanceMarginMm: 3.0
      }
    };
  }

  /**
   * Validates if feature depth can be machined with given tool reach without holder collision
   */
  public static validateToolReach(tool: CuttingTool, featureDepthMm: number): { satisfiesReach: boolean; marginMm: number } {
    const maxReach = tool.reachMm || (tool.overallLengthMm * 0.7);
    const marginMm = maxReach - featureDepthMm;
    return {
      satisfiesReach: marginMm >= 0,
      marginMm: Number(marginMm.toFixed(2))
    };
  }
}
