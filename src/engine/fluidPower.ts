/**
 * PATCH-SECP-014 — Hydraulic & Pneumatic Power Engine
 * Entities: Pump, Valve (Directional / Relief / Check), Cylinder, Pipe / Harness, Tank, Filter, Sensor.
 * Graph Network: Directed graph mapping Pump → Pipe → Valve → Cylinder.
 * Numerical Solver: Calculates System Pressure (bar/MPa), Flow Rate (L/min), Friction Losses, Line Velocity, and Cylinder Extension Force.
 */

export type FluidComponentType =
  | 'PUMP'
  | 'VALVE_DIRECTIONAL'
  | 'VALVE_RELIEF'
  | 'CYLINDER'
  | 'PIPE'
  | 'TANK'
  | 'FILTER'
  | 'SENSOR_PRESSURE'
  | 'SENSOR_FLOW';

export interface FluidComponent {
  id: string;
  name: string;
  type: FluidComponentType;
  flowCapacityLpm?: number; // e.g. 40 L/min
  maxPressureBar?: number; // e.g. 210 bar
  pipeDiameterMm?: number; // e.g. 12 mm
  pipeLengthM?: number;    // e.g. 5 m
  cylinderBoreMm?: number; // e.g. 63 mm
  cylinderRodMm?: number;  // e.g. 35 mm
  valveState?: 'EXTEND' | 'RETRACT' | 'NEUTRAL' | 'OPEN' | 'CLOSED';
}

export interface SystemGraphEdge {
  fromId: string;
  toId: string;
}

export interface FluidSystemSolveResult {
  isSystemActive: boolean;
  pumpPressureBar: number;
  systemFlowLpm: number;
  pipeVelocityMS: number;
  frictionLossBar: number;
  netCylinderPressureBar: number;
  cylinderForceN: number;
  cylinderSpeedMmS: number;
  fluidTemperatureC: number;
  statusMessage: string;
}

export class FluidPowerEngine {
  public static getDefaultSystemComponents(): {
    components: FluidComponent[];
    edges: SystemGraphEdge[];
  } {
    const components: FluidComponent[] = [
      {
        id: 'tank1',
        name: 'Hydraulic Fluid Reservoir Tank (100L)',
        type: 'TANK'
      },
      {
        id: 'filter1',
        name: 'Suction Line Micron Filter',
        type: 'FILTER'
      },
      {
        id: 'pump1',
        name: 'Variable Displacement Piston Pump',
        type: 'PUMP',
        flowCapacityLpm: 45,
        maxPressureBar: 210
      },
      {
        id: 'relief1',
        name: 'Main Pressure Relief Safety Valve',
        type: 'VALVE_RELIEF',
        maxPressureBar: 180,
        valveState: 'CLOSED'
      },
      {
        id: 'pipe1',
        name: 'High Pressure Steel Line Harness',
        type: 'PIPE',
        pipeDiameterMm: 12,
        pipeLengthM: 6.5
      },
      {
        id: 'valve1',
        name: '4/3-Way Directional Control Solenoid Valve',
        type: 'VALVE_DIRECTIONAL',
        valveState: 'EXTEND'
      },
      {
        id: 'cyl1',
        name: 'Heavy Industrial Double-Acting Cylinder',
        type: 'CYLINDER',
        cylinderBoreMm: 80,
        cylinderRodMm: 45
      },
      {
        id: 'sens_p',
        name: 'Digital Pressure Transducer',
        type: 'SENSOR_PRESSURE'
      }
    ];

    const edges: SystemGraphEdge[] = [
      { fromId: 'tank1', toId: 'filter1' },
      { fromId: 'filter1', toId: 'pump1' },
      { fromId: 'pump1', toId: 'pipe1' },
      { fromId: 'pipe1', toId: 'valve1' },
      { fromId: 'valve1', toId: 'cyl1' },
      { fromId: 'pump1', toId: 'relief1' },
      { fromId: 'relief1', toId: 'tank1' }
    ];

    return { components, edges };
  }

