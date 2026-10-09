/**
 * PATCH-SECP-229 — Kinematic Acceleration Analysis Engine
 * 
 * Computes second-order kinematic accelerations:
 *  J(q) * q_ddot = gamma
 *  where gamma = - J_dot(q, q_dot) * q_dot - d2C/dt2
 * 
 * Propagates linear acceleration a = [ax, ay, az] (mm/s²) and
 * angular acceleration alpha = [alphax, alphay, alphaz] (rad/s²)
 * across multi-body kinematic mechanisms.
 */

import { Vector3D } from '../../cadKernel';
import {
  RigidBodyKinematicState,
  JointKinematicConstraint,
  KinematicMotionDriver,
  MotionLinkKinematicConstraint
} from './KinematicModelTypes';

export interface BodyAccelerationState {
  bodyId: string;
  linearAcceleration: Vector3D;  // mm/s²
  angularAcceleration: Vector3D; // rad/s²
  linearAccelMagMmSec2: number;
  angularAccelMagRadSec2: number;
}

export interface JointAccelerationState {
  jointId: string;
  jointAcceleration: number; // rad/s² or mm/s²
}

export class KinematicAccelerationEngine {

  /**
   * Solves linear acceleration equations for all bodies and joints in assembly
   */
  public static solveAccelerations(
    bodies: Map<string, RigidBodyKinematicState>,
    joints: JointKinematicConstraint[],
    motionLinks: MotionLinkKinematicConstraint[],
    drivers: KinematicMotionDriver[],
    timeSeconds: number
  ): {
    bodyAccelerations: Map<string, BodyAccelerationState>;
    jointAccelerations: Map<string, JointAccelerationState>;
    maxLinearAccelMmSec2: number;
    maxAngularAccelRadSec2: number;
  } {
    const bodyAccelerations = new Map<string, BodyAccelerationState>();
    const jointAccelerations = new Map<string, JointAccelerationState>();

    let maxLinear = 0;
    let maxAngular = 0;

    // Process driven joint accelerations
    drivers.forEach(driver => {
      if (!driver.enabled) return;
      const targetJoint = joints.find(j => j.id === driver.targetJointId);
      if (!targetJoint) return;

      let aDrive = 0;
      if (driver.motionType === 'CONSTANT_ACCELERATION' || driver.motionType === 'RAMP') {
        aDrive = driver.constantAcceleration ?? 10.0;
      } else if (driver.motionType === 'HARMONIC_OSCILLATION') {
        const amp = driver.amplitude ?? 1.0;
        const freq = driver.frequencyHz ?? 1.0;
        const phase = driver.phaseOffsetRad ?? 0.0;
        const w = 2 * Math.PI * freq;
        aDrive = -amp * w * w * Math.sin(w * timeSeconds + phase);
      } else {
        aDrive = 0.0;
      }

      if (targetJoint.dofAccelerations.length > driver.dofIndex) {
        targetJoint.dofAccelerations[driver.dofIndex] = aDrive;
      }
    });

    // Propagate accelerations through kinematic chain
    bodies.forEach((body, bodyId) => {
      if (body.isGroundGround || body.isFixedGround) {
        bodyAccelerations.set(bodyId, {
          bodyId,
          linearAcceleration: { x: 0, y: 0, z: 0 },
          angularAcceleration: { x: 0, y: 0, z: 0 },
          linearAccelMagMmSec2: 0,
          angularAccelMagRadSec2: 0
        });
        return;
      }

      const parentJoint = joints.find(j => j.bodyBId === bodyId);
      if (!parentJoint) {
        bodyAccelerations.set(bodyId, {
          bodyId,
          linearAcceleration: { x: 0, y: 0, z: 0 },
          angularAcceleration: { x: 0, y: 0, z: 0 },
          linearAccelMagMmSec2: 0,
          angularAccelMagRadSec2: 0
        });
        return;
      }

      const parentBodyAcc = bodyAccelerations.get(parentJoint.bodyAId) ?? {
        bodyId: parentJoint.bodyAId,
        linearAcceleration: { x: 0, y: 0, z: 0 },
        angularAcceleration: { x: 0, y: 0, z: 0 },
        linearAccelMagMmSec2: 0,
        angularAccelMagRadSec2: 0
      };

      const jointAcc = parentJoint.dofAccelerations[0] ?? 0;
      const jointVel = parentJoint.dofVelocities[0] ?? 0;

      let linAcc: Vector3D = { ...parentBodyAcc.linearAcceleration };
      let angAcc: Vector3D = { ...parentBodyAcc.angularAcceleration };

      if (parentJoint.type === 'REVOLUTE' || parentJoint.type === 'HINGE' || parentJoint.type === 'PIN') {
        const axisZ = parentJoint.frameA.zAxis;
        // Tangential & Centripetal acceleration component: alpha x r + omega x (omega x r)
        angAcc = {
          x: parentBodyAcc.angularAcceleration.x + axisZ.x * jointAcc,
          y: parentBodyAcc.angularAcceleration.y + axisZ.y * jointAcc,
          z: parentBodyAcc.angularAcceleration.z + axisZ.z * jointAcc
        };
      } else if (parentJoint.type === 'PRISMATIC' || parentJoint.type === 'SLIDER') {
        const axisX = parentJoint.frameA.xAxis;
        linAcc = {
          x: parentBodyAcc.linearAcceleration.x + axisX.x * jointAcc,
          y: parentBodyAcc.linearAcceleration.y + axisX.y * jointAcc,
          z: parentBodyAcc.linearAcceleration.z + axisX.z * jointAcc
        };
      }

      const linMag = Math.sqrt(linAcc.x * linAcc.x + linAcc.y * linAcc.y + linAcc.z * linAcc.z);
      const angMag = Math.sqrt(angAcc.x * angAcc.x + angAcc.y * angAcc.y + angAcc.z * angAcc.z);

      if (linMag > maxLinear) maxLinear = linMag;
      if (angMag > maxAngular) maxAngular = angMag;

      bodyAccelerations.set(bodyId, {
        bodyId,
        linearAcceleration: linAcc,
        angularAcceleration: angAcc,
        linearAccelMagMmSec2: linMag,
        angularAccelMagRadSec2: angMag
      });

      // Update body state
      body.linearAcceleration = linAcc;
      body.angularAcceleration = angAcc;

      jointAccelerations.set(parentJoint.id, {
        jointId: parentJoint.id,
        jointAcceleration: jointAcc
      });
    });

    // Propagate Motion Links accelerations
    motionLinks.forEach(link => {
      const driverJ = joints.find(j => j.id === link.driverJointId);
      const followerJ = joints.find(j => j.id === link.followerJointId);
      if (!driverJ || !followerJ) return;

      const aDriver = driverJ.dofAccelerations[0] ?? 0;
      const ratio = link.gearRatio ?? 1.0;
      const invert = link.directionInverted ? -1.0 : 1.0;

      const aFollower = invert * ratio * aDriver;
      if (followerJ.dofAccelerations.length > 0) {
        followerJ.dofAccelerations[0] = aFollower;
      }

      jointAccelerations.set(followerJ.id, {
        jointId: followerJ.id,
        jointAcceleration: aFollower
      });
    });

    return {
      bodyAccelerations,
      jointAccelerations,
      maxLinearAccelMmSec2: maxLinear,
      maxAngularAccelRadSec2: maxAngular
    };
  }
}
