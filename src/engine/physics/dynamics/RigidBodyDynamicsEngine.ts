/**
 * SECP Engineering Core — Rigid Body Dynamics Engine
 * Generic 6-DOF solver for Rigid Body physics.
 * Implements Newton-Euler equations of motion.
 */

import { Vector3 } from '../../geometry/GeometryTypes';
import { 
  RigidBodyState as IState, 
  RigidBodyProperties as IProps, 
  ForceVector as IForce 
} from './RigidBodyTypes';
import { DynamicsMath as MathUtils } from './DynamicsMath';

export class RigidBodyDynamicsEngine {
  /**
   * Computes the time derivative of the rigid body state.
   * x_dot = f(x, u)
   */
  public static computeDerivatives(
    state: IState,
    properties: IProps,
    forces: IForce[],
    gravityMS2: number
  ): IState {
    const { massKg, inertiaTensor } = properties;
    const { velocityBody, angularVelocityBody, orientation } = state;

    // 1. Sum up forces and moments in Body Frame
    let sumForceBody: Vector3 = { x: 0, y: 0, z: 0 };
    let sumMomentBody: Vector3 = { x: 0, y: 0, z: 0 };

    // Gravity (World Frame -> Body Frame)
    const gravityWorld: Vector3 = { x: 0, y: 0, z: -massKg * gravityMS2 };
    const gravityBody = MathUtils.worldToBody(gravityWorld, orientation);
    sumForceBody.x += gravityBody.x;
    sumForceBody.y += gravityBody.y;
    sumForceBody.z += gravityBody.z;

    for (const f of forces) {
      const fb = f.frame === 'BODY' ? f.force : MathUtils.worldToBody(f.force, orientation);
      const mb = f.frame === 'BODY' ? f.moment : MathUtils.worldToBody(f.moment, orientation);
      
      sumForceBody.x += fb.x;
      sumForceBody.y += fb.y;
      sumForceBody.z += fb.z;

      sumMomentBody.x += mb.x;
      sumMomentBody.y += mb.y;
      sumMomentBody.z += mb.z;
    }

    // 2. Linear Dynamics: F = m * (dv/dt + omega x v)
    // dv/dt = F/m - omega x v
    const omegaXV = MathUtils.cross(angularVelocityBody, velocityBody);
    const dv_dt: Vector3 = {
      x: sumForceBody.x / massKg - omegaXV.x,
      y: sumForceBody.y / massKg - omegaXV.y,
      z: sumForceBody.z / massKg - omegaXV.z
    };

    // 3. Angular Dynamics: M = I * d_omega/dt + omega x (I * omega)
    // d_omega/dt = I^-1 * (M - omega x (I * omega))
    const I_omega = MathUtils.matVecMul(inertiaTensor, angularVelocityBody);
    const omega_x_I_omega = MathUtils.cross(angularVelocityBody, I_omega);
    
    const M_minus_gyro: Vector3 = {
      x: sumMomentBody.x - omega_x_I_omega.x,
      y: sumMomentBody.y - omega_x_I_omega.y,
      z: sumMomentBody.z - omega_x_I_omega.z
    };

    const invI = MathUtils.invert3x3(inertiaTensor);
    const d_omega_dt = MathUtils.matVecMul(invI, M_minus_gyro);

    // 4. Kinematics (Position and Orientation rates)
    // dp/dt = R_bw * v_b
    const dp_dt = MathUtils.bodyToWorld(velocityBody, orientation);

    // d_euler/dt (Simplified Euler kinematics - handle gimbal lock carefully)
    const { x: phi, y: theta } = orientation;
    const s_phi = Math.sin(phi);
    const c_phi = Math.cos(phi);
    const s_the = Math.sin(theta);
    const c_the = Math.cos(theta);
    const tan_the = Math.tan(theta);

    // Avoid singularity at theta = +/- 90 deg
    const safe_c_the = Math.abs(c_the) < 1e-6 ? 1e-6 : c_the;
    const safe_tan_the = Math.abs(c_the) < 1e-6 ? 1e6 : tan_the;

    const d_phi_dt = angularVelocityBody.x + angularVelocityBody.y * (s_phi * safe_tan_the) + angularVelocityBody.z * (c_phi * safe_tan_the);
    const d_theta_dt = angularVelocityBody.y * c_phi - angularVelocityBody.z * s_phi;
    const d_psi_dt = angularVelocityBody.y * (s_phi / safe_c_the) + angularVelocityBody.z * (c_phi / safe_c_the);

    return {
      position: dp_dt,
      velocityBody: dv_dt,
      orientation: { x: d_phi_dt, y: d_theta_dt, z: d_psi_dt },
      angularVelocityBody: d_omega_dt,
      linearAccelerationBody: dv_dt, // for reporting
      angularAccelerationBody: d_omega_dt // for reporting
    };
  }

  /**
   * Performs one time step integration (Euler method).
   */
  public static step(
    state: IState,
    properties: IProps,
    forces: IForce[],
    dt: number,
    gravityMS2: number
  ): IState {
    const derivatives = this.computeDerivatives(state, properties, forces, gravityMS2);

    return {
      position: {
        x: state.position.x + derivatives.position.x * dt,
        y: state.position.y + derivatives.position.y * dt,
        z: state.position.z + derivatives.position.z * dt
      },
      velocityBody: {
        x: state.velocityBody.x + derivatives.velocityBody.x * dt,
        y: state.velocityBody.y + derivatives.velocityBody.y * dt,
        z: state.velocityBody.z + derivatives.velocityBody.z * dt
      },
      orientation: {
        x: state.orientation.x + derivatives.orientation.x * dt,
        y: state.orientation.y + derivatives.orientation.y * dt,
        z: state.orientation.z + derivatives.orientation.z * dt
      },
      angularVelocityBody: {
        x: state.angularVelocityBody.x + derivatives.angularVelocityBody.x * dt,
        y: state.angularVelocityBody.y + derivatives.angularVelocityBody.y * dt,
        z: state.angularVelocityBody.z + derivatives.angularVelocityBody.z * dt
      },
      linearAccelerationBody: derivatives.linearAccelerationBody,
      angularAccelerationBody: derivatives.angularAccelerationBody
    };
  }
}
