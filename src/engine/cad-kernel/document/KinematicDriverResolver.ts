/**
 * SECP CAD Kernel — Kinematic Driver Resolver (PATCH-040)
 */

import { AssemblyMate } from './CADDocument';
import { KinematicDriverState } from './AssemblyKinematicState';
import { JointLimitEvaluator, JointLimit } from './JointLimitEvaluator';

export class KinematicDriverResolver {
  public static resolve(
    mate: AssemblyMate,
    requestedType: 'ANGLE' | 'OFFSET',
    requestedValue: number
  ): KinematicDriverState {
    const type = (mate.type || '').toUpperCase();
    const value = requestedValue;

    // 1. Deterministic Rejection: Check if value is finite
    if (!Number.isFinite(value)) {
      return {
        mateId: mate.id,
        parameterName: requestedType,
        value: 0,
        status: 'INVALID_MATE',
        message: 'Non-finite driver value rejected'
      };
    }

    // 2. Type validation against joint capabilities
    const jointCapability = this.getJointCapabilities(type);
    if (!jointCapability.includes(requestedType)) {
      return {
        mateId: mate.id,
        parameterName: requestedType,
        value,
        status: 'INVALID_MATE',
        message: `Joint type ${type} does not support ${requestedType} drivers`
      };
    }

    // 3. Limits Check
    // We expect limits to be in metadata.limits.[ANGLE|OFFSET]
    const limits: JointLimit | undefined = (mate.metadata as any)?.limits?.[requestedType];
    if (limits) {
      const evaluation = JointLimitEvaluator.evaluate(value, limits);
      if (evaluation.status === 'LIMIT_VIOLATION') {
        return {
          mateId: mate.id,
          parameterName: requestedType,
          value,
          status: 'OUT_OF_LIMITS',
          message: `Limit violation: ${value} is outside [${limits.min}, ${limits.max}]`
        };
      }
    }

    return {
      mateId: mate.id,
      parameterName: requestedType,
      value,
      status: 'ACTIVE'
    };
  }

  private static getJointCapabilities(type: string): string[] {
    switch (type) {
      case 'REVOLUTE':
      case 'PIN':
        return ['ANGLE'];
      case 'SLIDER':
      case 'PRISMATIC':
        return ['OFFSET'];
      case 'CYLINDRICAL':
        return ['ANGLE', 'OFFSET'];
      case 'PLANAR':
        return ['OFFSET']; // Planar can have 2 offsets + 1 angle, but we simplify for now
      default:
        return [];
    }
  }
}
