/**
 * PATCH-SECP-072: Mechanism Simulation Engine
 * Generates kinematic profiles (displacement, velocity, acceleration) over a continuous simulation timeline.
 */

import { AssemblyStructure, KinematicSimulationState } from './AssemblyTopologyTypes';
import { KinematicSolverEngine } from './KinematicSolverEngine';

export class MechanismSimulationEngine {
  public static runSimulation(
    assembly: AssemblyStructure,
    actuatorJointId: string,
    durationSec: number,
    stepsPerSec: number,
    velocityProfile: (time: number) => number
  ): KinematicSimulationState[] {
    const states: KinematicSimulationState[] = [];
    const totalSteps = durationSec * stepsPerSec;
    const dt = 1 / stepsPerSec;

    let previousDisplacement = 0;
    let previousVelocity = 0;

    for (let step = 0; step <= totalSteps; step++) {
      const time = step * dt;
      
      // Integrate velocity to find current joint position
      const velocity = velocityProfile(time);
      const displacement = previousDisplacement + velocity * dt;

      // Resolve the physical assembly structure at this position
      const solvedAssembly = KinematicSolverEngine.solvePosition(assembly, actuatorJointId, displacement);

      // Compute derivative kinematic quantities (numerical finite differences)
      const currentVelocity = (displacement - previousDisplacement) / dt || 0;
      const acceleration = (currentVelocity - previousVelocity) / dt || 0;

      const instancePositions: Record<string, any> = {};
      const instanceVelocities: Record<string, any> = {};
      const instanceAccelerations: Record<string, any> = {};

      Object.keys(solvedAssembly.instances).forEach(instId => {
        const inst = solvedAssembly.instances[instId];
        instancePositions[instId] = inst.transform;
        
        // Simulating linear & angular profile outputs
        instanceVelocities[instId] = { linear: currentVelocity * 10, angular: currentVelocity };
        instanceAccelerations[instId] = { linear: acceleration * 10, angular: acceleration };
      });

      states.push({
        timestamp: time,
        instancePositions,
        instanceVelocities,
        instanceAccelerations
      });

      previousDisplacement = displacement;
      previousVelocity = currentVelocity;
    }

    return states;
  }
}
