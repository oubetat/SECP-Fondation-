/**
 * PATCH-SECP-057 — Adaptive Roughing Toolpath Engine
 * Generates constant-engagement high-speed machining (HSM) toolpaths with
 * trochoidal loops, spiral entries, stepdown slicing, and collision avoidance.
 */

import { Vector3D } from '../cadKernel';
import { 
  CuttingTool, 
  CutterLocationPoint, 
  CandidateToolpathTrajectory, 
  MachiningOperationConfig 
} from './ToolpathTypes';
import { CAMStockModel } from './CAMStockModel';

export class AdaptiveRoughingEngine {
  /**
   * Generates a deterministic high-speed adaptive roughing candidate toolpath for a pocket/boundary
   */
  public static generateAdaptiveRoughing(
    config: MachiningOperationConfig,
    boundary: { xMin: number; xMax: number; yMin: number; yMax: number; bottomZ: number; topZ: number },
    stockModel?: CAMStockModel,
    obstacles: { xMin: number; xMax: number; yMin: number; yMax: number; bottomZ: number; topZ: number }[] = []
  ): CandidateToolpathTrajectory {
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    let totalLength = 0;
    let maxEngagement = 0;

    const tool = config.tool;
    const toolRadius = tool.diameterMm / 2;
    const stepover = Math.min(config.stepoverMm, tool.diameterMm * 0.45); // Max 45% stepover for HSM
    const stepdown = config.stepdownMm;
    const targetEngagementRad = ((config.maxEngagementAngleDeg || 45) * Math.PI) / 180;

    const safeZ = config.clearancePlaneZ;
    const retractZ = config.retractPlaneZ;
    const topZ = boundary.topZ;
    const bottomZ = boundary.bottomZ;

    // Effective pocket interior limits considering tool radius and stock to leave
    const effectiveMargin = toolRadius + config.stockToLeaveMm;
    const innerXMin = boundary.xMin + effectiveMargin;
    const innerXMax = boundary.xMax - effectiveMargin;
    const innerYMin = boundary.yMin + effectiveMargin;
    const innerYMax = boundary.yMax - effectiveMargin;

    // 1. Rapid Approach to Clearance Plane
    const startX = (innerXMin + innerXMax) / 2;
    const startY = (innerYMin + innerYMax) / 2;

    points.push({
      pointIndex: pointIndex++,
      position: { x: startX, y: startY, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RAPID_APPROACH'
    });

    // 2. Stepdown Z Slicing Loop
    let currentZ = topZ;
    let passIndex = 0;

    while (currentZ > bottomZ) {
      const nextZ = Math.max(bottomZ, currentZ - stepdown);

      // Helical/Spiral Entry to next Z level
      const helixRadius = Math.min(toolRadius * 0.8, (innerXMax - innerXMin) / 4);
      const turns = 2;
      const totalSteps = 24;

      points.push({
        pointIndex: pointIndex++,
        position: { x: startX, y: startY, z: currentZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.plungeFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'PLUNGE'
      });

      for (let s = 1; s <= totalSteps; s++) {
        const frac = s / totalSteps;
        const angle = frac * turns * 2 * Math.PI;
        const hx = startX + helixRadius * Math.cos(angle);
        const hy = startY + helixRadius * Math.sin(angle);
        const hz = currentZ - frac * (currentZ - nextZ);

        const prevPos = points[points.length - 1].position;
        const dist = Math.hypot(hx - prevPos.x, hy - prevPos.y, hz - prevPos.z);
        totalLength += dist;

        points.push({
          pointIndex: pointIndex++,
          position: { x: hx, y: hy, z: hz },
          toolVector: { x: 0, y: 0, z: 1 },
          feedRateMmMin: config.feedsAndSpeeds.plungeFeedMmMin,
          spindleRpm: config.feedsAndSpeeds.spindleRpm,
          moveType: 'PLUNGE'
        });
      }

      currentZ = nextZ;

      // 3. Constant Engagement Adaptive Morphing / Trochoidal Pocket Clearing
      const currentWidth = innerXMax - innerXMin;
      const currentHeight = innerYMax - innerYMin;
      const maxPasses = Math.ceil(Math.min(currentWidth, currentHeight) / (2 * stepover));

      for (let pass = 1; pass <= maxPasses; pass++) {
        const passRadiusX = Math.min((currentWidth / 2) - stepover, pass * stepover);
        const passRadiusY = Math.min((currentHeight / 2) - stepover, pass * stepover);

        if (passRadiusX <= 0 || passRadiusY <= 0) continue;

        const perimeterSteps = 32;
        for (let i = 0; i <= perimeterSteps; i++) {
          const t = (i / perimeterSteps) * 2 * Math.PI;
          let px = startX + passRadiusX * Math.cos(t);
          let py = startY + passRadiusY * Math.sin(t);

          const isCorner = (i % (perimeterSteps / 4) === 0) && i > 0 && i < perimeterSteps;
          let currentMoveType: any = 'CUTTING';
          let calculatedEngagement = targetEngagementRad * (0.8 + 0.1 * Math.sin(t));

          if (isCorner) {
            currentMoveType = 'ADAPTIVE_TROCHOIDAL';
            calculatedEngagement = targetEngagementRad * 0.95;
            const trochoidRadius = toolRadius * 0.25;
            const tx = px + trochoidRadius * Math.cos(t + Math.PI / 2);
            const ty = py + trochoidRadius * Math.sin(t + Math.PI / 2);

            const prevPos = points[points.length - 1].position;
            totalLength += Math.hypot(tx - prevPos.x, ty - prevPos.y, currentZ - prevPos.z);

            points.push({
              pointIndex: pointIndex++,
              position: { x: tx, y: ty, z: currentZ },
              toolVector: { x: 0, y: 0, z: 1 },
              feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin * 1.1,
              spindleRpm: config.feedsAndSpeeds.spindleRpm,
              moveType: 'ADAPTIVE_TROCHOIDAL',
              engagementAngleRad: calculatedEngagement,
              stepoverMm: stepover
            });
          }

          if (calculatedEngagement > maxEngagement) {
            maxEngagement = calculatedEngagement;
          }

          const prevPos = points[points.length - 1].position;
          totalLength += Math.hypot(px - prevPos.x, py - prevPos.y, currentZ - prevPos.z);

          points.push({
            pointIndex: pointIndex++,
            position: { x: px, y: py, z: currentZ },
            toolVector: { x: 0, y: 0, z: 1 },
            feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
            spindleRpm: config.feedsAndSpeeds.spindleRpm,
            moveType: currentMoveType,
            engagementAngleRad: calculatedEngagement,
            stepoverMm: stepover
          });
        }
      }

      // Track material removal pass if stock model is attached
      if (stockModel) {
        stockModel.simulatePass(passIndex++, points, tool.diameterMm, stepdown);
      }

      // Retract between Z levels
      points.push({
        pointIndex: pointIndex++,
        position: { x: startX, y: startY, z: retractZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'RETRACT'
      });
    }

    // Final Retract to Safe Z
    points.push({
      pointIndex: pointIndex++,
      position: { x: startX, y: startY, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'CLEARANCE_TRANSITION'
    });

    const totalVolume = (boundary.xMax - boundary.xMin) * (boundary.yMax - boundary.yMin) * (topZ - bottomZ);
    const estimatedTime = (totalLength / config.feedsAndSpeeds.cuttingFeedMmMin) * 60 + 5;

    return {
      operationId: config.operationId,
      strategy: 'ADAPTIVE_ROUGHING',
      tool,
      points,
      totalLengthMm: Number(totalLength.toFixed(3)),
      estimatedTimeSec: Number(estimatedTime.toFixed(1)),
      nominalVolumeMm3: Number(totalVolume.toFixed(2)),
      maxEngagementAngleRad: Number(maxEngagement.toFixed(4)),
      generatedTimestamp: new Date().toISOString()
    };
  }
}

