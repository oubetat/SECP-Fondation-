/**
 * SECP Engineering Core — Drone Optimization Solver
 * Implements the multidisciplinary evaluation logic for the Industrial Drone.
 * Orchestrates Mass, Propulsion, Aerodynamics, and Mission Simulation.
 */

import { AnalysisResultsSummary } from '../../materials/OptimizationTypes272';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { DroneAerodynamicModelManager } from '../aerodynamics/DroneAerodynamicModelManager';
import { MissionSimulationEngine } from '../mission/MissionSimulationEngine';
import { MissionSimulationDefinition } from '../mission/MissionSimulationTypes';

export class DroneOptimizationSolver {
  /**
   * The custom solver callback invoked by the EngineeringOptimizationEngine.
   */
  public static async evaluateDrone(
    params: Record<string, number>,
    materialId: string
  ): Promise<AnalysisResultsSummary> {
    // 1. Initialize Managers
    const massManager = new DroneMassPropertiesManager();
    const propulsionManager = new DronePropulsionManager(massManager);
    const aeroManager = new DroneAerodynamicModelManager(undefined, propulsionManager, massManager);

    // 2. Map Parameters to Models
    // Variable: VAR-DRONE-ARM-LENGTH
    if (params['VAR-DRONE-ARM-LENGTH']) {
      const length = params['VAR-DRONE-ARM-LENGTH'];
      // Update the 4 arm components in Mass Manager
      massManager.updateComponentGeometryParameter('INST-ARM-001', 'height', length);
      massManager.updateComponentGeometryParameter('INST-ARM-002', 'height', length);
      massManager.updateComponentGeometryParameter('INST-ARM-003', 'height', length);
      massManager.updateComponentGeometryParameter('INST-ARM-004', 'height', length);
      
      // Update Motor positions in Mass Manager and Propulsion Manager
      // Arm length is the radius from center.
      // Front Right is at (L/sqrt(2), L/sqrt(2))? No, standard in EPC022 seems to be (L, 0)?
      // Looking at EPC022 lines 148, 166, 184, 202: 
      // ARM-1: x=0.225, y=0
      // ARM-2: x=0, y=0.225
      // ARM-3: x=-0.225, y=0
      // ARM-4: x=0, y=-0.225
      // This means arm length is the position.
      
      // We also need to update MOUNT and MOTOR positions.
      // In EPC022, MOUNT and MOTOR are at x=0.45 (which is 2 * 0.225).
      // So if arm length L is the parameter, mount is at L.
      const mountPos = length;
      massManager.getAllComponents().forEach(comp => {
        if (comp.instanceId.startsWith('INST-MOUNT-') || comp.instanceId.startsWith('INST-MOTOR-') || comp.instanceId.startsWith('INST-PROP-')) {
          const unitIndex = parseInt(comp.instanceId.split('-').pop() || '1');
          if (unitIndex === 1) comp.transform.position = { x: mountPos, y: 0, z: comp.transform.position.z };
          if (unitIndex === 2) comp.transform.position = { x: 0, y: mountPos, z: comp.transform.position.z };
          if (unitIndex === 3) comp.transform.position = { x: -mountPos, y: 0, z: comp.transform.position.z };
          if (unitIndex === 4) comp.transform.position = { x: 0, y: -mountPos, z: comp.transform.position.z };
        }
      });
      
      // Synchronize Propulsion Manager positions
      const units = propulsionManager.getUnits();
      units.forEach((unit, id) => {
        const unitIndex = parseInt(id.split('-').pop() || '1');
        if (unitIndex === 1) unit.position = { x: mountPos, y: 0, z: unit.position.z };
        if (unitIndex === 2) unit.position = { x: 0, y: mountPos, z: unit.position.z };
        if (unitIndex === 3) unit.position = { x: -mountPos, y: 0, z: unit.position.z };
        if (unitIndex === 4) unit.position = { x: 0, y: -mountPos, z: unit.position.z };
      });
    }

    // Variable: VAR-DRONE-PROPELLER-DIAMETER
    if (params['VAR-DRONE-PROPELLER-DIAMETER']) {
      propulsionManager.updatePropellerDiameter(params['VAR-DRONE-PROPELLER-DIAMETER']);
    }

    // Variable: VAR-DRONE-BATTERY-CAPACITY (Wh)
    let initialEnergyJ = 500000; // 500 kJ default
    if (params['VAR-DRONE-BATTERY-CAPACITY']) {
      initialEnergyJ = params['VAR-DRONE-BATTERY-CAPACITY'] * 3600;
      // Update battery mass in Mass Manager (180 Wh/kg estimate)
      const battMass = params['VAR-DRONE-BATTERY-CAPACITY'] / 180;
      // We can update battery density or dimensions. Let's update dimensions dx.
      // dx * dy * dz * density = mass. 
      // dx = mass / (dy * dz * density)
      const dy = 0.16;
      const dz = 0.09;
      const density = 1800;
      const newDx = battMass / (dy * dz * density);
      massManager.updateComponentGeometryParameter('INST-BATT-001', 'dx', newDx);
    }

    // 3. Evaluate Multidisciplinary State
    const massProps = massManager.evaluateCompleteAssemblyMassProperties();
    const propulsionProps = propulsionManager.computePropulsionSystemResults();
    
    // Compute Thrust Margin (Max Thrust / Total Weight)
    // Max thrust at 8000 RPM (approx)
    const maxThrustN = propulsionProps.totalThrustN * (Math.pow(8000 / 5800, 2)); 
    const weightN = massProps.mass * 9.81;
    const thrustMargin = maxThrustN / weightN;

    // 4. Run Mission Simulation for Endurance
    const missionDef: MissionSimulationDefinition = {
      missionId: 'OPTIMIZATION-MISSION-EVAL',
      productId: 'DRONE-V1',
      configurationId: 'CONF-OPT',
      revision: 'REV-A',
      requirements: [],
      initialState: {
        position: { x: 0, y: 0, z: 0 },
        velocityBody: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
        angularVelocityBody: { x: 0, y: 0, z: 0 },
        linearAccelerationBody: { x: 0, y: 0, z: 0 },
        angularAccelerationBody: { x: 0, y: 0, z: 0 },
        initialEnergyJ
      },
      environment: {
        airDensityKgM3: 1.225,
        temperatureK: 288.15,
        pressurePa: 101325,
        gravityMS2: 9.81,
        windVectorMS: { x: 0, y: 0, z: 0 }
      },
      segments: [
        {
          segmentId: 'HOVER-TO-EXHAUSTION',
          type: 'HOVER',
          durationS: 3600, // 1 hour max
          terminationCondition: 'ENERGY_CRITICAL',
          acceptanceCriteria: {}
        }
      ],
      timeStepS: 1.0, // Coarse step for optimization speed
      solverConfiguration: {
        tolerance: 1e-3,
        integrationMethod: 'EULER'
      }
    };

    const missionEngine = new MissionSimulationEngine(missionDef, massManager, propulsionManager, aeroManager);
    const missionResult = await missionEngine.execute();

    const enduranceS = missionResult.segmentResults[0]?.durationS || 0;
    const energyConsumedJ = missionResult.segmentResults[0]?.energyConsumedJ || 0;

    // 5. Construct Result Summary
    return {
      massKg: massProps.mass,
      volumeM3: massProps.volume,
      manufacturingCostUSD: 5000 + massProps.mass * 100, // Heuristic
      maxVonMisesStressPa: 0, // Not evaluated in this proof case
      maxDisplacementMm: 0,
      safetyFactorFoS: thrustMargin, // Using thrust margin as a safety factor analog here
      failureIndex: 0,
      fatigueDamageRatio: 0,
      maxTempC: 25,
      pressureDropPa: 0,
      femSolverStatus: 'SIMULATED',
      cfdSolverStatus: 'NOT_APPLICABLE',
      // Drone Specifics
      missionEnduranceS: enduranceS,
      totalEnergyConsumedJ: energyConsumedJ,
      thrustMargin: thrustMargin,
      payloadMassKg: 3.2 // Constant in this study
    };
  }
}
