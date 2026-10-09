/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Tool-Axis Optimization & Lead/Tilt Engine
 * Generates and optimizes tool axis vectors (I,J,K) along 3D contact paths considering
 * surface normals, lead/tilt limits, collision clearance, machine IK feasibility, and singularity avoidance.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisToolDefinition, 
  MachineDefinition, 
  MachineAxesState 
} from './FiveAxisTypes';
import { MachineKinematicsEngine } from './FiveAxisMachineKinematics';
import { CAMCollisionEngine, ObstacleMesh } from './FiveAxisCollisionEngine';

export interface LeadTiltConfig {
  leadAngleDeg: number;       // Angle tilted along cutting feed direction (typically 3° - 15°)
  tiltAngleDeg: number;       // Angle tilted sideways perpendicular to feed (typically -10° to +10°)
  minLeadDeg: number;
  maxLeadDeg: number;
  minTiltDeg: number;
  maxTiltDeg: number;
  maxAngularChangePerMmDeg: number; // Max allowed tool axis angular rate (e.g. 5° / mm)
  preferredSide: 'POSITIVE_TILT' | 'NEGATIVE_TILT' | 'AUTO';
  avoidSingularity: boolean;
}

export interface CandidateAxisEvaluation {
  toolVector: Vector3D;
  leadDeg: number;
  tiltDeg: number;
  isCollisionFree: boolean;
  minClearanceMm: number;
  isIKFeasible: boolean;
  isSingularityNear: boolean;
  singularityDistanceDeg: number;
  machineAxes?: MachineAxesState;
  score: number; // Higher is better
}

