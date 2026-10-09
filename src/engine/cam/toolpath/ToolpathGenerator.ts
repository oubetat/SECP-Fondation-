/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Toolpath Generator, Sequencer & Linker
 */

import {
  Vector3D,
  CuttingTool,
  CuttingParameters,
  ToolPosition,
  ToolpathSegment,
  Toolpath,
  MotionType,
  MachiningOperation,
  OperationStrategyType,
  MachiningSetup,
  CoolantState,
} from './ToolpathTypes';
import { MachiningStrategies } from './MachiningStrategies';
import { ManufacturingFeature, ManufacturingFeatureType } from '../feature-recognition/FeatureTypes';

export class ToolpathGenerator {
  /**
   * Generates a Toolpath entity from a sequence of raw tool positions
   */
  public static buildToolpathFromPositions(
    positions: ToolPosition[],
    operationId: string,
    setupId: string,
    toolId: string
  ): Toolpath {
    const segments: ToolpathSegment[] = [];
    let totalLengthMm = 0;
    let rapidLengthMm = 0;
    let cuttingLengthMm = 0;
    let estimatedTimeSec = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const zLevelsSet = new Set<number>();

    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dy, dz);

      totalLengthMm += len;

      const isRapid = p2.motionType === MotionType.RAPID || p2.motionType === MotionType.RETRACT;
      if (isRapid) {
        rapidLengthMm += len;
      } else {
        cuttingLengthMm += len;
      }

      // Time calculation (t = len / feed)
      const feed = Math.max(10, p2.feedMmMin);
      const segTimeSec = (len / feed) * 60;
      estimatedTimeSec += segTimeSec;

      // Bounds
      minX = Math.min(minX, p1.x, p2.x);
      maxX = Math.max(maxX, p1.x, p2.x);
      minY = Math.min(minY, p1.y, p2.y);
      maxY = Math.max(maxY, p1.y, p2.y);
      minZ = Math.min(minZ, p1.z, p2.z);
      maxZ = Math.max(maxZ, p1.z, p2.z);

      if (!isRapid) {
        zLevelsSet.add(Number(p2.z.toFixed(2)));
      }

