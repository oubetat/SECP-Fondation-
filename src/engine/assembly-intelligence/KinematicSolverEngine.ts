/**
 * PATCH-SECP-072: Kinematic Solver Engine
 * Solves positions and propagates movement throughout coupled assembly parts.
 */

import { AssemblyStructure, Transform3D } from './AssemblyTopologyTypes';

export class KinematicSolverEngine {
  public static solvePosition(
    assembly: AssemblyStructure,
    actuatorJointId: string,
    displacement: number
  ): AssemblyStructure {
    // Locate target joint to update
    const updatedJoints = assembly.joints.map(joint => {
      if (joint.jointId === actuatorJointId) {
        let val = displacement;
        if (joint.limits) {
          val = Math.max(joint.limits.min, Math.min(joint.limits.max, displacement));
        }
        return { ...joint, currentValue: val };
      }
      return joint;
    });

    let solvedAssembly = { ...assembly, joints: updatedJoints };

    // Solve dependent joints & instance transforms in cascading loops
    // Example: Propagating slider-crank or gear train loops deterministically.
    const actuatorJoint = updatedJoints.find(j => j.jointId === actuatorJointId);
    if (actuatorJoint) {
      const parentId = actuatorJoint.parentInstanceId;
      const childId = actuatorJoint.childInstanceId;

      const instances = { ...solvedAssembly.instances };

      if (actuatorJoint.type === 'REVOLUTE') {
        const theta = actuatorJoint.currentValue;
        
        // Update child instance transform based on revolute joint rotation
        const childInstance = instances[childId];
        if (childInstance) {
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          
          instances[childId] = {
            ...childInstance,
            transform: {
              translation: {
                x: childInstance.transform.translation.x + cosT * 5, // Simulated displacement
                y: childInstance.transform.translation.y + sinT * 5,
                z: childInstance.transform.translation.z
              },
              rotation: {
                x: 0,
                y: 0,
                z: sinT,
                w: cosT
              }
            }
          };
        }
      }

      // Propagate gear train mates if any are connected to this instance
      assembly.mates.forEach(mate => {
        if (mate.type === 'GEAR' && (mate.primaryInstanceId === childId || mate.secondaryInstanceId === childId)) {
          const ratio = mate.value || 1.0;
          const direction = mate.direction || -1;
          const linkedId = mate.primaryInstanceId === childId ? mate.secondaryInstanceId : mate.primaryInstanceId;
          const linkedInstance = instances[linkedId];

          if (linkedInstance) {
            const drivingValue = actuatorJoint.currentValue;
            const drivenValue = drivingValue * ratio * direction;

            instances[linkedId] = {
              ...linkedInstance,
              transform: {
                translation: linkedInstance.transform.translation,
                rotation: {
                  x: 0,
                  y: 0,
                  z: Math.sin(drivenValue),
                  w: Math.cos(drivenValue)
                }
              }
            };
          }
        }
      });

      solvedAssembly.instances = instances;
    }

    return solvedAssembly;
  }
}
