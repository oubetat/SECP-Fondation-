/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Kinematic Continuity Analyzer: 5-Axis Singularities, Rotary Flips & Tool Orientation Continuity
 */

import { MachinePose, KinematicAnomalyRecord, SimulationTolerances, Vector3D } from './MachineSimulationTypes';

export class KinematicContinuityAnalyzer {
  private tolerances: SimulationTolerances;
  private previousPose?: MachinePose;

  constructor(tolerances: SimulationTolerances) {
    this.tolerances = tolerances;
  }

  public reset(): void {
    this.previousPose = undefined;
  }

  public analyzePoseContinuity(
    currentPose: MachinePose,
    blockIndex: number,
    timestampSec: number
  ): KinematicAnomalyRecord[] {
    const anomalies: KinematicAnomalyRecord[] = [];

    // 1. Singularity Proximity Check (Pole Singularity near A=0 or B=0)
    const tiltAngle = Math.abs(currentPose.axes.a || currentPose.axes.b);
    if (tiltAngle < this.tolerances.singularityAngleThresholdDeg && tiltAngle > 0.001) {
      anomalies.push({
        id: `SINGULARITY_${blockIndex}`,
        timestampSec,
        blockIndex,
        type: 'SINGULARITY_PROXIMITY',
        severity: 'WARNING',
        angleDeg: tiltAngle,
        description: `Near kinematic pole singularity: tilt angle ${tiltAngle.toFixed(2)}° is below threshold ${this.tolerances.singularityAngleThresholdDeg}°`,
      });
    }

    if (this.previousPose) {
      // 2. Rotary Flip & Large Angular Jump Check
      const da = Math.abs(currentPose.axes.a - this.previousPose.axes.a);
      const db = Math.abs(currentPose.axes.b - this.previousPose.axes.b);
      const dc = Math.abs(currentPose.axes.c - this.previousPose.axes.c);

      const maxRotaryJump = Math.max(da, db, dc);
      if (maxRotaryJump > 90.0) {
        anomalies.push({
          id: `ROTARY_FLIP_${blockIndex}`,
          timestampSec,
          blockIndex,
          type: 'ROTARY_FLIP',
          severity: 'ERROR',
          angleDeg: maxRotaryJump,
          description: `Sudden rotary reversal / flip detected: angular delta of ${maxRotaryJump.toFixed(2)}° across single step`,
        });
      }

      // 3. Tool Orientation Vector Continuity Check
      const v1 = this.previousPose.toolOrientationWorld;
      const v2 = currentPose.toolOrientationWorld;
      const dot = Math.max(-1.0, Math.min(1.0, v1.x * v2.x + v1.y * v2.y + v1.z * v2.z));
      const angleRad = Math.acos(dot);
      const angleDeg = (angleRad * 180.0) / Math.PI;

      if (angleDeg > this.tolerances.angularDiscontinuityThresholdDeg) {
        anomalies.push({
          id: `ORIENT_DISCONT_${blockIndex}`,
          timestampSec,
          blockIndex,
          type: 'ORIENTATION_DISCONTINUITY',
          severity: 'WARNING',
          angleDeg,
          description: `Tool orientation discontinuity: angular change ${angleDeg.toFixed(2)}° exceeds smooth limit ${this.tolerances.angularDiscontinuityThresholdDeg}°`,
        });
      }
    }

    this.previousPose = { ...currentPose };
    return anomalies;
  }
}
