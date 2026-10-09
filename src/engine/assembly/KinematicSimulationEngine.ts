/**
 * PATCH-SECP-045 — Kinematic Simulation Engine
 * Multi-step deterministic time-series kinematic simulation runner:
 *  - Discrete time stepping (startState -> timestep -> joint inputs -> solver -> collision check -> state snapshot)
 *  - Supports Constant Speed, Sinusoidal Oscillators, Trapezoidal velocity profiles
 *  - Generates immutable SimulationFrame sequence
 *  - 100% Deterministic: Zero Math.random(), zero Date.now()
 */

import { AssemblyComponent, AssemblyConstraint, PartDefinition } from './AssemblyConstraintTypes';
import { 
  KinematicJoint, 
  GearJoint, 
  SimulationResult, 
  SimulationFrame 
} from './KinematicTypes';
import { AssemblyKinematicSolver } from './AssemblyKinematicSolver';

export interface DriverMotionProfile {
  jointId: string;
  type: 'CONSTANT_VELOCITY' | 'HARMONIC' | 'TRAPEZOIDAL';
  amplitudeOrSpeed: number; // deg/s or mm/s, or amplitude (deg/mm)
  frequencyHz?: number;
  phaseRad?: number;
  initialValue?: number;
}

export interface SimulationOptions {
  durationS: number;
  timestepS: number;
  driverProfiles: DriverMotionProfile[];
  partsMap?: Map<string, PartDefinition>;
  checkInterferences?: boolean;
}

export class KinematicSimulationEngine {
  /**
   * Runs a complete deterministic time-stepping kinematic simulation
   */
  public static async runSimulation(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[] = [],
    joints: KinematicJoint[] = [],
    gearJoints: GearJoint[] = [],
    options: SimulationOptions
  ): Promise<SimulationResult> {
    const { durationS, timestepS, driverProfiles, partsMap, checkInterferences } = options;
    const frameCount = Math.max(1, Math.floor(durationS / timestepS));
    const frames: SimulationFrame[] = [];

    let maxResidualError = 0;
    let totalClashesDetected = 0;
    let overallSuccess = true;

    for (let step = 0; step <= frameCount; step++) {
      const timeS = step * timestepS;
      const jointCoordinates: Record<string, number> = {};

      // 1. Calculate joint coordinates for driven joints at timeS
      for (const profile of driverProfiles) {
        let value = profile.initialValue || 0;
        switch (profile.type) {
          case 'CONSTANT_VELOCITY':
            value += profile.amplitudeOrSpeed * timeS;
            break;

          case 'HARMONIC': {
            const freq = profile.frequencyHz || 1.0;
            const phase = profile.phaseRad || 0;
            const omega = 2 * Math.PI * freq;
            value += profile.amplitudeOrSpeed * Math.sin(omega * timeS + phase);
            break;
          }

          case 'TRAPEZOIDAL': {
            // Smooth acceleration and deceleration ramp
            const halfTime = durationS / 2;
            if (timeS < halfTime) {
              value += 0.5 * profile.amplitudeOrSpeed * Math.pow(timeS / halfTime, 2);
            } else {
              value += profile.amplitudeOrSpeed * (1 - 0.5 * Math.pow((durationS - timeS) / halfTime, 2));
            }
            break;
          }
        }
        jointCoordinates[profile.jointId] = value;
      }

      // 2. Solve kinematic state for this time step
      const solveResult = await AssemblyKinematicSolver.solve(
        components,
        constraints,
        joints,
        gearJoints,
        jointCoordinates,
        partsMap || new Map(),
        {
          checkInterferences: checkInterferences && (step % 5 === 0), // Broad check every few frames
          maxIterations: 30
        }
      );

      if (!solveResult.solved && solveResult.status !== 'UNDER_CONSTRAINED') {
        overallSuccess = false;
      }

      if (solveResult.residualError > maxResidualError) {
        maxResidualError = solveResult.residualError;
      }

      totalClashesDetected += solveResult.collisions.length;

      // 3. Create simulation snapshot frame
      const frame: SimulationFrame = {
        step,
        timeS,
        jointValues: { ...jointCoordinates },
        componentTransforms: { ...solveResult.componentTransforms },
        residualError: solveResult.residualError,
        hasCollision: solveResult.collisions.length > 0,
        clashes: solveResult.collisions,
        limitViolations: solveResult.violatedLimits
      };

      frames.push(frame);
    }

    // 4. Compute deterministic simulation hash
    let hashStr = `frames:${frames.length};dur:${durationS};maxErr:${maxResidualError.toFixed(6)};`;
    for (const f of frames) {
      hashStr += `s${f.step}:t${f.timeS.toFixed(3)}:err${f.residualError.toFixed(5)};`;
    }

    let hash = 0;
    for (let i = 0; i < hashStr.length; i++) {
      hash = (hash << 5) - hash + hashStr.charCodeAt(i);
      hash |= 0;
    }
    const deterministicHash = `sim-hash-${Math.abs(hash).toString(16).padStart(8, '0')}`;

    return {
      durationS,
      timestepS,
      frameCount: frames.length,
      frames,
      maxResidualError,
      totalClashesDetected,
      deterministicHash,
      success: overallSuccess
    };
  }
}
