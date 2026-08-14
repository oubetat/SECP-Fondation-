/**
 * PATCH-SECP-057 — 057-C: 3-Axis Toolpath Generation Engine
 * Generates Candidate Toolpaths for Facing and 2.5D/3D Planar Offset operations.
 */

import { Vector3D } from '../cadKernel';
import { 
  MachiningOperationConfig, 
  CutterLocationPoint, 
  CandidateToolpathTrajectory 
} from './ToolpathTypes';

export class ThreeAxisToolpathEngine {
  /**
   * Generates Facing Toolpath Candidate Trajectory
   */
  public static generateFacingCandidate(
    config: MachiningOperationConfig,
    stockBounds: { xMin: number; xMax: number; yMin: number; yMax: number; stockTopZ: number; targetTopZ: number }
  ): CandidateToolpathTrajectory {
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    let totalLength = 0;

    const tool = config.tool;
    const toolRadius = tool.diameterMm / 2;
    const stepover = Math.min(config.stepoverMm, tool.diameterMm * 0.75);
    const safeZ = config.clearancePlaneZ;

    const overhang = toolRadius * 1.2;
    const startX = stockBounds.xMin - overhang;
    const endX = stockBounds.xMax + overhang;
    const yMin = stockBounds.yMin + toolRadius * 0.2;
    const yMax = stockBounds.yMax - toolRadius * 0.2;

    const totalPasses = Math.ceil((yMax - yMin) / stepover) + 1;
    const currentZ = stockBounds.targetTopZ;

    // Rapid Approach
    points.push({
      pointIndex: pointIndex++,
      position: { x: startX, y: yMin, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RAPID_APPROACH'
    });

    // Plunge
    points.push({
      pointIndex: pointIndex++,
      position: { x: startX, y: yMin, z: currentZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.plungeFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'PLUNGE'
    });

    let currentX = startX;
    let direction = 1;

    for (let pass = 0; pass < totalPasses; pass++) {
      const currentY = yMin + pass * stepover;
      const targetX = direction === 1 ? endX : startX;

      // Lead-In
      points.push({
        pointIndex: pointIndex++,
        position: { x: currentX, y: currentY, z: currentZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'LEAD_IN'
      });

      // Cutting pass
      totalLength += Math.abs(targetX - currentX);
      points.push({
        pointIndex: pointIndex++,
        position: { x: targetX, y: currentY, z: currentZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'CUTTING',
        stepoverMm: stepover
      });

      currentX = targetX;

      if (pass < totalPasses - 1) {
        const nextY = yMin + (pass + 1) * stepover;
        totalLength += stepover;

        points.push({
          pointIndex: pointIndex++,
          position: { x: currentX, y: nextY, z: currentZ },
          toolVector: { x: 0, y: 0, z: 1 },
          feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin * 0.8,
          spindleRpm: config.feedsAndSpeeds.spindleRpm,
          moveType: 'CLEARANCE_TRANSITION'
        });

        direction = -direction;
      }
    }

    // Retract
    points.push({
      pointIndex: pointIndex++,
      position: { x: currentX, y: stockBounds.yMax, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RETRACT'
    });

    const nominalVolume = (stockBounds.xMax - stockBounds.xMin) * (stockBounds.yMax - stockBounds.yMin) * (stockBounds.stockTopZ - stockBounds.targetTopZ);
    const estimatedTime = (totalLength / config.feedsAndSpeeds.cuttingFeedMmMin) * 60 + 3;

    return {
      operationId: config.operationId,
      strategy: 'FACING',
      tool,
      points,
      totalLengthMm: Number(totalLength.toFixed(3)),
      estimatedTimeSec: Number(estimatedTime.toFixed(1)),
      nominalVolumeMm3: Number(nominalVolume.toFixed(2)),
      maxEngagementAngleRad: Number((Math.PI / 2).toFixed(4)),
      generatedTimestamp: new Date().toISOString()
    };
  }
}
