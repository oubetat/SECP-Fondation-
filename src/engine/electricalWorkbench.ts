/**
 * PATCH-SECP-012 — Electrical Workbench & Circuit Simulator Engine
 * Entities: Wire, Connector, Switch, Fuse, Relay, Motor, Power Supply, Sensor.
 * Solves Electrical Schematics, Wire Voltage Drops, Overcurrent Fuse Blown states,
 * Relay Logic, Motor Operations, and Sensor Telemetry.
 */

export type ElectricalComponentType =
  | 'WIRE'
  | 'CONNECTOR'
  | 'SWITCH'
  | 'FUSE'
  | 'RELAY'
  | 'MOTOR'
  | 'POWER_SUPPLY'
  | 'SENSOR';

export interface ElectricalComponent {
  id: string;
  name: string;
  type: ElectricalComponentType;
  voltageRatingV?: number;
  currentRatingA?: number;
  resistanceOhms?: number;
  state?: 'OPEN' | 'CLOSED' | 'INTACT' | 'BLOWN' | 'RUNNING' | 'STOPPED' | 'TRIGGERED';
  pinCount?: number;
  wireGaugeMm2?: number;
  lengthM?: number;
  sensorValue?: number; // e.g. 85°C or 5 bar
  sensorUnit?: string;
  colorHex?: string;
}

export interface ElectricalNetConnection {
  id: string;
  fromComponentId: string;
  toComponentId: string;
  wireGaugeMm2: number;
  lengthM: number;
}

export interface CircuitSolveResult {
  isPowerOn: boolean;
  busVoltageV: number;
  totalCurrentDrawA: number;
  totalPowerWatts: number;
  voltageDropV: number;
  fuseStatus: 'INTACT' | 'BLOWN';
  relayCoilActive: boolean;
  motorRunning: boolean;
  motorSpeedRpm: number;
  sensorSignalVolts: number;
  warningMessage?: string;
  componentStates: Record<string, string>;
}

export class ElectricalWorkbenchEngine {
  public static getDefaultCircuitComponents(): ElectricalComponent[] {
    return [
      {
        id: 'ps1',
        name: 'Industrial 24V DC Power Supply',
        type: 'POWER_SUPPLY',
        voltageRatingV: 24,
        currentRatingA: 15,
        colorHex: '#3b82f6'
      },
      {
        id: 'fuse1',
        name: 'Main Protective Fuse (10A)',
        type: 'FUSE',
        currentRatingA: 10,
        resistanceOhms: 0.05,
        state: 'INTACT',
        colorHex: '#eab308'
      },
      {
        id: 'sw1',
        name: 'Control Panel Start Pushbutton',
        type: 'SWITCH',
        state: 'CLOSED',
        resistanceOhms: 0.02,
        colorHex: '#10b981'
      },
      {
        id: 'relay1',
        name: 'Control Coil Relay (24V DC)',
        type: 'RELAY',
        voltageRatingV: 24,
        resistanceOhms: 120, // coil
        state: 'TRIGGERED',
        colorHex: '#a855f7'
      },
      {
        id: 'conn1',
        name: 'IP67 Heavy Industrial Connector',
        type: 'CONNECTOR',
        pinCount: 4,
        currentRatingA: 20,
        resistanceOhms: 0.01,
        colorHex: '#64748b'
      },
      {
        id: 'wire1',
        name: 'Copper Feeder Harness Wire',
        type: 'WIRE',
        wireGaugeMm2: 2.5,
        lengthM: 12,
        resistanceOhms: 0.16,
        colorHex: '#f97316'
      },
      {
        id: 'motor1',
        name: 'Coolant Pump DC Motor (180W)',
        type: 'MOTOR',
        voltageRatingV: 24,
        currentRatingA: 7.5,
        resistanceOhms: 3.2,
        state: 'RUNNING',
        colorHex: '#06b6d4'
      },
      {
        id: 'sens1',
        name: 'PT100 Temperature Sensor',
        type: 'SENSOR',
        sensorValue: 72.5,
        sensorUnit: '°C',
        voltageRatingV: 24,
        colorHex: '#f43f5e'
      }
    ];
  }

