import { describe, it, expect } from 'vitest';
import { EPC027Verifier } from '../dynamics/EPC027Verifier';
import { FlightDynamicsEngine } from '../dynamics/FlightDynamicsEngine';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { DroneAerodynamicModelManager } from '../aerodynamics/DroneAerodynamicModelManager';

describe('EPC-027 — FLIGHT DYNAMICS Verification', () => {
  it('should pass all numerical sanity tests', async () => {
    const results = await EPC027Verifier.runFullVerification();
    
    results.forEach(res => {
      console.log(`[${res.testId}] ${res.name}: ${res.status}`);
      if (res.status === 'FAIL') {
        console.error(`  Details: ${res.details}`);
      }
      expect(res.status).toBe('PASS');
    });
  });

  it('should maintain coordinate frame consistency (Body vs World)', () => {
    const mass = new DroneMassPropertiesManager();
    const prop = new DronePropulsionManager(mass);
    const aero = new DroneAerodynamicModelManager(undefined, prop, mass);
    
    const engine = new FlightDynamicsEngine(mass, prop, aero);
    
    // Rotate 90 degrees about Z (Yaw = 90 deg)
    const initialState = {
      position: { x: 0, y: 0, z: 0 },
      velocityBody: { x: 10, y: 0, z: 0 }, // Moving forward in Body frame
      orientation: { x: 0, y: 0, z: Math.PI / 2 }, // Yaw = 90 deg
      angularVelocityBody: { x: 0, y: 0, z: 0 },
      linearAccelerationBody: { x: 0, y: 0, z: 0 },
      angularAccelerationBody: { x: 0, y: 0, z: 0 }
    };
    
    const engineWithRotation = new FlightDynamicsEngine(mass, prop, aero, initialState);
    
    // One step of 1s (Euler: pos_new = pos_old + vel_world * dt)
    // vel_world = R_bw * [10, 0, 0] = [0, 10, 0] for yaw=90
    const result = engineWithRotation.step(1.0, 0); // No gravity
    
    expect(result.state.position.x).toBeCloseTo(0, 5);
    expect(result.state.position.y).toBeCloseTo(10, 5);
  });

  it('should correctly aggregate forces from different sources', () => {
    const mass = new DroneMassPropertiesManager();
    const prop = new DronePropulsionManager(mass);
    const aero = new DroneAerodynamicModelManager(undefined, prop, mass);
    
    const engine = new FlightDynamicsEngine(mass, prop, aero);
    
    // Set 50% throttle
    prop.setOperatingPoint(5000, 24, 20);
    
    const output = engine.step(0.1, 9.81);
    
    expect(output.forces.length).toBe(2); // Propulsion + Aero
    expect(output.forces.find(f => f.id === 'propulsion-force')).toBeDefined();
    expect(output.forces.find(f => f.id === 'aerodynamic-force')).toBeDefined();
  });

  it('should demonstrate reproducibility (Deterministic trajectory)', () => {
    const setup = () => {
      const mass = new DroneMassPropertiesManager();
      const prop = new DronePropulsionManager(mass);
      const aero = new DroneAerodynamicModelManager(undefined, prop, mass);
      return new FlightDynamicsEngine(mass, prop, aero);
    };

    const engine1 = setup();
    const engine2 = setup();

    const traj1 = [];
    const traj2 = [];

    for (let i = 0; i < 10; i++) {
      traj1.push(engine1.step(0.01, 9.81));
      traj2.push(engine2.step(0.01, 9.81));
    }

    const last1 = traj1[9].state;
    const last2 = traj2[9].state;

    expect(last1.position.z).toBe(last2.position.z);
    expect(last1.velocityBody.z).toBe(last2.velocityBody.z);
  });
});
