/**
 * PATCH-SECP-072: Mechanical Joint Engine
 * Validates and locks structural mechanical joint states, limits, and axis vectors.
 */

import { MechanicalJoint } from './AssemblyTopologyTypes';

export class MechanicalJointEngine {
  public static validateJointValue(joint: MechanicalJoint, value: number): number {
    if (!joint.limits) return value;
    return Math.max(joint.limits.min, Math.min(joint.limits.max, value));
  }

  public static updateJoint(joint: MechanicalJoint, value: number): MechanicalJoint {
    const clampedVal = this.validateJointValue(joint, value);
    return {
      ...joint,
      currentValue: clampedVal
    };
  }
}
