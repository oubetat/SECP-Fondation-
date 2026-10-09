/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — NC Intermediate Representation (IR) Builder
 * 
 * Converts CAM operations, toolpaths, kinematic poses, and tool snapshots into
 * a strictly typed, controller-independent Intermediate Representation before
 * translation to final machine G-code.
 */

import { NCIntermediateRepresentation, IREvent, IREventType, CoordinateSystemId, CoolantState, ActivePlane } from './PostTypes';
import { ToolSnapshot } from '../tool-library/ToolTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export interface CAMToolpathPoint {
  x: number;
  y: number;
  z: number;
  a?: number;
  b?: number;
  c?: number;
  feedRate?: number;
  isRapid?: boolean;
  segmentId?: string;
}

export interface CAMOperationData {
  operationId: string;
  operationName: string;
  toolNumber: number;
  toolSnapshot: ToolSnapshot;
  spindleRpm: number;
  spindleDirection: 'CW' | 'CCW';
  coolant: CoolantState;
  workOffset: CoordinateSystemId;
  points: CAMToolpathPoint[];
  useRTCP?: boolean;
  dwellSeconds?: number;
}

export class NCIntermediateRepresentationBuilder {
  /**
   * Constructs an IR from structured CAM operations
   */
  public static async buildIR(
    programId: string,
    programComment: string,
    operations: CAMOperationData[]
  ): Promise<NCIntermediateRepresentation> {
    const events: IREvent[] = [];
    const toolsUsedMap: Map<number, ToolSnapshot> = new Map();

    let totalMotionEvents = 0;
    let totalRapidDist = 0;
    let totalCutDist = 0;
    let lastPos: { x: number; y: number; z: number } | null = null;

    // 1. Program Header
    events.push({
      eventId: `EV_HEADER_${programId}`,
      type: 'PROGRAM_HEADER',
      commentText: programComment || `SECP INDUSTRIAL CAM POST — ${programId}`
    });

    // 2. Safety Block
    events.push({
      eventId: `EV_SAFETY_INIT`,
      type: 'SAFETY_BLOCK'
    });

    // 3. Process each CAM Operation
    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx];
      
      // Update snapshot with operation-specific tool number
      const snap = { ...op.toolSnapshot, toolNumber: op.toolNumber };
      toolsUsedMap.set(op.toolNumber, snap);

      // Operation Start Marker
      events.push({
        eventId: `EV_OP_START_${op.operationId}`,
        type: 'OPERATION_START',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName,
        commentText: `OPERATION ${opIdx + 1}: ${op.operationName} (T${op.toolNumber})`
      });

      // Tool Change
      events.push({
        eventId: `EV_TC_${op.operationId}`,
        type: 'TOOL_CHANGE',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName,
        toolNumber: op.toolNumber,
        toolSnapshot: snap
      });

      // Work Offset Select
      events.push({
        eventId: `EV_WCS_${op.operationId}`,
        type: 'WORK_OFFSET_SELECT',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName,
        workOffset: op.workOffset
      });

      // Spindle Command
      events.push({
        eventId: `EV_SPINDLE_${op.operationId}`,
        type: 'SPINDLE_COMMAND',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName,
        spindleRpm: op.spindleRpm,
        spindleDirection: op.spindleDirection
      });

      // Coolant Command
      events.push({
        eventId: `EV_COOLANT_${op.operationId}`,
        type: 'COOLANT_COMMAND',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName,
        coolant: op.coolant
      });

      // Enable RTCP if required
      if (op.useRTCP) {
        events.push({
          eventId: `EV_RTCP_ON_${op.operationId}`,
          type: 'RTCP_ENABLE',
          sourceOperationId: op.operationId,
          sourceOperationName: op.operationName,
          toolNumber: op.toolNumber
        });
      }

      // Toolpath motion points
      for (let ptIdx = 0; ptIdx < op.points.length; ptIdx++) {
        const pt = op.points[ptIdx];
        const isRapid = pt.isRapid ?? false;
        const currentPos = { x: pt.x, y: pt.y, z: pt.z, a: pt.a, b: pt.b, c: pt.c };

        if (lastPos) {
          const dx = pt.x - lastPos.x;
          const dy = pt.y - lastPos.y;
          const dz = pt.z - lastPos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (isRapid) {
            totalRapidDist += dist;
          } else {
            totalCutDist += dist;
          }
        }
        lastPos = { x: pt.x, y: pt.y, z: pt.z };

        totalMotionEvents++;

        events.push({
          eventId: `EV_M_${op.operationId}_${ptIdx}`,
          type: isRapid ? 'RAPID_TRAVERSE' : 'LINEAR_FEED',
          sourceOperationId: op.operationId,
          sourceOperationName: op.operationName,
          sourceToolpathSegmentId: pt.segmentId ?? `SEG_${op.operationId}_${ptIdx}`,
          targetPosition: currentPos,
          feedRate: isRapid ? undefined : pt.feedRate,
          toolNumber: op.toolNumber,
          toolSnapshot: snap
        });
      }

      // Dwell if specified
      if (op.dwellSeconds && op.dwellSeconds > 0) {
        events.push({
          eventId: `EV_DWELL_${op.operationId}`,
          type: 'DWELL',
          sourceOperationId: op.operationId,
          sourceOperationName: op.operationName,
          dwellSeconds: op.dwellSeconds
        });
      }

      // Disable RTCP if was enabled
      if (op.useRTCP) {
        events.push({
          eventId: `EV_RTCP_OFF_${op.operationId}`,
          type: 'RTCP_DISABLE',
          sourceOperationId: op.operationId,
          sourceOperationName: op.operationName
        });
      }

      // Operation End Marker
      events.push({
        eventId: `EV_OP_END_${op.operationId}`,
        type: 'OPERATION_END',
        sourceOperationId: op.operationId,
        sourceOperationName: op.operationName
      });
    }

    // 4. Program Footer
    events.push({
      eventId: `EV_FOOTER_${programId}`,
      type: 'PROGRAM_FOOTER'
    });

    // Hash Calculation
    const irHash = await generateDeterministicHash({
      programId,
      eventsCount: events.length,
      toolsUsed: Array.from(toolsUsedMap.keys()),
      totalMotionEvents,
      totalRapidDist,
      totalCutDist,
      eventIdsSummary: events.map(e => `${e.type}:${e.eventId}`)
    });

    return {
      irId: `IR_${programId}`,
      programId,
      events,
      totalMotionEvents,
      totalRapidDistanceMm: Number(totalRapidDist.toFixed(3)),
      totalCuttingDistanceMm: Number(totalCutDist.toFixed(3)),
      toolsUsed: Array.from(toolsUsedMap.values()),
      timestamp: Date.now(),
      irHash
    };
  }
}
