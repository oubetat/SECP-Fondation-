/**
 * SECP-098 — 3-Axis Deterministic Toolpath Engine
 * Generates forensic-verifiable toolpaths for Roughing, Finishing, Contour, and Pocketing.
 */

import { Vector3D } from '../cadKernel';
import { 
  MachiningOperationConfig, 
  CutterLocationPoint, 
  CandidateToolpathTrajectory 
} from './ToolpathTypes';
import { generateDeterministicHash } from '../../lib/hash';

export class ThreeAxisToolpathEngine {
  /**
   * Generates a deterministic toolpath trajectory based on the operation config.
   */
  public static async generateToolpathAsync(
    config: MachiningOperationConfig,
    stockBounds: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
    inputTopologyHash: string
  ): Promise<CandidateToolpathTrajectory> {
    let points: CutterLocationPoint[] = [];

    switch (config.strategy) {
      case 'FACING':
        points = this.generateFacingPoints(config, stockBounds);
        break;
      case 'ROUGHING_ADAPTIVE':
        points = this.generateAdaptiveRoughingPoints(config, stockBounds);
        break;
      case 'CONTOUR_PROFILE':
        points = this.generateContourPoints(config, stockBounds);
        break;
      case 'POCKET_MACHINING':
        points = this.generatePocketPoints(config, stockBounds);
        break;
      default:
        // Default to a safe clearance move for unsupported strategies in this foundation
        points = this.generateClearancePoints(config, stockBounds);
    }

    const totalLength = this.calculatePathLength(points);
    const trajectoryHash = await generateDeterministicHash(points);

    return {
      operationId: config.operationId,
      strategy: config.strategy,
      points,
      totalLengthMm: Number(totalLength.toFixed(3)),
      estimatedTimeSec: Number((totalLength / config.feedsAndSpeeds.cuttingFeedMmMin * 60).toFixed(1)),
      generatedAt: new Date().toISOString(),
      provenance: {
        inputTopologyHash,
        toolFingerprint: config.toolAssembly.tool.fingerprint,
        parameterHash: config.fingerprint,
        trajectoryHash
      }
    };
  }

  private static generateFacingPoints(config: MachiningOperationConfig, stock: any): CutterLocationPoint[] {
    const points: CutterLocationPoint[] = [];
    const tool = config.toolAssembly.tool;
    const stepover = config.parameters.stepoverMm;
    const z = stock.zMax;
    
    let currentY = stock.yMin + tool.diameterMm / 2;
    let pointIndex = 0;

    while (currentY <= stock.yMax) {
      // One pass from X min to X max
      points.push({
        pointIndex: pointIndex++,
        position: { x: stock.xMin - tool.diameterMm, y: currentY, z: config.clearancePlaneZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'RAPID_APPROACH'
      });

      points.push({
        pointIndex: pointIndex++,
        position: { x: stock.xMin, y: currentY, z: z },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'CUTTING'
      });

      points.push({
        pointIndex: pointIndex++,
        position: { x: stock.xMax, y: currentY, z: z },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'CUTTING'
      });

      points.push({
        pointIndex: pointIndex++,
        position: { x: stock.xMax + tool.diameterMm, y: currentY, z: config.clearancePlaneZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'RETRACT'
      });

      currentY += stepover;
    }

    return points;
  }

  private static generateAdaptiveRoughingPoints(config: MachiningOperationConfig, stock: any): CutterLocationPoint[] {
    // Simplified deterministic spiral roughing for SECP-098
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    const tool = config.toolAssembly.tool;
    const centerX = (stock.xMin + stock.xMax) / 2;
    const centerY = (stock.yMin + stock.yMax) / 2;
    const maxRadius = Math.min(stock.xMax - stock.xMin, stock.yMax - stock.yMin) / 2 - tool.diameterMm / 2;
    const stepover = config.parameters.stepoverMm;
    const z = stock.zMax - config.parameters.stepdownMm;

    for (let r = stepover; r <= maxRadius; r += stepover) {
      for (let theta = 0; theta < Math.PI * 2; theta += 0.2) {
        points.push({
          pointIndex: pointIndex++,
          position: { 
            x: centerX + r * Math.cos(theta), 
            y: centerY + r * Math.sin(theta), 
            z: z 
          },
          toolVector: { x: 0, y: 0, z: 1 },
          feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
          spindleRpm: config.feedsAndSpeeds.spindleRpm,
          moveType: 'CUTTING'
        });
      }
    }
    return points;
  }

  private static generateContourPoints(config: MachiningOperationConfig, stock: any): CutterLocationPoint[] {
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    const tool = config.toolAssembly.tool;
    const offset = tool.diameterMm / 2;
    const z = stock.zMax - config.parameters.stepdownMm;

    const corners = [
      { x: stock.xMin - offset, y: stock.yMin - offset },
      { x: stock.xMax + offset, y: stock.yMin - offset },
      { x: stock.xMax + offset, y: stock.yMax + offset },
      { x: stock.xMin - offset, y: stock.yMax + offset },
      { x: stock.xMin - offset, y: stock.yMin - offset }
    ];

    corners.forEach((c, idx) => {
      points.push({
        pointIndex: pointIndex++,
        position: { x: c.x, y: c.y, z: idx === 0 ? config.clearancePlaneZ : z },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: idx === 0 ? config.feedsAndSpeeds.rapidFeedMmMin : config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: idx === 0 ? 'RAPID_APPROACH' : 'CUTTING'
      });
    });

    return points;
  }

  private static generatePocketPoints(config: MachiningOperationConfig, stock: any): CutterLocationPoint[] {
    // Pocketing often uses an inward spiral, mirroring roughing for this foundation
    return this.generateAdaptiveRoughingPoints(config, stock);
  }

  private static generateClearancePoints(config: MachiningOperationConfig, stock: any): CutterLocationPoint[] {
    return [{
      pointIndex: 0,
      position: { x: stock.xMin, y: stock.yMin, z: config.clearancePlaneZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RAPID_APPROACH'
    }];
  }

  private static calculatePathLength(points: CutterLocationPoint[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1].position;
      const p2 = points[i].position;
      length += Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
    }
    return length;
  }
}
