/**
 * SECP-098 — Cutting Tool & Assembly Model
 * Standardized tool geometries, assemblies, and deterministic fingerprints.
 */

import { CuttingTool, ToolHolderGeometry, ToolType, ToolAssembly } from './ToolpathTypes';
import { generateDeterministicHash } from '../../lib/hash';

export class CuttingToolModel {
  /**
   * Creates a deterministic cutting tool fingerprint
   */
  public static async calculateToolFingerprint(toolData: any): Promise<string> {
    return generateDeterministicHash(toolData);
  }

  /**
   * Creates a standardized cutting tool
   */
  public static async createTool(
    toolId: string,
    name: string,
    type: ToolType,
    diameterMm: number,
    fluteCount: number,
    fluteLengthMm: number,
    overallLengthMm: number,
    material: 'CARBIDE' | 'HSS' | 'CERAMIC' | 'CBN' | 'PCD' = 'CARBIDE',
    holder?: ToolHolderGeometry
  ): Promise<CuttingTool> {
    if (diameterMm <= 0) throw new Error('Tool diameter must be positive.');
    if (overallLengthMm <= 0) throw new Error('Tool length must be positive.');

    const cornerRadiusMm = type === 'BALL_NOSE' ? diameterMm / 2 : 0;
    const reachMm = overallLengthMm * 0.7;

    const toolBase = {
      toolId,
      name,
      type,
      diameterMm,
      cornerRadiusMm,
      fluteCount,
      fluteLengthMm,
      overallLengthMm,
      material,
      reachMm
    };

    const fingerprint = await this.calculateToolFingerprint(toolBase);

    return {
      ...toolBase,
      holderDiameterMm: holder ? holder.upperDiameterMm : diameterMm * 2,
      gaugeLengthMm: holder ? holder.lengthMm + reachMm : overallLengthMm + 30,
      holder,
      fingerprint
    };
  }

  /**
   * Creates a Tool Assembly
   */
  public static async createAssembly(
    assemblyId: string,
    tool: CuttingTool,
    holder: ToolHolderGeometry,
    offsetNumber: number = 1
  ): Promise<ToolAssembly> {
    const assemblyData = {
      assemblyId,
      toolId: tool.toolId,
      holderId: holder.holderId,
      offsetNumber
    };

    const fingerprint = await generateDeterministicHash(assemblyData);

    return {
      assemblyId,
      tool,
      holder,
      offsetNumber,
      compensationLengthMm: tool.gaugeLengthMm,
      fingerprint
    };
  }

  /**
   * Validates tool reach
   */
  public static validateToolReach(tool: CuttingTool, featureDepthMm: number): { satisfiesReach: boolean; marginMm: number } {
    const marginMm = tool.reachMm - featureDepthMm;
    return {
      satisfiesReach: marginMm >= 0,
      marginMm: Number(marginMm.toFixed(2))
    };
  }
}
