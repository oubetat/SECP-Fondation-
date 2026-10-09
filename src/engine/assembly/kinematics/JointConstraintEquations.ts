/**
 * PATCH-SECP-229 — Joint Constraint Equations & Analytical Jacobians
 * 
 * Formulates the mathematical non-linear kinematic constraint equations C(q) = 0
 * and analytical Jacobian matrices J(q) = dC/dq for standard mechanical joints.
 * 
 * Kinematic State Representation for Body B relative to Body A:
 *  q_body = [ x, y, z, rx, ry, rz ] (Position mm, Euler angles rad or axis-angle)
 */

import { Vector3D } from '../../cadKernel';
import { MechanicalJointType, CoordinateFrame3D, Matrix3x3 } from '../joints/MechanicalJointTypes';

export interface JointConstraintEvaluation {
  residuals: number[]; // C_i(q)
  jacobianRows: number[][]; // [ [dC1/dx, dC1/dy, dC1/dz, dC1/drx, dC1/dry, dC1/drz], ... ]
  totalConstraints: number;
  dofCount: number;
}

export class JointConstraintEquations {

  /**
   * Evaluates joint kinematic constraints C(q) and Jacobian dC/dq for a joint given its relative state
   * @param type Mechanical Joint Type
   * @param relPos Relative position vector from Datum A to Datum B in Frame A (mm)
   * @param relAngles Relative Euler rotation angles [rx, ry, rz] (rad)
   * @param frameA Base coordinate frame
   * @param frameB Follower coordinate frame
   */
  public static evaluateJointConstraint(
    type: MechanicalJointType,
    relPos: Vector3D,
    relAngles: [number, number, number],
    frameA: CoordinateFrame3D,
    frameB: CoordinateFrame3D
  ): JointConstraintEvaluation {
    const [rx, ry, rz] = relAngles;
    const { x, y, z } = relPos;

    switch (type) {
      case 'FIXED': {
        // 6 constraints: x=0, y=0, z=0, rx=0, ry=0, rz=0
        const residuals = [x, y, z, rx, ry, rz];
        const jacobianRows = [
          [1, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0],
          [0, 0, 0, 0, 0, 1]
        ];
        return { residuals, jacobianRows, totalConstraints: 6, dofCount: 0 };
      }

      case 'REVOLUTE':
      case 'HINGE':
      case 'PIN': {
        // 5 constraints: 3 translational (x=0, y=0, z=0), 2 rotational (rx=0, ry=0)
        // Free DOF: rz (rotation around Z axis)
        const residuals = [x, y, z, rx, ry];
        const jacobianRows = [
          [1, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0]
        ];
        return { residuals, jacobianRows, totalConstraints: 5, dofCount: 1 };
      }

      case 'PRISMATIC':
      case 'SLIDER': {
        // 5 constraints: 2 translational (y=0, z=0), 3 rotational (rx=0, ry=0, rz=0)
        // Free DOF: x (translation along X axis)
        const residuals = [y, z, rx, ry, rz];
        const jacobianRows = [
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0],
          [0, 0, 0, 0, 0, 1]
        ];
        return { residuals, jacobianRows, totalConstraints: 5, dofCount: 1 };
      }

      case 'CYLINDRICAL': {
        // 4 constraints: 2 translational (y=0, z=0), 2 rotational (rx=0, ry=0)
        // Free DOFs: x (translation along Z/X), rz (rotation around Z/X)
        const residuals = [y, z, rx, ry];
        const jacobianRows = [
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0]
        ];
        return { residuals, jacobianRows, totalConstraints: 4, dofCount: 2 };
      }

      case 'SPHERICAL':
      case 'BALL_AND_SOCKET': {
        // 3 constraints: 3 translational (x=0, y=0, z=0)
        // Free DOFs: 3 rotational (rx, ry, rz)
        const residuals = [x, y, z];
        const jacobianRows = [
          [1, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0]
        ];
        return { residuals, jacobianRows, totalConstraints: 3, dofCount: 3 };
      }

      case 'PLANAR': {
        // 3 constraints: 1 translational (z=0), 2 rotational (rx=0, ry=0)
        // Free DOFs: x, y, rz
        const residuals = [z, rx, ry];
        const jacobianRows = [
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0]
        ];
        return { residuals, jacobianRows, totalConstraints: 3, dofCount: 3 };
      }

      case 'UNIVERSAL': {
        // 4 constraints: 3 translational (x=0, y=0, z=0), 1 rotational (rz=0)
        // Free DOFs: rx, ry
        const residuals = [x, y, z, rz];
        const jacobianRows = [
          [1, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 1]
        ];
        return { residuals, jacobianRows, totalConstraints: 4, dofCount: 2 };
      }

      case 'HELICAL_SCREW': {
        // 5 constraints: 3 translational, 2 rotational, plus coupled x - pitch*rz / 2pi = 0
        const leadMmPerTurn = 5.0; // pitch
        const screwConstraint = x - (leadMmPerTurn / (2 * Math.PI)) * rz;
        const residuals = [y, z, rx, ry, screwConstraint];
        const jacobianRows = [
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0],
          [1, 0, 0, 0, 0, -(leadMmPerTurn / (2 * Math.PI))]
        ];
        return { residuals, jacobianRows, totalConstraints: 5, dofCount: 1 };
      }

      case 'RACK_AND_PINION':
      case 'GEAR':
      default: {
        // Default 5 constraint revolute-like
        const residuals = [x, y, z, rx, ry];
        const jacobianRows = [
          [1, 0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 1, 0]
        ];
        return { residuals, jacobianRows, totalConstraints: 5, dofCount: 1 };
      }
    }
  }

  /**
   * Helper to compute rotation matrix from Euler angles (XYZ order)
   */
  public static eulerToRotationMatrix(rx: number, ry: number, rz: number): Matrix3x3 {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    return {
      elements: [
        cy * cz, -cy * sz, sy,
        cz * sx * sy + cx * sz, cx * cz - sx * sy * sz, -cy * sx,
        -cx * cz * sy + sx * sz, cz * sx + cx * sy * sz, cx * cy
      ]
    };
  }
}
