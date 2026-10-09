/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Multi-Body Contact Classifier & Avoidance Advisor
 */

import { Vector3D } from '../../cadKernel';
import {
  CollisionIncident,
  CollisionIncidentSeverity,
  CollisionIncidentType,
  CollisionSeverityState,
  DetectionMode,
  HolderGeometry,
  ToolGeometry,
  ToolPose
} from './CollisionTypes';
import { NarrowPhaseResult } from './NarrowPhaseDetector';

export class CollisionClassifier {
  public static classifyContact(
    segmentIndex: number,
    normalizedTime: number,
    pose: ToolPose,
    tool: ToolGeometry,
    holder: HolderGeometry,
    narrowResult: NarrowPhaseResult,
    isFixtureHit: boolean = false,
    detectionMode: DetectionMode = 'EXACT'
  ): CollisionIncident {
    let type: CollisionIncidentType = 'NO_COLLISION';
    let severity: CollisionIncidentSeverity = 'INFO';
    let state: CollisionSeverityState = 'CLEAR';
    let description = 'Nominal motion';

    const incidentId = `INC_${segmentIndex}_${Math.floor(normalizedTime * 1000)}`;

    if (isFixtureHit) {
      type = 'FIXTURE_COLLISION';
      severity = 'CRITICAL';
      state = 'COLLISION';
      description = `Critical keep-out collision with fixture/workholding clamping system (penetration: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
    } else if (narrowResult.hasContact) {
      switch (narrowResult.contactingSegment) {
        case 'HOLDER_LOWER':
        case 'HOLDER_UPPER':
          type = 'HOLDER_COLLISION';
          severity = 'CRITICAL';
          state = 'COLLISION';
          description = `Catastrophic collision between toolholder profile and workpiece boundary (penetration: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
          break;
        case 'SPINDLE':
          type = 'SPINDLE_COLLISION';
          severity = 'CRITICAL';
          state = 'COLLISION';
          description = `Severe machine spindle housing crash against part (penetration: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
          break;
        case 'SHANK':
          type = 'TOOL_COLLISION';
          severity = 'CRITICAL';
          state = 'COLLISION';
          description = `Non-cutting tool shank rub/collision with vertical workpiece boundary (penetration: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
          break;
        case 'CUTTER':
          if (pose.motionType === 'RAPID') {
            type = 'TOOL_COLLISION';
            severity = 'CRITICAL';
            state = 'COLLISION';
            description = `Fatal rapid feed plunge into stock or part body (penetration: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
          } else {
            type = 'STOCK_CONTACT';
            severity = 'INFO';
            state = 'CLEAR';
            description = `Nominal material engagement along cutting edge (depth: ${narrowResult.penetrationDepthMm.toFixed(3)}mm)`;
          }
          break;
        default:
          type = 'TOOL_COLLISION';
          severity = 'CRITICAL';
          state = 'COLLISION';
          description = `Collision detected at contact point`;
      }
    } else if (narrowResult.clearanceMm < 2.0 && narrowResult.clearanceMm > 0) {
      type = 'CLEARANCE_VIOLATION';
      severity = 'WARNING';
      state = 'WARNING';
      description = `Proximity warning: clearance (${narrowResult.clearanceMm.toFixed(3)}mm) below warning threshold (2.000mm)`;
    }

    return {
      incidentId,
      segmentIndex,
      normalizedTime,
      type,
      severity,
      state,
      penetrationDepthMm: narrowResult.penetrationDepthMm,
      clearanceDistanceMm: narrowResult.clearanceMm,
      contactPointWCS: narrowResult.contactPointWCS,
      contactNormalWCS: narrowResult.contactNormal,
      collidingBodyA: isFixtureHit ? 'FIXTURE' : (narrowResult.contactingSegment === 'HOLDER_LOWER' || narrowResult.contactingSegment === 'HOLDER_UPPER' ? 'HOLDER' : (narrowResult.contactingSegment === 'SPINDLE' ? 'SPINDLE_HEAD' : 'TOOL_CUTTER')),
      collidingBodyB: isFixtureHit ? 'TOOL_CUTTER' : 'PART',
      toolPose: pose,
      description,
      isResolved: false
    };
  }
}

export interface AvoidanceRecommendation {
  incidentId: string;
  primaryAction: 'EXTEND_TOOL_STICKOUT' | 'RETRACT_CLEARANCE_PLANE' | 'MODIFY_ORIENTATION' | 'REPLACE_TOOL' | 'NONE';
  suggestedValue?: number;
  reasoning: string;
}

export class CollisionAvoidanceAdvisor {
  public static suggestAction(
    incident: CollisionIncident,
    tool: ToolGeometry,
    holder: HolderGeometry
  ): AvoidanceRecommendation {
    if (incident.type === 'HOLDER_COLLISION') {
      const minAdditionalStickout = incident.penetrationDepthMm + 3.0;
      const targetStickout = tool.stickoutMm + minAdditionalStickout;
      return {
        incidentId: incident.incidentId,
        primaryAction: 'EXTEND_TOOL_STICKOUT',
        suggestedValue: targetStickout,
        reasoning: `Extend tool stickout from ${tool.stickoutMm.toFixed(1)}mm to at least ${targetStickout.toFixed(1)}mm to prevent holder collision.`
      };
    }

    if (incident.type === 'FIXTURE_COLLISION') {
      return {
        incidentId: incident.incidentId,
        primaryAction: 'RETRACT_CLEARANCE_PLANE',
        suggestedValue: 25.0,
        reasoning: `Raise rapid clearance retract plane by 25mm to clear fixture clamps and avoid keep-out zone.`
      };
    }

    if (incident.type === 'TOOL_COLLISION' || incident.type === 'SPINDLE_COLLISION') {
      return {
        incidentId: incident.incidentId,
        primaryAction: 'MODIFY_ORIENTATION',
        suggestedValue: 15.0,
        reasoning: `Tilt tool axis away from the obstacle or part boundary to avoid collision.`
      };
    }

    return {
      incidentId: incident.incidentId,
      primaryAction: 'NONE',
      reasoning: 'No avoidance action needed for nominal conditions.'
    };
  }

  public static suggestModifications(collisionResult: any, toolpath: any) {
    return {
      suggestedToolLengthMm: 50,
      leadAngleAdjustmentDeg: 5,
      tiltAngleAdjustmentDeg: 3,
      safeRetractHeightMm: 25
    };
  }
}