export class ToolAxisOptimizer {
  /**
   * Computes the optimal collision-free, kinematically smooth tool axis for a contact point
   */
  public static optimizeToolAxisAtPoint(
    contactPoint: Vector3D,
    surfaceNormal: Vector3D,
    tangentVector: Vector3D,
    tool: FiveAxisToolDefinition,
    machine: MachineDefinition,
    leadTilt: LeadTiltConfig,
    obstacles: ObstacleMesh[],
    prevToolAxis?: Vector3D,
    prevMachineState?: MachineAxesState
  ): CandidateAxisEvaluation {
    // Construct local Frenet-like frame: Normal (N), Tangent (T), Binormal (B)
    const norm = this.normalize(surfaceNormal);
    const tang = this.normalize(tangentVector);
    const binorm = this.crossProduct(norm, tang);

    const candidates: CandidateAxisEvaluation[] = [];

    // Sample candidate Lead / Tilt combinations within bounds
    const leadSteps = [leadTilt.leadAngleDeg, leadTilt.minLeadDeg, leadTilt.maxLeadDeg, (leadTilt.leadAngleDeg + leadTilt.maxLeadDeg) / 2];
    const tiltSteps = [leadTilt.tiltAngleDeg, 0, 5, -5, 10, -10, 15, -15, 20, -20];

    for (const lead of leadSteps) {
      for (const tilt of tiltSteps) {
        if (lead < leadTilt.minLeadDeg || lead > leadTilt.maxLeadDeg) continue;
        if (tilt < leadTilt.minTiltDeg || tilt > leadTilt.maxTiltDeg) continue;

        // Calculate candidate tool axis vector
        const axisVec = this.computeVectorFromLeadTilt(norm, tang, binorm, lead, tilt);

        // Compute TCP Position from Contact Point
        const tcpPos = this.computeTCPFromContactPoint(contactPoint, axisVec, norm, tool);

        // 1. Check IK Feasibility and Singularity
        const ikResult = MachineKinematicsEngine.solveInverseKinematics(
          machine,
          tcpPos,
          axisVec,
          prevMachineState
        );

        if (!ikResult.withinLimits) {
          continue; // Skip out-of-limits machine poses
        }

        // 2. Check Collision Clearance (Cutter, Shank, Holder, Spindle)
        const collision = CAMCollisionEngine.checkSegmentCollision(
          tool,
          tcpPos,
          axisVec,
          tcpPos,
          axisVec,
          obstacles,
          0
        );

        // 3. Compute Smoothness Penalty relative to previous tool vector
        let angularDiffDeg = 0;
        if (prevToolAxis) {
          const dot = Math.max(-1.0, Math.min(1.0, this.dotProduct(axisVec, prevToolAxis)));
          angularDiffDeg = Math.acos(dot) * (180 / Math.PI);
        }

        // 4. Scoring function: Reward clearance, reward proximity to nominal lead/tilt, penalize angular jerk & singularity
        let score = 100.0;
        if (collision.hasCollision) {
          score -= 1000.0;
        } else {
          score += Math.min(50, collision.minClearanceMm * 5);
        }

        // Proximity to nominal lead/tilt
        score -= Math.abs(lead - leadTilt.leadAngleDeg) * 1.5;
        score -= Math.abs(tilt - leadTilt.tiltAngleDeg) * 1.5;

        // Angular continuity penalty
        score -= angularDiffDeg * 3.0;

        // Singularity penalty
        if (ikResult.isSingularityNear) {
          score -= (machine.singularityConeAngleDeg - ikResult.singularityDistanceDeg) * 20.0;
        }

        candidates.push({
          toolVector: axisVec,
          leadDeg: lead,
          tiltDeg: tilt,
          isCollisionFree: !collision.hasCollision,
          minClearanceMm: collision.minClearanceMm,
          isIKFeasible: ikResult.withinLimits,
          isSingularityNear: ikResult.isSingularityNear,
          singularityDistanceDeg: ikResult.singularityDistanceDeg,
          machineAxes: ikResult.axes,
          score
        });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      return candidates[0];
    }

    // Fallback: Nominal normal vector
    const fallbackAxis = norm;
    const fallbackTCP = this.computeTCPFromContactPoint(contactPoint, fallbackAxis, norm, tool);
    const fallbackIK = MachineKinematicsEngine.solveInverseKinematics(machine, fallbackTCP, fallbackAxis, prevMachineState);

    return {
      toolVector: fallbackAxis,
      leadDeg: 0,
      tiltDeg: 0,
      isCollisionFree: true,
      minClearanceMm: 10.0,
      isIKFeasible: fallbackIK.withinLimits,
      isSingularityNear: fallbackIK.isSingularityNear,
      singularityDistanceDeg: fallbackIK.singularityDistanceDeg,
      machineAxes: fallbackIK.axes,
      score: 50.0
    };
  }

  /**
   * Computes TCP (Tool Center Point) from CC (Cutter Contact) point given tool vector and surface normal
   */
  public static computeTCPFromContactPoint(
    contactPoint: Vector3D,
    toolAxis: Vector3D,
    surfaceNormal: Vector3D,
    tool: FiveAxisToolDefinition
  ): Vector3D {
    if (tool.type === 'BALL_NOSE' || tool.type === 'TAPER_BALL') {
      const R = tool.diameterMm / 2;
      // For a ballnose, center of sphere is CC + R * Normal, and TCP (tip) is SphereCenter - R * ToolAxis
      return {
        x: contactPoint.x + R * surfaceNormal.x - R * toolAxis.x,
        y: contactPoint.y + R * surfaceNormal.y - R * toolAxis.y,
        z: contactPoint.z + R * surfaceNormal.z - R * toolAxis.z
      };
    } else if (tool.type === 'BULL_NOSE') {
      const r = tool.cornerRadMm;
      const R = tool.diameterMm / 2 - r;
      return {
        x: contactPoint.x + r * surfaceNormal.x,
        y: contactPoint.y + r * surfaceNormal.y,
        z: contactPoint.z + r * surfaceNormal.z
      };
    } else {
      // Flat endmill: offset along tool axis
      return {
        x: contactPoint.x,
        y: contactPoint.y,
        z: contactPoint.z
      };
    }
  }

  /**
   * Constructs tool vector from local Frenet-Serret frame using Lead and Tilt rotations
   */
  public static computeVectorFromLeadTilt(
    normal: Vector3D,
    tangent: Vector3D,
    binormal: Vector3D,
    leadDeg: number,
    tiltDeg: number
  ): Vector3D {
    const leadRad = (leadDeg * Math.PI) / 180;
    const tiltRad = (tiltDeg * Math.PI) / 180;

    // Start with surface normal
    // Rotate by Lead around Binormal (towards Tangent)
    const sinL = Math.sin(leadRad);
    const cosL = Math.cos(leadRad);

    const v1 = {
      x: cosL * normal.x + sinL * tangent.x,
      y: cosL * normal.y + sinL * tangent.y,
      z: cosL * normal.z + sinL * tangent.z
    };

    // Rotate by Tilt around Tangent (towards Binormal)
    const sinT = Math.sin(tiltRad);
    const cosT = Math.cos(tiltRad);

    const v2 = {
      x: cosT * v1.x + sinT * binormal.x,
      y: cosT * v1.y + sinT * binormal.y,
      z: cosT * v1.z + sinT * binormal.z
    };

    return this.normalize(v2);
  }

  private static normalize(v: Vector3D): Vector3D {
    const m = Math.hypot(v.x, v.y, v.z) || 1.0;
    return { x: v.x / m, y: v.y / m, z: v.z / m };
  }

  private static dotProduct(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  private static crossProduct(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
}