  /**
   * Solves Fluid Network Equations for Pressure, Velocity, Losses, Force
   */
  public static solveFluidNetwork(
    components: FluidComponent[],
    pumpRpm: number = 1450,
    externalLoadN: number = 35000
  ): FluidSystemSolveResult {
    const pump = components.find(c => c.type === 'PUMP');
    const dirValve = components.find(c => c.type === 'VALVE_DIRECTIONAL');
    const reliefValve = components.find(c => c.type === 'VALVE_RELIEF');
    const pipe = components.find(c => c.type === 'PIPE');
    const cyl = components.find(c => c.type === 'CYLINDER');

    if (!pump || dirValve?.valveState === 'NEUTRAL') {
      return {
        isSystemActive: false,
        pumpPressureBar: 0,
        systemFlowLpm: 0,
        pipeVelocityMS: 0,
        frictionLossBar: 0,
        netCylinderPressureBar: 0,
        cylinderForceN: 0,
        cylinderSpeedMmS: 0,
        fluidTemperatureC: 22,
        statusMessage: 'Directional Valve in NEUTRAL position — Bypass to tank.'
      };
    }

    // Flow Q = pump capacity scaled by RPM
    const maxFlow = pump.flowCapacityLpm || 45;
    const systemFlowLpm = maxFlow * (pumpRpm / 1450); // L/min
    const flowM3S = (systemFlowLpm / 1000) / 60; // m³/s

    // Pipe fluid velocity v = Q / A
    const pipeDiamM = (pipe?.pipeDiameterMm || 12) / 1000;
    const pipeAreaM2 = (Math.PI / 4) * Math.pow(pipeDiamM, 2);
    const pipeVelocityMS = flowM3S / pipeAreaM2;

    // Darcy-Weisbach pressure drop calculation (Hydraulic Oil ISO VG 46: rho ~ 870 kg/m³, mu ~ 0.04 Pa·s)
    const rho = 870;
    const pipeLengthM = pipe?.pipeLengthM || 6.5;
    const frictionFactor = 0.035;
    const deltaP_Pascal = frictionFactor * (pipeLengthM / pipeDiamM) * (0.5 * rho * Math.pow(pipeVelocityMS, 2));
    const frictionLossBar = deltaP_Pascal / 1e5; // Convert Pa to bar

    // Cylinder Area Calculation
    const boreM = (cyl?.cylinderBoreMm || 80) / 1000;
    const boreAreaM2 = (Math.PI / 4) * Math.pow(boreM, 2);

    // Required pressure to overcome external load
    const loadPressurePascal = externalLoadN / boreAreaM2;
    const loadPressureBar = loadPressurePascal / 1e5;

    const totalRequiredPressureBar = loadPressureBar + frictionLossBar + 12; // +12 bar valve resistance
    const reliefSettingBar = reliefValve?.maxPressureBar || 180;

    let pumpPressureBar = totalRequiredPressureBar;
    let statusMessage = 'Normal Hydraulic Extension Operation';

    if (totalRequiredPressureBar > reliefSettingBar) {
      pumpPressureBar = reliefSettingBar;
      statusMessage = 'RELIEF VALVE TRIGGERED: Load pressure exceeds safety relief setpoint!';
    }

    const netCylinderPressureBar = Math.max(0, pumpPressureBar - frictionLossBar - 12);
    const cylinderForceN = netCylinderPressureBar * 1e5 * boreAreaM2;

    // Cylinder motion speed v_cyl = Q / A_piston
    const cylinderSpeedMS = flowM3S / boreAreaM2;
    const cylinderSpeedMmS = cylinderSpeedMS * 1000;

    return {
      isSystemActive: true,
      pumpPressureBar,
      systemFlowLpm,
      pipeVelocityMS,
      frictionLossBar,
      netCylinderPressureBar,
      cylinderForceN,
      cylinderSpeedMmS,
      fluidTemperatureC: 48.5,
      statusMessage
    };
  }
}