      segments.push({
        id: `seg_${operationId}_${i}`,
        startPoint: { x: p1.x, y: p1.y, z: p1.z },
        endPoint: { x: p2.x, y: p2.y, z: p2.z },
        motionType: p2.motionType,
        feedMmMin: p2.feedMmMin,
        spindleRpm: p2.spindleRpm,
        lengthMm: Number(len.toFixed(4)),
        estimatedTimeSec: Number(segTimeSec.toFixed(4)),
        isCutting: !isRapid,
        zLevelMm: Number(p2.z.toFixed(3)),
      });
    }

    const toolpathHash = this.computeToolpathHash(positions, operationId);

    return {
      id: `tp_${operationId}`,
      operationId,
      setupId,
      toolId,
      positions,
      segments,
      totalLengthMm: Number(totalLengthMm.toFixed(3)),
      rapidLengthMm: Number(rapidLengthMm.toFixed(3)),
      cuttingLengthMm: Number(cuttingLengthMm.toFixed(3)),
      estimatedMachiningTimeSec: Number(estimatedTimeSec.toFixed(2)),
      maxDepthMm: minZ === Infinity ? 0 : Number((maxZ - minZ).toFixed(3)),
      zPassCount: zLevelsSet.size,
      boundingVolume: {
        minX: minX === Infinity ? 0 : Number(minX.toFixed(3)),
        maxX: maxX === -Infinity ? 0 : Number(maxX.toFixed(3)),
        minY: minY === Infinity ? 0 : Number(minY.toFixed(3)),
        maxY: maxY === -Infinity ? 0 : Number(maxY.toFixed(3)),
        minZ: minZ === Infinity ? 0 : Number(minZ.toFixed(3)),
        maxZ: maxZ === -Infinity ? 0 : Number(maxZ.toFixed(3)),
      },
      toolpathHash,
    };
  }

  /**
   * Generates deterministic hash fingerprint for toolpath repeatability
   */
  public static computeToolpathHash(positions: ToolPosition[], opId: string): string {
    let hash = 0x811c9dc5;
    const prime = 0x01000193;

    const opStr = `${opId}:${positions.length}`;
    for (let i = 0; i < opStr.length; i++) {
      hash ^= opStr.charCodeAt(i);
      hash = Math.imul(hash, prime);
    }

    for (const p of positions) {
      const posStr = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)},${p.motionType}`;
      for (let i = 0; i < posStr.length; i++) {
        hash ^= posStr.charCodeAt(i);
        hash = Math.imul(hash, prime);
      }
    }

    return `TP-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
  }

  /**
   * Automatically derives and generates toolpaths from a recognized ManufacturingFeature
   */
  public static generateFeatureToolpath(
    feature: ManufacturingFeature,
    tool: CuttingTool,
    params: CuttingParameters,
    setup: MachiningSetup
  ): ToolPosition[] {
    const safeZ = setup.safePlaneZMm;
    const retractZ = setup.retractPlaneZMm;

    switch (feature.type) {
      case ManufacturingFeatureType.PLANAR_FACE:
      case ManufacturingFeatureType.STEP:
        return MachiningStrategies.generateFacingToolpath(
          {
            minX: feature.boundingVolume.minX,
            maxX: feature.boundingVolume.maxX,
            minY: feature.boundingVolume.minY,
            maxY: feature.boundingVolume.maxY,
            minZ: feature.boundingVolume.minZ,
            maxZ: feature.boundingVolume.maxZ,
          },
          feature.boundingVolume.minZ,
          tool,
          params,
          safeZ,
          retractZ
        );

      case ManufacturingFeatureType.POCKET_RECTANGULAR:
      case ManufacturingFeatureType.POCKET_CIRCULAR:
      case ManufacturingFeatureType.POCKET_GENERAL:
      case ManufacturingFeatureType.OPEN_POCKET:
        return MachiningStrategies.generatePocketToolpath(
          {
            minX: feature.boundingVolume.minX,
            maxX: feature.boundingVolume.maxX,
            minY: feature.boundingVolume.minY,
            maxY: feature.boundingVolume.maxY,
            topZ: feature.boundingVolume.maxZ,
            floorZ: feature.boundingVolume.minZ,
          },
          tool,
          params,
          safeZ,
          retractZ
        );

      case ManufacturingFeatureType.SLOT_THROUGH:
      case ManufacturingFeatureType.SLOT_BLIND:
        return MachiningStrategies.generateSlotToolpath(
          { x: feature.boundingVolume.minX, y: (feature.boundingVolume.minY + feature.boundingVolume.maxY) / 2 },
          { x: feature.boundingVolume.maxX, y: (feature.boundingVolume.minY + feature.boundingVolume.maxY) / 2 },
          feature.parameters.widthMm || tool.diameterMm,
          feature.boundingVolume.maxZ,
          feature.boundingVolume.minZ,
          tool,
          params,
          safeZ,
          retractZ
        );

      case ManufacturingFeatureType.HOLE_SIMPLE:
      case ManufacturingFeatureType.HOLE_BLIND:
      case ManufacturingFeatureType.HOLE_THROUGH:
      case ManufacturingFeatureType.HOLE_COUNTERBORE:
      case ManufacturingFeatureType.HOLE_COUNTERSINK:
        return MachiningStrategies.generateDrillingToolpath(
          {
            x: (feature.boundingVolume.minX + feature.boundingVolume.maxX) / 2,
            y: (feature.boundingVolume.minY + feature.boundingVolume.maxY) / 2,
          },
          feature.boundingVolume.maxZ,
          feature.parameters.depthMm || (feature.boundingVolume.maxZ - feature.boundingVolume.minZ),
          tool,
          params,
          true,
          3.0,
          safeZ,
          retractZ
        );

      default:
        // Generic pocket roughing for any unknown 3D recess feature
        return MachiningStrategies.generatePocketToolpath(
          {
            minX: feature.boundingVolume.minX,
            maxX: feature.boundingVolume.maxX,
            minY: feature.boundingVolume.minY,
            maxY: feature.boundingVolume.maxY,
            topZ: feature.boundingVolume.maxZ,
            floorZ: feature.boundingVolume.minZ,
          },
          tool,
          params,
          safeZ,
          retractZ
        );
    }
  }
}
