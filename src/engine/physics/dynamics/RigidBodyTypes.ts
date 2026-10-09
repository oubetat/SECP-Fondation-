/**
 * SECP Engineering Core — Rigid Body Dynamics Types
 * General-purpose 6-DOF dynamic state and configuration.
 */

import { Vector3 } from '../../geometry/GeometryTypes';

export interface RigidBodyState {
  // Position in World Frame (m)
  position: Vector3;
  // Linear Velocity in Body Frame (m/s)
  velocityBody: Vector3;
  // Orientation (Euler angles in rad: roll, pitch, yaw)
  orientation: Vector3; 
  // Angular Velocity in Body Frame (rad/s)
  angularVelocityBody: Vector3;
  
  // Derivatives (optional for reporting)
  linearAccelerationBody: Vector3;
  angularAccelerationBody: Vector3;
}

export interface RigidBodyProperties {
  massKg: number;
  // Center of Gravity offset from Body Frame origin (m)
  centerOfGravity: Vector3;
  // Inertia Tensor in Body Frame (kg*m^2) - 3x3 matrix
  inertiaTensor: number[][];
}

export interface ForceVector {
  id: string;
  source: string;
  force: Vector3; // (N)
  moment: Vector3; // (N*m)
  frame: 'BODY' | 'WORLD';
}

export interface SimulationStepResult {
  timeS: number;
  state: RigidBodyState;
  appliedForces: ForceVector[];
  totalForceBody: Vector3;
  totalMomentBody: Vector3;
}

export interface SimulationScenario {
  id: string;
  initialState: RigidBodyState;
  properties: RigidBodyProperties;
  durationS: number;
  timeStepS: number;
  gravityMS2: number;
}
