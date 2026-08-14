/**
 * PATCH-SECP-072: Kinematic Replay Engine
 * Asserts mathematical repeatability: Same displacement trajectory = Same mechanical position cascade.
 */

import { AssemblyStructure } from './AssemblyTopologyTypes';
import { KinematicSolverEngine } from './KinematicSolverEngine';

export class KinematicReplayEngine {
  public static replayTrajectory(
    assembly: AssemblyStructure,
    actuatorJointId: string,
    trajectory: number[]
  ): AssemblyStructure[] {
    const historicalAssemblies: AssemblyStructure[] = [];

    trajectory.forEach(displacement => {
      const stepAssembly = KinematicSolverEngine.solvePosition(assembly, actuatorJointId, displacement);
      historicalAssemblies.push(stepAssembly);
    });

    return historicalAssemblies;
  }

  public static verifyEquivalence(
    sequenceA: AssemblyStructure[],
    sequenceB: AssemblyStructure[]
  ): boolean {
    if (sequenceA.length !== sequenceB.length) return false;

    for (let i = 0; i < sequenceA.length; i++) {
      const instKeysA = Object.keys(sequenceA[i].instances);
      const instKeysB = Object.keys(sequenceB[i].instances);
      if (instKeysA.length !== instKeysB.length) return false;

      for (const key of instKeysA) {
        const transA = sequenceA[i].instances[key].transform.translation;
        const transB = sequenceB[i].instances[key].transform.translation;

        if (transA.x !== transB.x || transA.y !== transB.y || transA.z !== transB.z) {
          return false;
        }
      }
    }

    return true;
  }
}
