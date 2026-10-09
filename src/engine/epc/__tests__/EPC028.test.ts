import { describe, it, expect } from 'vitest';
import { EPC028Verifier } from '../mission/EPC028Verifier';
import { MissionSimulationEngine } from '../mission/MissionSimulationEngine';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { DroneAerodynamicModelManager } from '../aerodynamics/DroneAerodynamicModelManager';

describe('EPC-028 — MISSION SIMULATION Verification', () => {
  it('should execute end-to-end mission successfully', async () => {
    const result = await EPC028Verifier.runEndToEndMission();
    
    console.log(`Mission Verdict: ${result.verdict}`);
    result.segmentResults.forEach(seg => {
      console.log(`  Segment ${seg.segmentId}: ${seg.verdict} (${seg.durationS.toFixed(1)}s, ${seg.energyConsumedJ.toFixed(0)} J)`);
    });

    expect(result.verdict).toBe('PASS');
    expect(result.trajectory.length).toBeGreaterThan(0);
    expect(result.segmentResults.length).toBe(3);
  });

  it('should track energy consumption throughout the mission', async () => {
    const result = await EPC028Verifier.runEndToEndMission();
    
    const initialEnergy = 500000;
    const finalEnergy = result.trajectory[result.trajectory.length - 1].energyJ;
    
    expect(finalEnergy).toBeLessThan(initialEnergy);
    
    const totalEnergyConsumed = result.segmentResults.reduce((acc, s) => acc + s.energyConsumedJ, 0);
    expect(initialEnergy - finalEnergy).toBeCloseTo(totalEnergyConsumed, 1);
  });

  it('should fail mission if energy is depleted', async () => {
    const massManager = new DroneMassPropertiesManager();
    const propulsionManager = new DronePropulsionManager(massManager);
    const aeroManager = new DroneAerodynamicModelManager(undefined, propulsionManager, massManager);

    const definition: any = {
      missionId: 'FAIL-MISSION',
      initialState: {
        position: { x: 0, y: 0, z: 0 },
        velocityBody: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
        angularVelocityBody: { x: 0, y: 0, z: 0 },
        initialEnergyJ: 100 // Very low energy
      },
      environment: { gravityMS2: 9.81 },
      segments: [{ segmentId: 'CLIMB', type: 'CLIMB', durationS: 10, terminationCondition: 'DURATION_EXPIRED' }],
      timeStepS: 0.1
    };

    const engine = new MissionSimulationEngine(definition, massManager, propulsionManager, aeroManager);
    const result = await engine.execute();

    expect(result.verdict).toBe('FAIL');
    expect(result.trajectory[result.trajectory.length - 1].energyJ).toBeLessThanOrEqual(0);
  });

  it('should be deterministic and reproducible', async () => {
    const run = () => EPC028Verifier.runEndToEndMission();
    
    const result1 = await run();
    const result2 = await run();

    const last1 = result1.trajectory[result1.trajectory.length - 1];
    const last2 = result2.trajectory[result2.trajectory.length - 1];

    expect(last1.position.z).toBe(last2.position.z);
    expect(last1.energyJ).toBe(last2.energyJ);
  });
});
