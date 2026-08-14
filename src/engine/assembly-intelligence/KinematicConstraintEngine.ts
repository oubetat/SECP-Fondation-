/**
 * PATCH-SECP-072: Kinematic Constraint Engine
 * Defines joint mechanical types, bounds, and computes Degrees of Freedom.
 */

import { MechanicalJoint, AssemblyStructure } from './AssemblyTopologyTypes';

export class KinematicConstraintEngine {
  public static createJoint(
    type: 'REVOLUTE' | 'PRISMATIC' | 'FIXED' | 'CYLINDRICAL' | 'SPHERICAL',
    parentInstanceId: string,
    childInstanceId: string,
    origin: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    limits?: { min: number; max: number }
  ): MechanicalJoint {
    const jointId = `joint-${type.toLowerCase()}-${parentInstanceId}-${childInstanceId}-${Date.now()}`;
    return {
      jointId,
      type,
      parentInstanceId,
      childInstanceId,
      origin,
      axis,
      limits,
      currentValue: 0
    };
  }

  public static calculateDOF(assembly: AssemblyStructure): number {
    const totalParts = Object.keys(assembly.instances).length;
    if (totalParts === 0) return 0;

    // A rigid part in free 3D space has 6 DOFs
    let rawDOF = totalParts * 6;

    // A ground component or fixing parent instance locks 6 DOFs
    let hasGround = false;
    Object.keys(assembly.instances).forEach((id, idx) => {
      if (idx === 0) {
        rawDOF -= 6; // Lock first part as ground
        hasGround = true;
      }
    });

    // Each Mate removes DOFs
    assembly.mates.forEach(mate => {
      if (mate.type === 'COINCIDENT') rawDOF -= 3;
      if (mate.type === 'CONCENTRIC') rawDOF -= 4;
      if (mate.type === 'PARALLEL') rawDOF -= 2;
      if (mate.type === 'DISTANCE') rawDOF -= 1;
      if (mate.type === 'ANGLE') rawDOF -= 1;
      if (mate.type === 'GEAR') rawDOF -= 1;
    });

    // Each Joint constrains relative movement
    assembly.joints.forEach(joint => {
      if (joint.type === 'FIXED') rawDOF -= 6;
      if (joint.type === 'REVOLUTE') rawDOF -= 5;   // allows only 1 rotation
      if (joint.type === 'PRISMATIC') rawDOF -= 5;  // allows only 1 translation
      if (joint.type === 'CYLINDRICAL') rawDOF -= 4;// allows 1 rotation, 1 translation
      if (joint.type === 'SPHERICAL') rawDOF -= 3;  // allows 3 rotations
    });

    return Math.max(0, rawDOF);
  }
}