  /**
   * Evaluates complete electrical circuit state and netlist power flow
   */
  public static solveCircuit(
    components: ElectricalComponent[],
    isPowerSwitchOn: boolean
  ): CircuitSolveResult {
    const componentStates: Record<string, string> = {};

    if (!isPowerSwitchOn) {
      components.forEach(c => {
        if (c.type === 'MOTOR') componentStates[c.id] = 'STOPPED';
        else if (c.type === 'RELAY') componentStates[c.id] = 'OPEN';
        else componentStates[c.id] = c.state || 'OPEN';
      });
      return {
        isPowerOn: false,
        busVoltageV: 0,
        totalCurrentDrawA: 0,
        totalPowerWatts: 0,
        voltageDropV: 0,
        fuseStatus: 'INTACT',
        relayCoilActive: false,
        motorRunning: false,
        motorSpeedRpm: 0,
        sensorSignalVolts: 0,
        warningMessage: 'Main Power Switch OFF',
        componentStates
      };
    }

    const ps = components.find(c => c.type === 'POWER_SUPPLY') || components[0];
    const fuse = components.find(c => c.type === 'FUSE');
    const sw = components.find(c => c.type === 'SWITCH');
    const motor = components.find(c => c.type === 'MOTOR');
    const wire = components.find(c => c.type === 'WIRE');
    const sens = components.find(c => c.type === 'SENSOR');

    const busVoltage = ps.voltageRatingV || 24;

    // Check Switch State
    const switchClosed = sw ? sw.state === 'CLOSED' : true;

    // Calculate total resistance R_total
    const motorResistance = motor ? motor.resistanceOhms || 3.2 : 3.2;
    const wireResistance = wire ? wire.resistanceOhms || 0.16 : 0.16;
    const fuseResistance = fuse ? fuse.resistanceOhms || 0.05 : 0.05;

    const totalR = motorResistance + wireResistance + fuseResistance;
    const totalCurrentA = switchClosed ? busVoltage / totalR : 0;

    // Fuse blown check
    let fuseStatus: 'INTACT' | 'BLOWN' = fuse?.state === 'BLOWN' ? 'BLOWN' : 'INTACT';
    const fuseRating = fuse?.currentRatingA || 10;
    if (totalCurrentA > fuseRating) {
      fuseStatus = 'BLOWN';
    }

    const isCircuitLive = switchClosed && fuseStatus === 'INTACT';

    const actualCurrentA = isCircuitLive ? totalCurrentA : 0;
    const totalPowerWatts = busVoltage * actualCurrentA;
    const voltageDropV = actualCurrentA * wireResistance;

    const motorRunning = isCircuitLive && actualCurrentA > 1.0;
    const motorRpm = motorRunning ? 2850 : 0;

    const sensorVolts = sens ? Math.min(10, ((sens.sensorValue || 25) / 100) * 10) : 7.25;

    components.forEach(c => {
      if (c.type === 'FUSE') componentStates[c.id] = fuseStatus;
      else if (c.type === 'MOTOR') componentStates[c.id] = motorRunning ? 'RUNNING' : 'STOPPED';
      else if (c.type === 'RELAY') componentStates[c.id] = isCircuitLive ? 'TRIGGERED' : 'OPEN';
      else componentStates[c.id] = c.state || 'CLOSED';
    });

    let warningMessage: string | undefined = undefined;
    if (fuseStatus === 'BLOWN') {
      warningMessage = `CRITICAL OVERCURRENT: Circuit Current (${actualCurrentA.toFixed(1)}A) exceeded Fuse rating (${fuseRating}A). Fuse BLOWN!`;
    }

    return {
      isPowerOn: isCircuitLive,
      busVoltageV: isCircuitLive ? busVoltage : 0,
      totalCurrentDrawA: actualCurrentA,
      totalPowerWatts,
      voltageDropV,
      fuseStatus,
      relayCoilActive: isCircuitLive,
      motorRunning,
      motorSpeedRpm: motorRpm,
      sensorSignalVolts: sensorVolts,
      warningMessage,
      componentStates
    };
  }
}
