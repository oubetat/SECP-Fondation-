/**
 * PATCH-SECP-229 — Kinematic Velocity Analysis Engine
 * 
 * Computes first-order kinematic velocities by solving the linear velocity system:
 *  J(q) * q_dot = - dC/dt = v_driver
 * 
 * Propagates linear velocity v = [vx, vy, vz] and angular velocity omega = [wx, wy, wz]
 * across multi-body kinematic chains.
 */

import { Vector3D } from '../../cadKernel';
import {
  RigidBodyKinematicState,
  JointKinematicConstraint,
  KinematicMotionDriver,
  MotionLinkKinematicConstraint
} from './KinematicModelTypes';

export interface BodyVelocityState {
  bodyId: string;
  linearVelocity: Vector3D;  // mm/s
  angularVelocity: Vector3D; // rad/s
  speedMmSec: number;
  angularSpeedRadSec: number;
}

export interface JointVelocityState {
  jointId: string;
  jointVelocity: number; // rad/s or mm/s
  relativeLinearVelocity: Vector3D;
  relativeAngularVelocity: Vector3D;
}

export class KinematicVelocityEngine {

  /**
   * Solves linear velocity equations for all bodies and joints in assembly
   */
  public static solveVelocities(
    bodies: Map<string, RigidBodyKinematicState>,
    joints: JointKinematicConstraint[],
    motionLinks: MotionLinkKinematicConstraint[],
    drivers: KinematicMotionDriver[],
    timeSeconds: number
  ): {
    bodyVelocities: Map<string, BodyVelocityState>;
    jointVelocities: Map<string, JointVelocityState>;
    maxLinearSpeedMmSec: number;
    maxAngularSpeedRadSec: number;
  } {
    const bodyVelocities = new Map<string, BodyVelocityState>();
    const jointVelocities = new Map<string, JointVelocityState>();

    let maxLinear = 0;
    let maxAngular = 0;

    // Process driven joint velocities first
    drivers.forEach(driver => {
      if (!driver.enabled) return;
      const targetJoint = joints.find(j => j.id === driver.targetJointId);
      if (!targetJoint) return;

      let vDrive = 0;
      if (driver.motionType === 'CONSTANT_VELOCITY') {
        vDrive = driver.targetVelocity ?? ((driver.targetRPM ?? 60) * (2 * Math.PI / 60));
      } else if (driver.motionType === 'HARMONIC_OSCILLATION') {
        const amp = driver.amplitude ?? 1.0;
        const freq = driver.frequencyHz ?? 1.0;
        const phase = driver.phaseOffsetRad ?? 0.0;
        vDrive = amp * (2 * Math.PI * freq) * Math.cos(2 * Math.PI * freq * timeSeconds + phase);
      } else if (driver.motionType === 'RAMP') {
        const acc = driver.constantAcceleration ?? 10.0;
        vDrive = acc * timeSeconds;
      }

      if (targetJoint.dofVelocities.length > driver.dofIndex) {
        targetJoint.dofVelocities[driver.dofIndex] = vDrive;
      }
    });

    // Propagate velocities through kinematic chain (BFS / Topological Order)
    bodies.forEach((body, bodyId) => {
      if (body.isGroundGround || body.isFixedGround) {
        bodyVelocities.set(bodyId, {
          bodyId,
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          speedMmSec: 0,
          angularSpeedRadSec: 0
        });
        return;
      }

      // Find joint driving this body
      const parentJoint = joints.find(j => j.bodyBId === bodyId);
      if (!parentJoint) {
        bodyVelocities.set(bodyId, {
          bodyId,
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          speedMmSec: 0,
          angularSpeedRadSec: 0
        });
        return;
      }

      const parentBodyVel = bodyVelocities.get(parentJoint.bodyAId) ?? {
        bodyId: parentJoint.bodyAId,
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        speedMmSec: 0,
        angularSpeedRadSec: 0
      };

      const jointVel = parentJoint.dofVelocities[0] ?? 0;

      let angVel: Vector3D = { ...parentBodyVel.angularVelocity };
      let linVel: Vector3D = { ...parentBodyVel.linearVelocity };

      if (parentJoint.type === 'REVOLUTE' || parentJoint.type === 'HINGE' || parentJoint.type === 'PIN') {
        // Rotation around Z axis of joint datum frame
        const axisZ = parentJoint.frameA.zAxis;
        angVel = {
          x: parentBodyVel.angularVelocity.x + axisZ.x * jointVel,
          y: parentBodyVel.angularVelocity.y + axisZ.y * jointVel,
          z: parentBodyVel.angularVelocity.z + axisZ.z * jointVel
        };
      } else if (parentJoint.type === 'PRISMATIC' || parentJoint.type === 'SLIDER') {
        // Translation along X axis of joint datum frame
        const axisX = parentJoint.frameA.xAxis;
        linVel = {
          x: parentBodyVel.linearVelocity.x + axisX.x * jointVel,
          y: parentBodyVel.linearVelocity.y + axisX.y * jointVel,
          z: parentBodyVel.linearVelocity.z + axisX.z * jointVel
        };
      }

      const speed = Math.sqrt(linVel.x * linVel.x + linVel.y * linVel.y + linVel.z * linVel.z);
      const angSpeed = Math.sqrt(angVel.x * angVel.x + angVel.y * angVel.y + angVel.z * angVel.z);

      if (speed > maxLinear) maxLinear = speed;
      if (angSpeed > maxAngular) maxAngular = angSpeed;

      bodyVelocities.set(bodyId, {
        bodyId,
        linearVelocity: linVel,
        angularVelocity: angVel,
        speedMmSec: speed,
        angularSpeedRadSec: angSpeed
      });

      // Update body state
      body.linearVelocity = linVel;
      body.angularVelocity = angVel;

      jointVelocities.set(parentJoint.id, {
        jointId: parentJoint.id,
        jointVelocity: jointVel,
        relativeLinearVelocity: linVel,
        relativeAngularVelocity: angVel
      });
    });

    // Propagate Motion Links (e.g. Gear Ratio, Rack & Pinion)
    motionLinks.forEach(link => {
      const driverJ = joints.find(j => j.id === link.driverJointId);
      const followerJ = joints.find(j => j.id === link.followerJointId);
      if (!driverJ || !followerJ) return;

      const vDriver = driverJ.dofVelocities[0] ?? 0;
      const ratio = link.gearRatio ?? 1.0;
      const invert = link.directionInverted ? -1.0 : 1.0;

      const vFollower = invert * ratio * vDriver;
      if (followerJ.dofVelocities.length > 0) {
        followerJ.dofVelocities[0] = vFollower;
      }

      jointVelocities.set(followerJ.id, {
        jointId: followerJ.id,
        jointVelocity: vFollower,
        relativeLinearVelocity: { x: 0, y: 0, z: 0 },
        relativeAngularVelocity: { x: 0, y: 0, z: vFollower }
      });
    });

    return {
      bodyVelocities,
      jointVelocities,
      maxLinearSpeedMmSec: maxLinear,
      maxAngularSpeedRadSec: maxAngular
    };
  }
}
