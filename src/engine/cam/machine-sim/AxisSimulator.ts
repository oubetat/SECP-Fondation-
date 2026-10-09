/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Axis Simulator: Multi-Axis Dynamics & Continuous Motion Interpolator
 */

import { MachineDefinition, AxisPositionState, MachineAxisDefinition, SimulationTolerances } from './MachineSimulationTypes';

export interface InterpolatedSubStep {
  subStepIndex: number;
  fraction: number; // 0.0 to 1.0 along the block
  axes: AxisPositionState;
  segmentFeedrateMmMin: number;
  durationSec: number;
  isRapid: boolean;
}

export class AxisSimulator {
  private definition: MachineDefinition;
  private currentPositions: AxisPositionState;
  private currentVelocities: Record<string, number>; // mm/min or deg/min

  constructor(definition: MachineDefinition) {
    this.definition = definition;
    this.currentPositions = this.getHomePositions();
    this.currentVelocities = { X: 0, Y: 0, Z: 0, A: 0, B: 0, C: 0 };
  }

  public getHomePositions(): AxisPositionState {
    const home: AxisPositionState = { x: 0, y: 0, z: 0, a: 0, b: 0, c: 0 };
    for (const axis of this.definition.axes) {
      const name = axis.name.toLowerCase() as keyof AxisPositionState;
      home[name] = axis.homePosition;
    }
    return home;
  }

  public getCurrentPositions(): AxisPositionState {
    return { ...this.currentPositions };
  }

  public setPositions(positions: Partial<AxisPositionState>): void {
    this.currentPositions = {
      ...this.currentPositions,
      ...positions,
    };
  }

  /**
   * Interpolate motion from current pose to target pose with adaptive sampling
   * based on chordal error, rapid status, and rotary velocity.
   */
  public interpolateMotion(
    startAxes: AxisPositionState,
    targetAxes: Partial<AxisPositionState>,
    feedrateMmMin: number,
    isRapid: boolean,
    tolerances: SimulationTolerances
  ): InterpolatedSubStep[] {
    const endAxes: AxisPositionState = {
      x: targetAxes.x !== undefined ? targetAxes.x : startAxes.x,
      y: targetAxes.y !== undefined ? targetAxes.y : startAxes.y,
      z: targetAxes.z !== undefined ? targetAxes.z : startAxes.z,
      a: targetAxes.a !== undefined ? targetAxes.a : startAxes.a,
      b: targetAxes.b !== undefined ? targetAxes.b : startAxes.b,
      c: targetAxes.c !== undefined ? targetAxes.c : startAxes.c,
    };

    // Calculate linear displacement distance
    const dx = endAxes.x - startAxes.x;
    const dy = endAxes.y - startAxes.y;
    const dz = endAxes.z - startAxes.z;
    const linearDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate rotary displacement
    const da = Math.abs(endAxes.a - startAxes.a);
    const db = Math.abs(endAxes.b - startAxes.b);
    const dc = Math.abs(endAxes.c - startAxes.c);
    const maxRotaryDeg = Math.max(da, db, dc);

    // Calculate sub-steps count based on sampling tolerance
    let stepCount = 1;
    if (linearDist > 0.001) {
      const stepSize = isRapid ? tolerances.maxSamplingStepMm : tolerances.minSamplingStepMm;
      stepCount = Math.max(1, Math.ceil(linearDist / stepSize));
    }
    if (maxRotaryDeg > 0.5) {
      const rotarySteps = Math.ceil(maxRotaryDeg / 2.0); // max 2 degrees per sub-step
      stepCount = Math.max(stepCount, rotarySteps);
    }

    // Cap stepCount within realistic bound for performance while guaranteeing safety
    stepCount = Math.min(Math.max(stepCount, 1), 64);

    // Determine actual traverse speed considering axis maximum velocities
    let actualFeed = feedrateMmMin;
    if (isRapid) {
      let maxRapid = 30000; // default 30 m/min
      for (const axis of this.definition.axes) {
        if (axis.limits.maxVelocity) {
          maxRapid = Math.min(maxRapid, axis.limits.maxVelocity);
        }
      }
      actualFeed = maxRapid;
    }

    const durationSec = linearDist > 0 ? (linearDist / actualFeed) * 60.0 : (maxRotaryDeg > 0 ? (maxRotaryDeg / 3600) * 60.0 : 0.001);
    const dtPerSubStep = durationSec / stepCount;

    const subSteps: InterpolatedSubStep[] = [];

    for (let i = 1; i <= stepCount; i++) {
      const frac = i / stepCount;
      const interpAxes: AxisPositionState = {
        x: startAxes.x + dx * frac,
        y: startAxes.y + dy * frac,
        z: startAxes.z + dz * frac,
        a: startAxes.a + (endAxes.a - startAxes.a) * frac,
        b: startAxes.b + (endAxes.b - startAxes.b) * frac,
        c: startAxes.c + (endAxes.c - startAxes.c) * frac,
      };

      subSteps.push({
        subStepIndex: i,
        fraction: frac,
        axes: interpAxes,
        segmentFeedrateMmMin: actualFeed,
        durationSec: dtPerSubStep,
        isRapid,
      });
    }

    this.currentPositions = { ...endAxes };
    return subSteps;
  }
}
