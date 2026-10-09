/**
 * SECP Industrial OS v2 — Real CAM Kernel
 * PATCH-257 — 4-Axis Machining Strategies
 */

import { Vector3D, MotionType, CoolantState } from '../toolpath/ToolpathTypes';
import {
  FourAxisOperation,
  FourAxisToolPosition,
  FourAxisToolpathSegment,
  FourAxisMachineModel,
  RotaryCoordinateSystem,
  FourAxisOperationMode,
  FourAxisStrategyType,
  FeedrateMode
} from './FourAxisTypes';
import { FourAxisKinematics } from './FourAxisKinematics';
import { FourAxisFeedCalculator } from './FourAxisFeedCalculator';
import { RotaryUnwindManager } from './RotaryUnwindManager';

export interface StrategyGenerationOutput {
  positions: FourAxisToolPosition[];
  segments: FourAxisToolpathSegment[];
  totalLengthMm: number;
  totalRotaryTravelDeg: number;
  estimatedMachiningTimeSec: number;
  rapidTimeSec: number;
  cuttingTimeSec: number;
}

export class FourAxisStrategies {
  /**
   * 1. INDEXED 4-AXIS STRATEGY:
   * Rotates 4th axis to a fixed orientation (e.g., A=0°, 90°, 180°, 270°),
   * retracts tool to safe clearance plane, indexes rotary table, and performs 3-axis cutting on that face.
   */
  public static generateIndexedMachining(
    operation: FourAxisOperation,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    unwindManager: RotaryUnwindManager
  ): StrategyGenerationOutput {
    const positions: FourAxisToolPosition[] = [];
    const segments: FourAxisToolpathSegment[] = [];
    const indexAngleDeg = operation.fixedIndexAngleDeg ?? 0;
    const toolDiam = operation.tool.diameterMm;
    const clearanceZ = operation.clearancePlaneZMm ?? (wcs.wrapRadiusMm + 25);
    const retractZ = operation.retractPlaneZMm ?? (wcs.wrapRadiusMm + 10);
    const cutDepth = operation.slotDepthMm ?? 5.0;
    const axialStep = Math.max(0.5, operation.axialStepdownMm);

    // 1. Initial Rapid to Safe Retract Height at current angle
    const startAngle = unwindManager.getCurrentAngle();
    const pos1 = this.createPosition(
      { x: 0, y: 0, z: clearanceZ },
      startAngle,
      machine,
      wcs,
      MotionType.RAPID,
      machine.maxRapidFeedMmMin,
      operation.spindleRpm,
      operation.coolant,
      operation.id,
      positions.length
    );
    positions.push(pos1);

    // 2. Rotary Index Motion to target indexAngleDeg
    const unwind = unwindManager.processAngle(indexAngleDeg, machine, true);
    const pos2 = this.createPosition(
      { x: 0, y: 0, z: clearanceZ },
      unwind.unwoundAngleDeg,
      machine,
      wcs,
      MotionType.RAPID,
      machine.maxRapidFeedMmMin,
      operation.spindleRpm,
      operation.coolant,
      operation.id,
      positions.length
    );
    positions.push(pos2);
    segments.push(this.createSegment(pos1, pos2, machine, wcs.wrapRadiusMm, operation.tool.diameterMm, operation.id, false));

    // 3. Generate 3-Axis Planar Pocket/Profile on the indexed plane
    const xMin = -20;
    const xMax = 20;
    const yMin = -15;
    const yMax = 15;
    const stepover = operation.radialStepoverMm || (toolDiam * 0.6);

    let currentZ = wcs.wrapRadiusMm;
    const targetZ = wcs.wrapRadiusMm - cutDepth;

    while (currentZ > targetZ - 1e-4) {
      currentZ = Math.max(targetZ, currentZ - axialStep);

      // Rapid to start of pocket pass
      const pRapid = this.createPosition(
        { x: xMin, y: yMin, z: retractZ },
        unwind.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRapid, machine, wcs.wrapRadiusMm, toolDiam, operation.id, false));
      positions.push(pRapid);

      // Plunge to current Z
      const pPlunge = this.createPosition(
        { x: xMin, y: yMin, z: currentZ },
        unwind.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.PLUNGE,
        operation.plungeFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pPlunge, machine, wcs.wrapRadiusMm, toolDiam, operation.id, true));
      positions.push(pPlunge);

