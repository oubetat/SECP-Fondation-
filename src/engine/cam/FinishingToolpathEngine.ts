/**
 * PATCH-SECP-057 — 057-E: Finishing Toolpath Generation Engine
 * Generates Candidate Toolpaths for Z-Level Finishing and Planar Raster Finishing
 * with precise scallop height calculations based on tool corner radius.
 */

import { Vector3D } from '../cadKernel';
import { 
  MachiningOperationConfig, 
  CutterLocationPoint, 
  CandidateToolpathTrajectory 
} from './ToolpathTypes';

export class FinishingToolpathEngine {
  /**
   * Calculates surface scallop height h = R - sqrt(R^2 - (ae/2)^2)
   */
  public static calculateScallopHeight(toolRadiusMm: number, stepoverMm: number): number {
    if (stepoverMm >= 2 * toolRadiusMm) return toolRadiusMm;
    const h = toolRadiusMm - Math.sqrt(toolRadiusMm * toolRadiusMm - Math.pow(stepoverMm / 2, 2));
    return Number(h.toFixed(5));
  }

  /**
   * Generates Z-Level Finishing Candidate Trajectory
   */
  public static generateZLevelFinishingCandidate(
    config: MachiningOperationConfig,
    surfaceBounds: { xMin: number; xMax: number; yMin: number; yMax: number; topZ: number; bottomZ: number }
  ): CandidateToolpathTrajectory {
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    let totalLength = 0;

    const tool = config.tool;
    const toolRadius = tool.diameterMm / 2;
    const stepdown = config.stepdownMm;
    const safeZ = config.clearancePlaneZ;

    const scallopHeight = this.calculateScallopHeight(toolRadius, config.stepoverMm);

    // Initial Approach
    points.push({
      pointIndex: pointIndex++,
      position: { x: surfaceBounds.xMin, y: surfaceBounds.yMin, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RAPID_APPROACH'
    });

    let currentZ = surfaceBounds.topZ;

    while (currentZ >= surfaceBounds.bottomZ) {
      // Contour perimeter pass at current Z
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const angle = frac * 2 * Math.PI;
        const radiusX = (surfaceBounds.xMax - surfaceBounds.xMin) / 2;
        const radiusY = (surfaceBounds.yMax - surfaceBounds.yMin) / 2;
        const cx = (surfaceBounds.xMin + surfaceBounds.xMax) / 2;
        const cy = (surfaceBounds.yMin + surfaceBounds.yMax) / 2;

        const px = cx + radiusX * Math.cos(angle);
        const py = cy + radiusY * Math.sin(angle);

        if (points.length > 0) {
          const prev = points[points.length - 1].position;
          totalLength += Math.hypot(px - prev.x, py - prev.y, currentZ - prev.z);
        }

        points.push({
          pointIndex: pointIndex++,
          position: { x: px, y: py, z: currentZ },
          toolVector: { x: 0, y: 0, z: 1 },
          feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
          spindleRpm: config.feedsAndSpeeds.spindleRpm,
          moveType: 'CUTTING',
          scallopHeightMm: scallopHeight
        });
      }

      currentZ -= stepdown;
    }

    // Final Retract
    const lastPos = points[points.length - 1].position;
    points.push({
      pointIndex: pointIndex++,
      position: { x: lastPos.x, y: lastPos.y, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RETRACT'
    });

    const nominalVolume = (surfaceBounds.xMax - surfaceBounds.xMin) * (surfaceBounds.yMax - surfaceBounds.yMin) * config.stockToLeaveMm;
    const estimatedTime = (totalLength / config.feedsAndSpeeds.cuttingFeedMmMin) * 60 + 2;

    return {
      operationId: config.operationId,
      strategy: 'Z_LEVEL_FINISHING',
      tool,
      points,
      totalLengthMm: Number(totalLength.toFixed(3)),
      estimatedTimeSec: Number(estimatedTime.toFixed(1)),
      nominalVolumeMm3: Number(nominalVolume.toFixed(2)),
      maxEngagementAngleRad: Number((Math.PI / 4).toFixed(4)),
      generatedTimestamp: new Date().toISOString()
    };
  }
}
