/**
 * SECP Engineering Core — EPC-027: Flight Dynamics Engine
 * Implements the full 6-DOF flight dynamics for the Industrial Drone.
 * Reuses the generic RigidBodyDynamicsEngine.
 */

import { Vector3 } from '../../geometry/GeometryTypes';
import { 
  RigidBodyState, 
  RigidBodyProperties, 
  ForceVector, 
  SimulationStepResult 
} from '../../physics/dynamics/RigidBodyTypes';
import { RigidBodyDynamicsEngine } from '../../physics/dynamics/RigidBodyDynamicsEngine';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { DroneAerodynamicModelManager } from '../aerodynamics/DroneAerodynamicModelManager';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';

export interface FlightDynamicsOutput {
  timestampS: number;
  state: RigidBodyState;
  forces: ForceVector[];
  totalForceBody: Vector3;
  totalMomentBody: Vector3;
}

export class FlightDynamicsEngine {
  private state: RigidBodyState;
  private properties: RigidBodyProperties;
  private trajectory: FlightDynamicsOutput[] = [];
  private currentTimeS: number = 0;

  constructor(
    private massManager: DroneMassPropertiesManager,
    private propulsionManager: DronePropulsionManager,
    private aeroManager: DroneAerodynamicModelManager,
    initialState?: RigidBodyState
  ) {
    // 1. Load Mass Properties from EPC-022
    const massProps = this.massManager.evaluateCompleteAssemblyMassProperties();
    this.properties = {
      massKg: massProps.mass,
      centerOfGravity: massProps.centerOfMass || { x: 0, y: 0, z: 0 },
      inertiaTensor: massProps.inertiaTensor || [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ]
    };

    // 2. Initialize State with safe fallbacks
    this.state = {
      position: initialState?.position ? { ...initialState.position } : { x: 0, y: 0, z: 0 },
      velocityBody: initialState?.velocityBody ? { ...initialState.velocityBody } : { x: 0, y: 0, z: 0 },
      orientation: (initialState as any)?.orientation ? { ...(initialState as any).orientation } : { x: 0, y: 0, z: 0 },
      angularVelocityBody: initialState?.angularVelocityBody ? { ...initialState.angularVelocityBody } : { x: 0, y: 0, z: 0 },
      linearAccelerationBody: { x: 0, y: 0, z: 0 },
      angularAccelerationBody: { x: 0, y: 0, z: 0 }
    };
  }

  /**
   * Advances the simulation by one time step.
   */
  public step(dt: number, gravityMS2: number = 9.80665): FlightDynamicsOutput {
    // 1. Aggregate Forces from Propulsion (EPC-023)
    const propulsionResults = this.propulsionManager.computePropulsionSystemResults();
    const propForce: ForceVector = {
      id: 'propulsion-force',
      source: 'EPC-023',
      force: propulsionResults.totalThrustVectorGlobal, // Manager says Global but it's really Body/Assembly in its code
      moment: propulsionResults.totalPropulsionMomentGlobal,
      frame: 'BODY'
    };

    // 2. Aggregate Forces from Aerodynamics (EPC-024)
    // Aero model needs current altitude and velocity
    this.aeroManager.setFlightConditions(
      this.state.position.z,
      this.state.velocityBody, // Should be relative to air, but we assume no wind for now
      this.state.angularVelocityBody
    );
    const aeroResults = this.aeroManager.evaluateAerodynamicModel();
    const aeroForce: ForceVector = {
      id: 'aerodynamic-force',
      source: 'EPC-024',
      force: {
        x: -aeroResults.forcesAndMoments.dragN, // Drag is opposite to velocity in Body frame (approx)
        y: aeroResults.forcesAndMoments.sideForceN,
        z: aeroResults.forcesAndMoments.liftN
      },
      moment: {
        x: aeroResults.forcesAndMoments.rollMomentNm,
        y: aeroResults.forcesAndMoments.pitchMomentNm,
        z: aeroResults.forcesAndMoments.yawMomentNm
      },
      frame: 'BODY'
    };

    const forces = [propForce, aeroForce];

    // 3. Propagate State using generic Rigid Body Engine
    const nextState = RigidBodyDynamicsEngine.step(
      this.state,
      this.properties,
      forces,
      dt,
      gravityMS2
    );

    // 4. Update State and record trajectory
    this.state = nextState;
    this.currentTimeS += dt;

    const output: FlightDynamicsOutput = {
      timestampS: this.currentTimeS,
      state: { ...this.state },
      forces,
      totalForceBody: { x: 0, y: 0, z: 0 }, // Would be calculated in step if needed
      totalMomentBody: { x: 0, y: 0, z: 0 }
    };

    this.trajectory.push(output);
    return output;
  }

  public getTrajectory(): FlightDynamicsOutput[] {
    return this.trajectory;
  }

  public getCurrentState(): RigidBodyState {
    return this.state;
  }

  public getProperties(): RigidBodyProperties {
    return this.properties;
  }
}
