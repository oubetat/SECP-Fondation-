import { Vector3D } from '../../cadKernel';
import {
  AssemblyConstraint,
  AssemblyComponentPose,
} from '../constraints/AssemblyConstraintModel';
import { AssemblyConstraintValidator } from '../constraints/AssemblyConstraintValidator';
import { KinematicBody } from './KinematicBody';

/**
 * Extracts Euler rotation angles (in degrees, ZYX sequence) from a 3x3 or 4x4 rotation matrix
 */
export function extractEulerAngles(R: number[][]): Vector3D {
  // R = Rz * Ry * Rx
  // r20 = -sin(ry)
  // r21 = sin(rx)*cos(ry), r22 = cos(rx)*cos(ry)
  // r10 = cos(ry)*sin(rz), r00 = cos(ry)*cos(rz)

  let rx = 0;
  let ry = 0;
  let rz = 0;

  const sy = -R[2][0];
  if (Math.abs(sy) < 0.99999) {
    ry = Math.asin(Math.max(-1, Math.min(1, sy)));
    rx = Math.atan2(R[2][1], R[2][2]);
    rz = Math.atan2(R[1][0], R[0][0]);
  } else {
    // Gimbal lock
    ry = sy > 0 ? Math.PI / 2 : -Math.PI / 2;
    rx = Math.atan2(-R[0][1], R[1][1]);
    rz = 0;
  }

  return {
    x: (rx * 180) / Math.PI,
    y: (ry * 180) / Math.PI,
    z: (rz * 180) / Math.PI,
  };
}

/**
 * Converts a KinematicBody with 4x4 world transform into an AssemblyComponentPose
 */
export function kinematicBodyToPose(body: KinematicBody): AssemblyComponentPose {
  const T = body.worldTransform;
  const position: Vector3D = { x: T[0][3], y: T[1][3], z: T[2][3] };
  const orientation = extractEulerAngles(T);

  return {
    instanceId: body.bodyId,
    position,
    orientation,
    transform: JSON.parse(JSON.stringify(T)),
    degreesOfFreedom: {
      initialDOF: body.grounded ? 0 : 6,
      remainingDOF: body.grounded ? 0 : 6,
      constrainedDOF: body.grounded ? 6 : 0,
      redundantDOF: 0,
      conflictingDOF: 0,
      unconstrainedDirections: body.grounded ? [] : ['tx', 'ty', 'tz', 'rx', 'ry', 'rz'],
    },
  };
}

export class KinematicConstraintBridge {
  /**
   * Validates a set of PATCH-030 assembly constraints against the current kinematic body transforms
   */
  public static verifyAssemblyConstraints(
    constraints: AssemblyConstraint[],
    bodies: KinematicBody[]
  ): {
    satisfied: boolean;
    maximumResidual: number;
    diagnostics: Array<{
      constraintId: string;
      residual: number;
      tolerance: number;
      satisfied: boolean;
      diagnostic?: string;
    }>;
  } {
    if (constraints.length === 0) {
      return { satisfied: true, maximumResidual: 0, diagnostics: [] };
    }

    const poses: Record<string, AssemblyComponentPose> = {};
    for (const b of bodies) {
      poses[b.bodyId] = kinematicBodyToPose(b);
    }

    const results = AssemblyConstraintValidator.verifyConstraints(constraints, poses);

    let maxResidual = 0;
    let satisfied = true;

    for (const res of results) {
      if (!isNaN(res.residual)) {
        maxResidual = Math.max(maxResidual, res.residual);
      }
      if (!res.satisfied) {
        satisfied = false;
      }
    }

    return {
      satisfied,
      maximumResidual: maxResidual,
      diagnostics: results,
    };
  }
}
