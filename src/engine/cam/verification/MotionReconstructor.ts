/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Motion Reconstructor
 * 
 * Reconstructs continuous Machine Motion Sequences (Rapid, Linear, Arcs, Rotary, Canned Cycles)
 * from tokenized NC blocks and modal states. Performs geometric arc validation, absolute/incremental
 * resolution, feed-time estimation, and axis extent tracking.
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisMachinePose } from '../fiveaxis/FiveAxisTypes';
import { NCBlockTokens, NCExecutionState, MachineCoordinates, MachineMotionStep, MachineMotionSequence, VerificationIssue, VerificationTolerances, DEFAULT_VERIFICATION_TOLERANCES } from './GCodeVerificationTypes';
import { ModalStateTracker } from './ModalStateTracker';
import { GCodeTokenizer } from './GCodeTokenizer';

export class MotionReconstructor {
  /**
   * Reconstruct motion steps from tokenized NC blocks
   */
  public static reconstruct(
    blocks: NCBlockTokens[],
    modalTracker: ModalStateTracker,
    tolerances: VerificationTolerances = DEFAULT_VERIFICATION_TOLERANCES,
    issues: VerificationIssue[]
  ): MachineMotionSequence {
    const steps: MachineMotionStep[] = [];
    let currentPos: MachineCoordinates = { x: 0, y: 0, z: 0, a: 0, b: 0, c: 0 };
    let currentToolVector: Vector3D = { x: 0, y: 0, z: 1 };

    let totalDist = 0;
    let totalCuttingDist = 0;
    let totalRapidDist = 0;
    let totalTimeSec = 0;
    let totalCuttingTimeSec = 0;
    let totalRapidTimeSec = 0;
    let toolChangesCount = 0;
    const toolsUsedSet = new Set<number>();

    const bounds = {
      minX: Infinity, maxX: -Infinity,
      minY: Infinity, maxY: -Infinity,
      minZ: Infinity, maxZ: -Infinity,
      minA: Infinity, maxA: -Infinity,
      minB: Infinity, maxB: -Infinity,
      minC: Infinity, maxC: -Infinity
    };

    const updateBounds = (pos: MachineCoordinates) => {
      bounds.minX = Math.min(bounds.minX, pos.x);
      bounds.maxX = Math.max(bounds.maxX, pos.x);
      bounds.minY = Math.min(bounds.minY, pos.y);
      bounds.maxY = Math.max(bounds.maxY, pos.y);
      bounds.minZ = Math.min(bounds.minZ, pos.z);
      bounds.maxZ = Math.max(bounds.maxZ, pos.z);
      bounds.minA = Math.min(bounds.minA, pos.a);
      bounds.maxA = Math.max(bounds.maxA, pos.a);
      bounds.minB = Math.min(bounds.minB, pos.b);
      bounds.maxB = Math.max(bounds.maxB, pos.b);
      bounds.minC = Math.min(bounds.minC, pos.c);
      bounds.maxC = Math.max(bounds.maxC, pos.c);
    };

    updateBounds(currentPos);

    let stepIndex = 1;

    for (const block of blocks) {
      if (block.isEmpty || block.isCommentOnly) {
        continue;
      }

      // Update modal state for this block
      const state = modalTracker.updateWithBlock(block, issues);
      toolsUsedSet.add(state.activeToolNumber);

      // Check tool change
      const mCodes = block.wordsMap.get('M') || [];
      if (mCodes.includes(6)) {
        toolChangesCount++;
        steps.push({
          stepIndex: stepIndex++,
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawText: block.rawText,
          motionType: 'TOOL_CHANGE',
          startPoint: { ...currentPos },
          endPoint: { ...currentPos },
          distanceMm: 0,
          rotaryDistanceDeg: 0,
          feedRate: 0,
          spindleRpm: state.spindleRpm,
          estimatedDurationSec: 4.0, // default tool change time
          isCutting: false,
          isRapid: false,
          toolNumber: state.activeToolNumber,
          toolSnapshotId: state.activeToolId
        });
        totalTimeSec += 4.0;
      }

      // Dwell command (G04)
      const gCodes = block.wordsMap.get('G') || [];
      if (gCodes.includes(4)) {
        const pVal = GCodeTokenizer.getFirstWordValue(block, 'P') || GCodeTokenizer.getFirstWordValue(block, 'X') || 0;
        steps.push({
          stepIndex: stepIndex++,
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawText: block.rawText,
          motionType: 'DWELL',
          startPoint: { ...currentPos },
          endPoint: { ...currentPos },
          distanceMm: 0,
          rotaryDistanceDeg: 0,
          feedRate: 0,
          spindleRpm: state.spindleRpm,
          estimatedDurationSec: pVal > 0 ? (pVal > 100 ? pVal / 1000 : pVal) : 0.5,
          isCutting: false,
          isRapid: false,
          toolNumber: state.activeToolNumber,
          toolSnapshotId: state.activeToolId
        });
        continue;
      }

      // Extract Target Coordinates
      const xVal = GCodeTokenizer.getFirstWordValue(block, 'X');
      const yVal = GCodeTokenizer.getFirstWordValue(block, 'Y');
      const zVal = GCodeTokenizer.getFirstWordValue(block, 'Z');
      const aVal = GCodeTokenizer.getFirstWordValue(block, 'A');
      const bVal = GCodeTokenizer.getFirstWordValue(block, 'B');
      const cVal = GCodeTokenizer.getFirstWordValue(block, 'C');

      const hasMovement = xVal !== null || yVal !== null || zVal !== null || aVal !== null || bVal !== null || cVal !== null;

      if (!hasMovement && !state.cycleActive) {
        continue;
      }

      // Calculate Target Position (Absolute vs Incremental)
      const isAbsolute = state.distanceMode === 'G90_ABSOLUTE';
      const targetPos: MachineCoordinates = {
        x: xVal !== null ? (isAbsolute ? xVal : currentPos.x + xVal) : currentPos.x,
        y: yVal !== null ? (isAbsolute ? yVal : currentPos.y + yVal) : currentPos.y,
        z: zVal !== null ? (isAbsolute ? zVal : currentPos.z + zVal) : currentPos.z,
        a: aVal !== null ? (isAbsolute ? aVal : currentPos.a + aVal) : currentPos.a,
        b: bVal !== null ? (isAbsolute ? bVal : currentPos.b + bVal) : currentPos.b,
        c: cVal !== null ? (isAbsolute ? cVal : currentPos.c + cVal) : currentPos.c
      };

      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const dz = targetPos.z - currentPos.z;
      const da = Math.abs(targetPos.a - currentPos.a);
      const db = Math.abs(targetPos.b - currentPos.b);
      const dc = Math.abs(targetPos.c - currentPos.c);

      const linearDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const rotaryDist = Math.max(da, db, dc);

      // Handle Canned Drilling Cycles
      if (state.cycleActive && state.cycleType) {
        const rClearance = GCodeTokenizer.getFirstWordValue(block, 'R') ?? (targetPos.z + 5.0);
        const zBottom = zVal !== null ? (isAbsolute ? zVal : currentPos.z + zVal) : currentPos.z;

        // Cycle Plunge Move
        const plungeStep: MachineMotionStep = {
          stepIndex: stepIndex++,
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawText: `${block.rawText} [CYCLE PLUNGE]`,
          motionType: 'CANNED_CYCLE_PLUNGE',
          startPoint: { ...currentPos, x: targetPos.x, y: targetPos.y, z: rClearance },
          endPoint: { ...targetPos, z: zBottom },
          distanceMm: Math.abs(rClearance - zBottom),
          rotaryDistanceDeg: 0,
          feedRate: state.feedRate,
          spindleRpm: state.spindleRpm,
          estimatedDurationSec: (Math.abs(rClearance - zBottom) / Math.max(state.feedRate, 10)) * 60,
          isCutting: true,
          isRapid: false,
          toolNumber: state.activeToolNumber,
          toolSnapshotId: state.activeToolId
        };
        steps.push(plungeStep);
        totalCuttingDist += plungeStep.distanceMm;
        totalDist += plungeStep.distanceMm;
        totalCuttingTimeSec += plungeStep.estimatedDurationSec;
        totalTimeSec += plungeStep.estimatedDurationSec;

        // Cycle Retract Move
        const retractStep: MachineMotionStep = {
          stepIndex: stepIndex++,
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawText: `${block.rawText} [CYCLE RETRACT]`,
          motionType: 'CANNED_CYCLE_RETRACT',
          startPoint: { ...targetPos, z: zBottom },
          endPoint: { ...targetPos, z: rClearance },
          distanceMm: Math.abs(rClearance - zBottom),
          rotaryDistanceDeg: 0,
          feedRate: 15000,
          spindleRpm: state.spindleRpm,
          estimatedDurationSec: (Math.abs(rClearance - zBottom) / 15000) * 60,
          isCutting: false,
          isRapid: true,
          toolNumber: state.activeToolNumber,
          toolSnapshotId: state.activeToolId
        };
        steps.push(retractStep);
        totalRapidDist += retractStep.distanceMm;
        totalDist += retractStep.distanceMm;
        totalRapidTimeSec += retractStep.estimatedDurationSec;
        totalTimeSec += retractStep.estimatedDurationSec;

        currentPos = { ...targetPos, z: rClearance };
        modalTracker.setPosition(currentPos);
        updateBounds(currentPos);
        continue;
      }

      // Handle Circular Arcs (G2 / G3)
      if (state?.motionMode === 'G2_CW_ARC' || state?.motionMode === 'G3_CCW_ARC') {
        const isCW = state?.motionMode === 'G2_CW_ARC';
        const iVal = GCodeTokenizer.getFirstWordValue(block, 'I');
        const jVal = GCodeTokenizer.getFirstWordValue(block, 'J');
        const kVal = GCodeTokenizer.getFirstWordValue(block, 'K');
        const rVal = GCodeTokenizer.getFirstWordValue(block, 'R');

        let center: Vector3D = { x: 0, y: 0, z: 0 };
        let radius = 0;
        let arcValid = true;

        if (iVal !== null || jVal !== null || kVal !== null) {
          // Center specified via IJK offsets from start point
          const iOffset = iVal || 0;
          const jOffset = jVal || 0;
          const kOffset = kVal || 0;

          center = {
            x: currentPos.x + iOffset,
            y: currentPos.y + jOffset,
            z: currentPos.z + kOffset
          };

          const rStart = Math.sqrt(
            Math.pow(currentPos.x - center.x, 2) +
            Math.pow(currentPos.y - center.y, 2) +
            Math.pow(currentPos.z - center.z, 2)
          );

          const rEnd = Math.sqrt(
            Math.pow(targetPos.x - center.x, 2) +
            Math.pow(targetPos.y - center.y, 2) +
            Math.pow(targetPos.z - center.z, 2)
          );

          radius = rStart;

          // Arc geometry consistency check
          const radiusDiff = Math.abs(rStart - rEnd);
          if (radiusDiff > tolerances.arcRadiusToleranceMm) {
            arcValid = false;
            issues.push({
              id: `ISSUE-ARC-${issues.length + 1}`,
              code: 'INVALID_ARC_GEOMETRY',
              severity: 'ERROR',
              lineIndex: block.lineIndex,
              sequenceNumber: block.sequenceNumber,
              rawGCode: block.rawText,
              message: `Arc start radius (${rStart.toFixed(4)}mm) and end radius (${rEnd.toFixed(4)}mm) differ by ${radiusDiff.toFixed(4)}mm (limit ${tolerances.arcRadiusToleranceMm}mm).`,
              recommendation: `Check post-processor arc center formatting and numerical precision.`
            });
          }
        } else if (rVal !== null) {
          // R-format arc
          radius = Math.abs(rVal);
          const chord = Math.sqrt(
            Math.pow(targetPos.x - currentPos.x, 2) +
            Math.pow(targetPos.y - currentPos.y, 2)
          );
          if (chord > 2 * radius + 1e-4) {
            arcValid = false;
            issues.push({
              id: `ISSUE-ARC-${issues.length + 1}`,
              code: 'INVALID_ARC_GEOMETRY',
              severity: 'ERROR',
              lineIndex: block.lineIndex,
              sequenceNumber: block.sequenceNumber,
              rawGCode: block.rawText,
              message: `Arc chord length (${chord.toFixed(3)}mm) exceeds maximum diameter (${(2 * radius).toFixed(3)}mm).`
            });
          }
        }

        const arcStep: MachineMotionStep = {
          stepIndex: stepIndex++,
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawText: block.rawText,
          motionType: isCW ? 'ARC_CW' : 'ARC_CCW',
          startPoint: { ...currentPos },
          endPoint: { ...targetPos },
          centerPoint: center,
          radius: radius > 0 ? radius : Math.max(linearDist / 2, 0.1),
          arcPlane: state.plane,
          arcNormal: { x: 0, y: 0, z: isCW ? -1 : 1 },
          distanceMm: linearDist,
          rotaryDistanceDeg: rotaryDist,
          feedRate: state.feedRate,
          spindleRpm: state.spindleRpm,
          estimatedDurationSec: (linearDist / Math.max(state.feedRate, 10)) * 60,
          isCutting: true,
          isRapid: false,
          toolNumber: state.activeToolNumber,
          toolSnapshotId: state.activeToolId
        };

        steps.push(arcStep);
        totalCuttingDist += linearDist;
        totalDist += linearDist;
        totalCuttingTimeSec += arcStep.estimatedDurationSec;
        totalTimeSec += arcStep.estimatedDurationSec;

        currentPos = { ...targetPos };
        modalTracker.setPosition(currentPos);
        updateBounds(currentPos);
        continue;
      }

      // Handle Linear (G1) and Rapid (G0) Moves
      const isRapid = state?.motionMode === 'G0_RAPID';
      const isCutting = !isRapid && linearDist > 1e-5;

      const motionType: MotionReconstructionType = isRapid 
        ? 'RAPID' 
        : (linearDist < 1e-5 && rotaryDist > 1e-4 ? 'ROTARY_ONLY' : 'LINEAR');

      const speed = isRapid ? 18000 : Math.max(state.feedRate, 10);
      const stepDurationSec = (linearDist / speed) * 60 + (rotaryDist / 3600) * 60;

      // Calculate tool orientation vector if rotary motion is present
      if (aVal !== null || bVal !== null || cVal !== null) {
        const radA = (targetPos.a * Math.PI) / 180;
        const radC = (targetPos.c * Math.PI) / 180;
        currentToolVector = {
          x: Math.sin(radA) * Math.sin(radC),
          y: Math.sin(radA) * Math.cos(radC),
          z: Math.cos(radA)
        };
      }

      const step: MachineMotionStep = {
        stepIndex: stepIndex++,
        lineIndex: block.lineIndex,
        sequenceNumber: block.sequenceNumber,
        rawText: block.rawText,
        motionType,
        startPoint: { ...currentPos },
        endPoint: { ...targetPos },
        toolVector: { ...currentToolVector },
        distanceMm: linearDist,
        rotaryDistanceDeg: rotaryDist,
        feedRate: isRapid ? 18000 : state.feedRate,
        spindleRpm: state.spindleRpm,
        estimatedDurationSec: stepDurationSec,
        isCutting,
        isRapid,
        toolNumber: state.activeToolNumber,
        toolSnapshotId: state.activeToolId
      };

      steps.push(step);
      totalDist += linearDist;
      if (isCutting) {
        totalCuttingDist += linearDist;
        totalCuttingTimeSec += stepDurationSec;
      } else if (isRapid) {
        totalRapidDist += linearDist;
        totalRapidTimeSec += stepDurationSec;
      }
      totalTimeSec += stepDurationSec;

      currentPos = { ...targetPos };
      modalTracker.setPosition(currentPos);
      modalTracker.setToolOrientation(currentToolVector);
      updateBounds(currentPos);
    }

    // Clean up empty bounds
    if (bounds.minX === Infinity) {
      bounds.minX = 0; bounds.maxX = 0;
      bounds.minY = 0; bounds.maxY = 0;
      bounds.minZ = 0; bounds.maxZ = 0;
      bounds.minA = 0; bounds.maxA = 0;
      bounds.minB = 0; bounds.maxB = 0;
      bounds.minC = 0; bounds.maxC = 0;
    }

    return {
      steps,
      totalDistanceMm: totalDist,
      totalCuttingDistanceMm: totalCuttingDist,
      totalRapidDistanceMm: totalRapidDist,
      totalEstimatedTimeSec: totalTimeSec,
      totalCuttingTimeSec,
      totalRapidTimeSec,
      bounds,
      toolChangesCount,
      toolsUsed: Array.from(toolsUsedSet)
    };
  }
}
