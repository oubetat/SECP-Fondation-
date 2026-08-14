/**
 * PATCH-SECP-057 — 057-F: Drilling & Hole Cycles Engine
 * Generates Candidate Toolpaths for Peck Drilling (G83) and Rigid Tapping (G84).
 */

import { Vector3D } from '../cadKernel';
import { 
  MachiningOperationConfig, 
  CutterLocationPoint, 
  CandidateToolpathTrajectory 
} from './ToolpathTypes';

export class DrillingCycleEngine {
  /**
   * Generates Peck Drilling (G83) Candidate Trajectory
   */
  public static generatePeckDrillingCandidate(
    config: MachiningOperationConfig,
    holeCenter: { x: number; y: number; topZ: number; depthMm: number; peckIncrementMm: number }
  ): CandidateToolpathTrajectory {
    const points: CutterLocationPoint[] = [];
    let pointIndex = 0;
    let totalLength = 0;

    const tool = config.tool;
    const safeZ = config.clearancePlaneZ;
    const retractZ = config.retractPlaneZ;
    const bottomZ = holeCenter.topZ - holeCenter.depthMm;
    const peck = holeCenter.peckIncrementMm || 3.0;

    // 1. Rapid to hole location above clearance Z
    points.push({
      pointIndex: pointIndex++,
      position: { x: holeCenter.x, y: holeCenter.y, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'RAPID_APPROACH'
    });

    let currentZ = holeCenter.topZ;

    // 2. Pecking Loop
    while (currentZ > bottomZ) {
      const nextZ = Math.max(bottomZ, currentZ - peck);

      // Rapid approach to slightly above current cut depth
      points.push({
        pointIndex: pointIndex++,
        position: { x: holeCenter.x, y: holeCenter.y, z: Math.min(holeCenter.topZ, currentZ + 1.0) },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'RAPID_APPROACH'
      });

      // Feed cut down to next peck depth
      const cutDist = Math.abs(nextZ - currentZ);
      totalLength += cutDist;

      points.push({
        pointIndex: pointIndex++,
        position: { x: holeCenter.x, y: holeCenter.y, z: nextZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.cuttingFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'CUTTING'
      });

      // Rapid chip-breaker retract back to retract Z
      totalLength += Math.abs(retractZ - nextZ);

      points.push({
        pointIndex: pointIndex++,
        position: { x: holeCenter.x, y: holeCenter.y, z: retractZ },
        toolVector: { x: 0, y: 0, z: 1 },
        feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
        spindleRpm: config.feedsAndSpeeds.spindleRpm,
        moveType: 'RETRACT'
      });

      currentZ = nextZ;
    }

    // Final Retract to Safe Z
    points.push({
      pointIndex: pointIndex++,
      position: { x: holeCenter.x, y: holeCenter.y, z: safeZ },
      toolVector: { x: 0, y: 0, z: 1 },
      feedRateMmMin: config.feedsAndSpeeds.rapidFeedMmMin,
      spindleRpm: config.feedsAndSpeeds.spindleRpm,
      moveType: 'CLEARANCE_TRANSITION'
    });

    const nominalVolume = Math.PI * Math.pow(tool.diameterMm / 2, 2) * holeCenter.depthMm;
    const estimatedTime = (totalLength / config.feedsAndSpeeds.cuttingFeedMmMin) * 60 + 1;

    return {
      operationId: config.operationId,
      strategy: 'DRILLING_PECK',
      tool,
      points,
      totalLengthMm: Number(totalLength.toFixed(3)),
      estimatedTimeSec: Number(estimatedTime.toFixed(1)),
      nominalVolumeMm3: Number(nominalVolume.toFixed(2)),
      maxEngagementAngleRad: Number(Math.PI.toFixed(4)),
      generatedTimestamp: new Date().toISOString()
    };
  }
}