      // Raster cutting passes in indexed plane
      let y = yMin;
      let forward = true;
      while (y <= yMax + 1e-4) {
        const xTarget = forward ? xMax : xMin;
        const pCut = this.createPosition(
          { x: xTarget, y, z: currentZ },
          unwind.unwoundAngleDeg,
          machine,
          wcs,
          MotionType.FEED,
          operation.cuttingFeedMmMin,
          operation.spindleRpm,
          operation.coolant,
          operation.id,
          positions.length
        );
        segments.push(this.createSegment(positions[positions.length - 1], pCut, machine, wcs.wrapRadiusMm, toolDiam, operation.id, true));
        positions.push(pCut);

        y += stepover;
        if (y <= yMax + 1e-4) {
          const pStep = this.createPosition(
            { x: xTarget, y, z: currentZ },
            unwind.unwoundAngleDeg,
            machine,
            wcs,
            MotionType.FEED,
            operation.cuttingFeedMmMin,
            operation.spindleRpm,
            operation.coolant,
            operation.id,
            positions.length
          );
          segments.push(this.createSegment(positions[positions.length - 1], pStep, machine, wcs.wrapRadiusMm, toolDiam, operation.id, true));
          positions.push(pStep);
        }
        forward = !forward;
      }

      // Retract back to retract plane
      const pRet = this.createPosition(
        { x: positions[positions.length - 1].x, y: positions[positions.length - 1].y, z: retractZ },
        unwind.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.RETRACT,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRet, machine, wcs.wrapRadiusMm, toolDiam, operation.id, false));
      positions.push(pRet);
    }

    return this.compileOutput(positions, segments);
  }

  /**
   * 2. WRAPPED SLOT STRATEGY (Simultaneous 4-Axis):
   * Generates a slot mapped onto a cylindrical surface, with continuous 4th axis rotation and linear X translation.
   * Supports helical / spiral slots or circumferential slots around the cylinder.
   */
  public static generateWrappedSlot(
    operation: FourAxisOperation,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    unwindManager: RotaryUnwindManager
  ): StrategyGenerationOutput {
    const positions: FourAxisToolPosition[] = [];
    const segments: FourAxisToolpathSegment[] = [];
    const radius = operation.cylinderRadiusMm ?? wcs.wrapRadiusMm;
    const slotDepth = operation.slotDepthMm ?? 4.0;
    const axialStep = Math.max(0.5, operation.axialStepdownMm);
    const angularStart = operation.angularRangeDeg ? operation.angularRangeDeg[0] : 0;
    const angularEnd = operation.angularRangeDeg ? operation.angularRangeDeg[1] : 360;
    const xStart = operation.axialRangeMm ? operation.axialRangeMm[0] : 0;
    const xEnd = operation.axialRangeMm ? operation.axialRangeMm[1] : 40;
    const clearanceR = radius + (operation.safeRetractRadiusMm ?? 15);
    const retractR = radius + 5;
    const toolDiam = operation.tool.diameterMm;

    let currentDepth = 0;
    const numSubDivisions = Math.max(24, Math.ceil(Math.abs(angularEnd - angularStart) / 5.0));

    // Rapid to safe clearance above start point
    const mapStart = FourAxisKinematics.mapPlanarToCylindrical(xStart, (angularStart * Math.PI * radius) / 180, -15, radius, machine.rotaryAxisLetter);
    const unwoundInit = unwindManager.processAngle(mapStart.rotaryAngleDeg, machine, true);

    const posInit = this.createPosition(
      { x: xStart, y: 0, z: clearanceR },
      unwoundInit.unwoundAngleDeg,
      machine,
      wcs,
      MotionType.RAPID,
      machine.maxRapidFeedMmMin,
      operation.spindleRpm,
      operation.coolant,
      operation.id,
      positions.length
    );
    positions.push(posInit);

    while (currentDepth < slotDepth - 1e-4) {
      currentDepth = Math.min(slotDepth, currentDepth + axialStep);

      // Rapid to start angle at retract height
      const pRet = this.createPosition(
        { x: xStart, y: 0, z: retractR },
        unwoundInit.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRet, machine, radius, toolDiam, operation.id, false));
      positions.push(pRet);

      // Plunge to current cutting depth
      const cutRadius = radius - currentDepth;
      const pPlunge = this.createPosition(
        { x: xStart, y: 0, z: cutRadius },
        unwoundInit.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.PLUNGE,
        operation.plungeFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pPlunge, machine, radius, toolDiam, operation.id, true));
      positions.push(pPlunge);

      // Simultaneous cutting motion along helix/slot
      for (let i = 1; i <= numSubDivisions; i++) {
        const u = i / numSubDivisions;
        const curAngle = angularStart + u * (angularEnd - angularStart);
        const curX = xStart + u * (xEnd - xStart);

        const unwound = unwindManager.processAngle(curAngle, machine, true);

        const pCut = this.createPosition(
          { x: curX, y: 0, z: cutRadius },
          unwound.unwoundAngleDeg,
          machine,
          wcs,
          MotionType.FEED,
          operation.cuttingFeedMmMin,
          operation.spindleRpm,
          operation.coolant,
          operation.id,
          positions.length
        );
        segments.push(this.createSegment(positions[positions.length - 1], pCut, machine, radius, toolDiam, operation.id, true));
        positions.push(pCut);
      }

      // Retract back to retract radius
      const lastX = xEnd;
      const lastAngle = unwindManager.getCurrentAngle();
      const pEndRet = this.createPosition(
        { x: lastX, y: 0, z: retractR },
        lastAngle,
        machine,
        wcs,
        MotionType.RETRACT,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pEndRet, machine, radius, toolDiam, operation.id, false));
      positions.push(pEndRet);
    }

    return this.compileOutput(positions, segments);
  }

  /**
   * 3. ROTARY CONTOUR STRATEGY (Simultaneous 4-Axis):
   * Continuous cylindrical profile contouring around the workpiece with axial stepover.
   */
  public static generateRotaryContour(
    operation: FourAxisOperation,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    unwindManager: RotaryUnwindManager
  ): StrategyGenerationOutput {
    const positions: FourAxisToolPosition[] = [];
    const segments: FourAxisToolpathSegment[] = [];
    const radius = operation.cylinderRadiusMm ?? wcs.wrapRadiusMm;
    const xMin = operation.axialRangeMm ? operation.axialRangeMm[0] : 0;
    const xMax = operation.axialRangeMm ? operation.axialRangeMm[1] : 50;
    const stepoverMm = operation.radialStepoverMm || (operation.tool.diameterMm * 0.4);
    const cutRadius = radius - (operation.slotDepthMm ?? 1.5);
    const clearanceR = radius + 15;
    const retractR = radius + 5;
    const toolDiam = operation.tool.diameterMm;

    // Rapid to safe start
    const initUnwind = unwindManager.processAngle(0, machine, true);
    const p0 = this.createPosition(
      { x: xMin, y: 0, z: clearanceR },
      initUnwind.unwoundAngleDeg,
      machine,
      wcs,
      MotionType.RAPID,
      machine.maxRapidFeedMmMin,
      operation.spindleRpm,
      operation.coolant,
      operation.id,
      positions.length
    );
    positions.push(p0);

    let curX = xMin;
    const numRotarySteps = 48; // 7.5 degree increments for smooth contouring

    while (curX <= xMax + 1e-4) {
      // Rapid to start of contour ring
      const pRingStart = this.createPosition(
        { x: curX, y: 0, z: retractR },
        unwindManager.getCurrentAngle(),
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRingStart, machine, radius, toolDiam, operation.id, false));
      positions.push(pRingStart);

      // Plunge to cutting depth
      const pRingPlunge = this.createPosition(
        { x: curX, y: 0, z: cutRadius },
        unwindManager.getCurrentAngle(),
        machine,
        wcs,
        MotionType.PLUNGE,
        operation.plungeFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRingPlunge, machine, radius, toolDiam, operation.id, true));
      positions.push(pRingPlunge);

      // Continuous 360 degree rotation pass
      const baseAngle = unwindManager.getCurrentAngle();
      for (let s = 1; s <= numRotarySteps; s++) {
        const targetAngle = baseAngle + (s / numRotarySteps) * 360.0;
        const un = unwindManager.processAngle(targetAngle, machine, true);

        const pRingCut = this.createPosition(
          { x: curX, y: 0, z: cutRadius },
          un.unwoundAngleDeg,
          machine,
          wcs,
          MotionType.FEED,
          operation.cuttingFeedMmMin,
          operation.spindleRpm,
          operation.coolant,
          operation.id,
          positions.length
        );
        segments.push(this.createSegment(positions[positions.length - 1], pRingCut, machine, radius, toolDiam, operation.id, true));
        positions.push(pRingCut);
      }

      // Retract
      const pRingRet = this.createPosition(
        { x: curX, y: 0, z: retractR },
        unwindManager.getCurrentAngle(),
        machine,
        wcs,
        MotionType.RETRACT,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRingRet, machine, radius, toolDiam, operation.id, false));
      positions.push(pRingRet);

      curX += stepoverMm;
    }

    return this.compileOutput(positions, segments);
  }

  /**
   * 4. INDEXED HOLE DRILLING STRATEGY:
   * Groups radial holes around cylinder, indexes 4th axis perpendicular to each hole axis, and executes G83 peck drilling.
   */
  public static generateIndexedHoleDrilling(
    operation: FourAxisOperation,
    radialHoles: { x: number; angleDeg: number; depthMm: number; diameterMm: number }[],
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    unwindManager: RotaryUnwindManager
  ): StrategyGenerationOutput {
    const positions: FourAxisToolPosition[] = [];
    const segments: FourAxisToolpathSegment[] = [];
    const radius = operation.cylinderRadiusMm ?? wcs.wrapRadiusMm;
    const clearanceR = radius + 15;
    const retractR = radius + 3;
    const toolDiam = operation.tool.diameterMm;

    // Initial safe position
    const pInit = this.createPosition(
      { x: 0, y: 0, z: clearanceR },
      unwindManager.getCurrentAngle(),
      machine,
      wcs,
      MotionType.RAPID,
      machine.maxRapidFeedMmMin,
      operation.spindleRpm,
      operation.coolant,
      operation.id,
      positions.length
    );
    positions.push(pInit);

    for (const hole of radialHoles) {
      // 1. Retract to clearance
      const pClear = this.createPosition(
        { x: hole.x, y: 0, z: clearanceR },
        unwindManager.getCurrentAngle(),
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pClear, machine, radius, toolDiam, operation.id, false));
      positions.push(pClear);

      // 2. Rotary Index to hole angle
      const un = unwindManager.processAngle(hole.angleDeg, machine, true);
      const pIndex = this.createPosition(
        { x: hole.x, y: 0, z: clearanceR },
        un.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pIndex, machine, radius, toolDiam, operation.id, false));
      positions.push(pIndex);

      // 3. Move to Hole Retract Plane
      const pRet = this.createPosition(
        { x: hole.x, y: 0, z: retractR },
        un.unwoundAngleDeg,
        machine,
        wcs,
        MotionType.RAPID,
        machine.maxRapidFeedMmMin,
        operation.spindleRpm,
        operation.coolant,
        operation.id,
        positions.length
      );
      segments.push(this.createSegment(positions[positions.length - 1], pRet, machine, radius, toolDiam, operation.id, false));
      positions.push(pRet);

      // 4. Peck Drilling Cycle (Peck depth = 1.5 * tool diameter)
      const peckIncrement = Math.max(1.0, toolDiam * 1.2);
      let curHoleDepth = 0;
      const targetDepth = hole.depthMm;

      while (curHoleDepth < targetDepth - 1e-4) {
        curHoleDepth = Math.min(targetDepth, curHoleDepth + peckIncrement);
        const drillZ = radius - curHoleDepth;

        // Drill In
        const pDrill = this.createPosition(
          { x: hole.x, y: 0, z: drillZ },
          un.unwoundAngleDeg,
          machine,
          wcs,
          MotionType.PLUNGE,
          operation.plungeFeedMmMin,
          operation.spindleRpm,
          operation.coolant,
          operation.id,
          positions.length
        );
        segments.push(this.createSegment(positions[positions.length - 1], pDrill, machine, radius, toolDiam, operation.id, true));
        positions.push(pDrill);

        // Chip Clear Retract
        const pChipClear = this.createPosition(
          { x: hole.x, y: 0, z: retractR },
          un.unwoundAngleDeg,
          machine,
          wcs,
          MotionType.RETRACT,
          machine.maxRapidFeedMmMin,
          operation.spindleRpm,
          operation.coolant,
          operation.id,
          positions.length
        );
        segments.push(this.createSegment(positions[positions.length - 1], pChipClear, machine, radius, toolDiam, operation.id, false));
        positions.push(pChipClear);
      }
    }

    return this.compileOutput(positions, segments);
  }

  /**
   * Helper: Create discrete Tool Position with forward kinematic transforms
   */
  private static createPosition(
    partPoint: Vector3D,
    rotaryAngleDeg: number,
    machine: FourAxisMachineModel,
    wcs: RotaryCoordinateSystem,
    motionType: MotionType,
    feedMmMin: number,
    spindleRpm: number,
    coolant: CoolantState,
    opId: string,
    segmentIndex: number
  ): FourAxisToolPosition {
    const machPos = FourAxisKinematics.forwardKinematics(partPoint, rotaryAngleDeg, machine, wcs);

    return {
      x: machPos.x,
      y: machPos.y,
      z: machPos.z,
      rotaryAngleDeg,
      rotaryAxisLetter: machine.rotaryAxisLetter,
      toolVector: { x: 0, y: 0, z: 1 },
      partContactPoint: partPoint,
      surfaceNormal: { x: 0, y: 0, z: 1 },
      feedMmMin,
      rotaryFeedDegMin: 0,
      feedrateMode: FeedrateMode.UNITS_PER_MINUTE,
      spindleRpm,
      motionType,
      coolant,
      segmentIndex,
      operationId: opId,
    };
  }

  /**
   * Helper: Create Segment with Feed & Dynamics calculation
   */
  private static createSegment(
    startPos: FourAxisToolPosition,
    endPos: FourAxisToolPosition,
    machine: FourAxisMachineModel,
    wrapRadiusMm: number,
    toolDiameterMm: number,
    opId: string,
    isCutting: boolean
  ): FourAxisToolpathSegment {
    const isRapid = startPos.motionType === MotionType.RAPID || endPos.motionType === MotionType.RAPID || endPos.motionType === MotionType.RETRACT;
    const feedRes = FourAxisFeedCalculator.calculateSegmentFeed(
      startPos,
      endPos,
      startPos.rotaryAngleDeg,
      endPos.rotaryAngleDeg,
      endPos.feedMmMin,
      endPos.spindleRpm,
      toolDiameterMm,
      wrapRadiusMm,
      machine,
      isRapid
    );

    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const dz = endPos.z - startPos.z;
    const lengthMm = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const angularTravelDeg = Math.abs(endPos.rotaryAngleDeg - startPos.rotaryAngleDeg);
    const isSimultaneous = angularTravelDeg > 1e-4 && lengthMm > 1e-4;

    endPos.rotaryFeedDegMin = feedRes.rotaryFeedDegMin;
    endPos.feedrateMode = feedRes.feedrateMode;

    return {
      id: `SEG_${opId}_${endPos.segmentIndex}`,
      startPoint: startPos,
      endPoint: endPos,
      motionType: endPos.motionType,
      feedMmMin: feedRes.linearFeedMmMin,
      rotaryFeedDegMin: feedRes.rotaryFeedDegMin,
      feedrateMode: feedRes.feedrateMode,
      spindleRpm: endPos.spindleRpm,
      lengthMm,
      angularTravelDeg,
      estimatedTimeSec: feedRes.segmentDurationSec,
      isCutting,
      isSimultaneousRotary: isSimultaneous,
      operationMode: isSimultaneous ? 'SIMULTANEOUS_4AXIS' : 'INDEXED_4AXIS',
    };
  }

  private static compileOutput(
    positions: FourAxisToolPosition[],
    segments: FourAxisToolpathSegment[]
  ): StrategyGenerationOutput {
    let totalLengthMm = 0;
    let totalRotaryTravelDeg = 0;
    let rapidTimeSec = 0;
    let cuttingTimeSec = 0;

    for (const seg of segments) {
      totalLengthMm += seg.lengthMm;
      totalRotaryTravelDeg += seg.angularTravelDeg;
      if (seg.isCutting) {
        cuttingTimeSec += seg.estimatedTimeSec;
      } else {
        rapidTimeSec += seg.estimatedTimeSec;
      }
    }

    return {
      positions,
      segments,
      totalLengthMm,
      totalRotaryTravelDeg,
      estimatedMachiningTimeSec: rapidTimeSec + cuttingTimeSec,
      rapidTimeSec,
      cuttingTimeSec,
    };
  }
}
