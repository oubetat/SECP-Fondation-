/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — 5-Axis Motion Planner & Dynamic Feedrate Engine
 * Synthesizes Machine-Independent 5-Axis Paths, computes Inverse-Time Feedrates (G93),
 * calculates composite multi-axis vector velocities, and coordinates Indexed (3+2) and Simultaneous motion.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisCapability, 
  FiveAxisMachineDefinition, 
  FiveAxisTrajectoryPoint, 
  KinematicDiagnostic, 
  MachineAxesState, 
  MachineIndependent5AxisPath, 
  ToolOrientationVector 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';
import { InverseKinematicsSolver } from './InverseKinematicsSolver';

export interface TrajectoryInputNode {
  tcp: Vector3D;
  toolOrientation: Vector3D | ToolOrientationVector;
  feedMmMin?: number;
  spindleRpm?: number;
  motionType?: 'RAPID' | 'LINEAR' | 'PLUNGE' | 'RETRACT' | 'LEAD_IN' | 'LEAD_OUT' | 'INDEXED_MOVE';
  contactPoint?: Vector3D;
  surfaceNormal?: Vector3D;
  leadAngleDeg?: number;
  tiltAngleDeg?: number;
}

export class FiveAxisMotionPlanner {
  /**
   * Plans and solves a complete 5-axis trajectory across all kinematic joints
   */
  public static planTrajectory(
    machine: FiveAxisMachineDefinition,
    nodes: TrajectoryInputNode[],
    capability: FiveAxisCapability,
    toolLengthMm: number = 0,
    options?: { defaultFeedMmMin?: number; defaultSpindleRpm?: number; autoAvoidSingularity?: boolean }
  ): MachineIndependent5AxisPath {
    const defaultFeed = options?.defaultFeedMmMin ?? 1200;
    const defaultRpm = options?.defaultSpindleRpm ?? 12000;
    const diagnostics: KinematicDiagnostic[] = [];

    const points: FiveAxisTrajectoryPoint[] = [];
    let prevAxes: MachineAxesState | undefined;
    let totalLengthMm = 0;
    let totalTimeSec = 0;
    let totalRotaryPrimDeg = 0;
    let totalRotarySecDeg = 0;

    let maxVx = 0, maxVy = 0, maxVz = 0;
    let maxVrot1 = 0, maxVrot2 = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const targetTCP = node.tcp;
      const targetOrient = FiveAxisMathUtils.toOrientationVector(node.toolOrientation);
      const feedMmMin = node.feedMmMin ?? (node.motionType === 'RAPID' ? machine.rapidFeedMmMin : defaultFeed);
      const spindleRpm = node.spindleRpm ?? defaultRpm;
      const motionType = node.motionType ?? (i === 0 ? 'RAPID' : 'LINEAR');

      // Solve Multi-Branch Inverse Kinematics
      const ikResult = InverseKinematicsSolver.solveIK(
        machine,
        targetTCP,
        targetOrient,
        prevAxes,
        toolLengthMm,
        { autoAvoidSingularity: options?.autoAvoidSingularity }
      );

      diagnostics.push(...ikResult.diagnostics);

      const axes: MachineAxesState = ikResult.selectedSolution
        ? ikResult.selectedSolution.axes
        : { X: targetTCP.x, Y: targetTCP.y, Z: targetTCP.z, A: 0, B: 0, C: 0 };

      // Compute Segment Distance & Dynamic Time
      let segLengthMm = 0;
      let segTimeSec = 0;
      let rotFeedDegMin = 0;
      let feedMode: 'G93' | 'G94' = 'G94';

      if (i > 0) {
        const prevTCP = nodes[i - 1].tcp;
        segLengthMm = FiveAxisMathUtils.distance(prevTCP, targetTCP);
        totalLengthMm += segLengthMm;

        // Rotary displacements
        const primAxis = machine.rotaryLimits.primary.axis;
        const prevPrim = primAxis === 'A' ? prevAxes!.A : (primAxis === 'B' ? prevAxes!.B : prevAxes!.C);
        const currPrim = primAxis === 'A' ? axes.A : (primAxis === 'B' ? axes.B : axes.C);
        const dRot1 = Math.abs(currPrim - prevPrim);

        const secAxis = machine.rotaryLimits.secondary.axis;
        const prevSec = secAxis === 'C' ? prevAxes!.C : (secAxis === 'B' ? prevAxes!.B : prevAxes!.A);
        const currSec = secAxis === 'C' ? axes.C : (secAxis === 'B' ? axes.B : axes.A);
        const dRot2 = Math.abs(currSec - prevSec);

        totalRotaryPrimDeg += dRot1;
        totalRotarySecDeg += dRot2;

        // Effective multi-axis feedrate time
        const linearTimeSec = feedMmMin > 0 ? (segLengthMm / feedMmMin) * 60 : 0.05;
        const rotTimeSec1 = (dRot1 / machine.rotaryLimits.primary.limits.maxVelocity) * 60;
        const rotTimeSec2 = (dRot2 / machine.rotaryLimits.secondary.limits.maxVelocity) * 60;

        segTimeSec = Math.max(linearTimeSec, rotTimeSec1, rotTimeSec2, 0.01);
        totalTimeSec += segTimeSec;

        // Rotary feed in deg/min
        rotFeedDegMin = segTimeSec > 0 ? (Math.max(dRot1, dRot2) / segTimeSec) * 60 : 0;

        // For simultaneous motion with rotary travel, G93 (Inverse Time) provides superior synchronization
        if (capability === 'SIMULTANEOUS_5_AXIS' && (dRot1 > 0.01 || dRot2 > 0.01)) {
          feedMode = 'G93';
        }

        // Track Velocities
        const vx = (Math.abs(axes.X - prevAxes!.X) / segTimeSec) * 60;
        const vy = (Math.abs(axes.Y - prevAxes!.Y) / segTimeSec) * 60;
        const vz = (Math.abs(axes.Z - prevAxes!.Z) / segTimeSec) * 60;
        const vr1 = (dRot1 / segTimeSec) * 60;
        const vr2 = (dRot2 / segTimeSec) * 60;

        if (vx > maxVx) maxVx = vx;
        if (vy > maxVy) maxVy = vy;
        if (vz > maxVz) maxVz = vz;
        if (vr1 > maxVrot1) maxVrot1 = vr1;
        if (vr2 > maxVrot2) maxVrot2 = vr2;
      }

      points.push({
        pointIndex: i,
        targetTCP,
        targetOrientation: targetOrient,
        contactPoint: node.contactPoint,
        surfaceNormal: node.surfaceNormal,
        leadAngleDeg: node.leadAngleDeg ?? 0,
        tiltAngleDeg: node.tiltAngleDeg ?? 0,
        feedMmMin,
        rotaryFeedDegMin: Number(rotFeedDegMin.toFixed(1)),
        feedrateMode: feedMode,
        spindleRpm,
        motionType,
        capability,
        machineAxes: axes,
        ikResult,
        estimatedTimeSec: Number(totalTimeSec.toFixed(3)),
        isSimultaneous5Axis: capability === 'SIMULTANEOUS_5_AXIS'
      });

      prevAxes = axes;
    }

    const isValid = points.every(p => p.ikResult.isValid);

    return {
      pathId: `PATH_5AX_${machine.machineId}_${Date.now()}`,
      machineId: machine.machineId,
      architecture: machine.architecture,
      topology: machine.topology,
      points,
      totalLengthMm: Number(totalLengthMm.toFixed(3)),
      totalCycleTimeSec: Number(totalTimeSec.toFixed(2)),
      totalRotaryTravelPrimaryDeg: Number(totalRotaryPrimDeg.toFixed(2)),
      totalRotaryTravelSecondaryDeg: Number(totalRotarySecDeg.toFixed(2)),
      maxAxisVelocities: {
        X: Number(maxVx.toFixed(1)),
        Y: Number(maxVy.toFixed(1)),
        Z: Number(maxVz.toFixed(1)),
        primaryRotary: Number(maxVrot1.toFixed(1)),
        secondaryRotary: Number(maxVrot2.toFixed(1))
      },
      capability,
      isValid,
      diagnostics
    };
  }
}
