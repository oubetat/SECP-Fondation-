/**
 * PATCH-SECP-228 — Motion Timeline Engine
 * 
 * Physics-evaluated trajectory timeline player:
 *  - Deterministic multi-body kinematic time stepping
 *  - Dynamic clearance curve analysis over trajectory
 *  - Collision detection sweep during motion
 *  - Play, Pause, Reverse, Step, and Scrub controls
 *  - Real re-evaluation of equations (never static pre-rendered animation)
 */

import {
  MotionLink,
  MotionTimelineState,
  MotionCollisionRecord,
  MotionClearanceEnvelope
} from './MotionLinkTypes';
import { MotionLinkSolver, MotionSolverStepOutput } from './MotionLinkSolver';
import { MechanicalJoint, ComponentKinematicState } from '../joints/MechanicalJointTypes';
import { CoordinateFrameEngine } from '../joints/CoordinateFrameEngine';

export interface TrajectoryPoint {
  timeSeconds: number;
  driverPosition: number;
  followerPosition: number;
  followerVelocity: number;
  followerAcceleration: number;
  minimumClearanceMm: number;
  isCollision: boolean;
}

export class MotionTimelineEngine {
  /**
   * Sweeps an entire trajectory from startTime to endTime to construct dynamic clearance envelope
   */
  public static sweepTrajectory(
    components: ComponentKinematicState[],
    joints: MechanicalJoint[],
    links: MotionLink[],
    driverJointId: string,
    motionProfile: (t: number) => { pos: number; vel: number; acc: number },
    startTimeSec: number = 0,
    endTimeSec: number = 5.0,
    timeStepSec: number = 0.05
  ): {
    trajectory: TrajectoryPoint[];
    clearanceEnvelope: MotionClearanceEnvelope;
  } {
    const trajectory: TrajectoryPoint[] = [];
    const collisionEvents: MotionCollisionRecord[] = [];
    let minOverallDist = 999.0;
    let minTime = startTimeSec;
    let criticalPair: [string, string] = ['', ''];
    let hasAnyClash = false;

    const totalSteps = Math.ceil((endTimeSec - startTimeSec) / timeStepSec);

    for (let step = 0; step <= totalSteps; step++) {
      const t = startTimeSec + step * timeStepSec;
      const driverState = motionProfile(t);

      const driverOverrides = new Map<string, { position?: number; velocity?: number; acceleration?: number }>();
      driverOverrides.set(driverJointId, {
        position: driverState.pos,
        velocity: driverState.vel,
        acceleration: driverState.acc
      });

      const solverOutput = MotionLinkSolver.solveMotion(
        components.map(c => ({ ...c })),
        joints.map(j => ({ ...j })),
        links.map(l => ({ ...l })),
        driverOverrides
      );

      const activeLink = solverOutput.links[0];
      const followerPos = activeLink ? activeLink.evaluatedPosition : 0;
      const followerVel = activeLink ? activeLink.evaluatedVelocity : 0;
      const followerAcc = activeLink ? activeLink.evaluatedAcceleration : 0;

      const isCollision = solverOutput.collisionRecords.length > 0;
      if (isCollision) {
        hasAnyClash = true;
        for (const col of solverOutput.collisionRecords) {
          collisionEvents.push({
            ...col,
            timeSeconds: t,
            triggeringMotionLinkId: activeLink?.id
          });
        }
      }

      if (solverOutput.minClearanceMm < minOverallDist) {
        minOverallDist = solverOutput.minClearanceMm;
        minTime = t;
        if (solverOutput.components.length >= 2) {
          criticalPair = [solverOutput.components[0].componentId, solverOutput.components[1].componentId];
        }
      }

      trajectory.push({
        timeSeconds: t,
        driverPosition: driverState.pos,
        followerPosition: followerPos,
        followerVelocity: followerVel,
        followerAcceleration: followerAcc,
        minimumClearanceMm: solverOutput.minClearanceMm,
        isCollision
      });
    }

    const clearanceEnvelope: MotionClearanceEnvelope = {
      overallMinDistanceMm: minOverallDist,
      timeOfMinDistanceSec: minTime,
      criticalPair,
      hasClash: hasAnyClash,
      trajectoryPoints: trajectory.map(p => ({ timeSec: p.timeSeconds, minDistanceMm: p.minimumClearanceMm })),
      collisionEvents
    };

    return { trajectory, clearanceEnvelope };
  }
}
