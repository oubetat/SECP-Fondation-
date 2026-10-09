import { MechanicalJoint, AssemblyStructure, JointType } from './AssemblyTopologyTypes';

export class KinematicConstraintEngine {
  public static createJoint(
    type: JointType,
    parentInstanceId: string,
    childInstanceId: string,
    origin: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    limits?: { min: number; max: number }
  ): MechanicalJoint {
    return {
      jointId: `joint-${parentInstanceId}-${childInstanceId}`,
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
    // 2 parts = 12 DOFs. Locking ground component leaves 6. REVOLUTE joint eliminates 5 DOFs, leaving 1.
    const partCount = Object.keys(assembly.instances).length;
    if (partCount === 0) return 0;
    
    let dof = partCount * 6 - 6; // Lock first part to ground
    assembly.joints.forEach(joint => {
      if (joint.type === 'REVOLUTE') {
        dof -= 5;
      } else if (joint.type === 'PRISMATIC') {
        dof -= 5;
      } else if (joint.type === 'FIXED') {
        dof -= 6;
      }
    });

    return Math.max(0, dof);
  }
}
