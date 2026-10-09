/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — Machine Definition Registry
 * 
 * Houses standard physical CNC machine models with rigorous axis limits,
 * rotary bounds, spindle torque/speed limits, and kinematics integration.
 */

import { MachineDefinition, AxisDefinition, AxisName, UnitsMode } from './PostTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export class MachineDefinitionRegistry {
  private static machines: Map<string, MachineDefinition> = new Map();

  /**
   * Initializes standard industrial machines
   */
  public static async initialize(): Promise<void> {
    if (this.machines.size > 0) return;

    // 1. HAAS VF-4SS (3-Axis High-Speed VMC)
    const haasVF4SS = await this.buildMachine({
      machineId: 'MACHINE_HAAS_VF4SS',
      name: 'Haas VF-4SS (3-Axis VMC)',
      manufacturer: 'Haas Automation',
      machineType: 'MILL_3AXIS',
      controllerDialect: 'HAAS_NGC',
      defaultUnits: 'METRIC_MM',
      axes: {
        X: { name: 'X', type: 'LINEAR', minLimit: -635, maxLimit: 635, maxFeedRate: 21200, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Y: { name: 'Y', type: 'LINEAR', minLimit: -254, maxLimit: 254, maxFeedRate: 21200, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Z: { name: 'Z', type: 'LINEAR', minLimit: -50, maxLimit: 635, maxFeedRate: 21200, resolution: 0.001, units: 'MM', direction: 1, homePosition: 635 },
        A: { name: 'A', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        B: { name: 'B', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        C: { name: 'C', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        U: { name: 'U', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        V: { name: 'V', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        W: { name: 'W', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 }
      },
      spindle: {
        minRpm: 50,
        maxRpm: 12000,
        maxPowerKw: 22.4,
        maxTorqueNm: 122,
        directionSupport: ['CW', 'CCW'],
        coolantMethods: ['M8_FLOOD', 'M7_MIST', 'M88_THROUGH_SPINDLE', 'M9_OFF']
      },
      toolChanger: {
        capacity: 30,
        maxToolDiameterMm: 89,
        maxToolLengthMm: 330,
        maxToolWeightKg: 5.4,
        toolChangeTimeSec: 2.2
      }
    });
    this.machines.set(haasVF4SS.machineId, haasVF4SS);

    // 2. DMG MORI DMU 50 (5-Axis Table-Table Trunnion B/C)
    const dmgDMU50 = await this.buildMachine({
      machineId: 'MACHINE_DMG_DMU50',
      name: 'DMG MORI DMU 50 (5-Axis Trunnion)',
      manufacturer: 'DMG MORI',
      machineType: 'MILL_5AXIS',
      architecture: 'TABLE_TABLE',
      controllerDialect: 'SIEMENS_840D',
      defaultUnits: 'METRIC_MM',
      axes: {
        X: { name: 'X', type: 'LINEAR', minLimit: -325, maxLimit: 325, maxFeedRate: 30000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 0 },
        Y: { name: 'Y', type: 'LINEAR', minLimit: -260, maxLimit: 260, maxFeedRate: 30000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 0 },
        Z: { name: 'Z', type: 'LINEAR', minLimit: -10, maxLimit: 475, maxFeedRate: 30000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 475 },
        A: { name: 'A', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0 },
        B: { name: 'B', type: 'ROTARY', minLimit: -35, maxLimit: 110, maxFeedRate: 20000, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0 },
        C: { name: 'C', type: 'ROTARY', minLimit: -360, maxLimit: 360, maxFeedRate: 30000, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0, rotaryContinuous: true },
        U: { name: 'U', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        V: { name: 'V', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        W: { name: 'W', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 }
      },
      spindle: {
        minRpm: 20,
        maxRpm: 15000,
        maxPowerKw: 21.0,
        maxTorqueNm: 111,
        directionSupport: ['CW', 'CCW'],
        coolantMethods: ['M8_FLOOD', 'M88_THROUGH_SPINDLE', 'M9_OFF']
      },
      toolChanger: {
        capacity: 60,
        maxToolDiameterMm: 130,
        maxToolLengthMm: 300,
        maxToolWeightKg: 6.0,
        toolChangeTimeSec: 1.8
      }
    });
    this.machines.set(dmgDMU50.machineId, dmgDMU50);

    // 3. HERMLE C42 U (5-Axis Table-Table A/C Trunnion)
    const hermleC42U = await this.buildMachine({
      machineId: 'MACHINE_HERMLE_C42U',
      name: 'Hermle C42 U Dynamic (5-Axis A/C)',
      manufacturer: 'Maschinenfabrik Berthold Hermle AG',
      machineType: 'MILL_5AXIS',
      architecture: 'TABLE_TABLE',
      controllerDialect: 'HEIDENHAIN_TNC640',
      defaultUnits: 'METRIC_MM',
      axes: {
        X: { name: 'X', type: 'LINEAR', minLimit: -400, maxLimit: 400, maxFeedRate: 45000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 0 },
        Y: { name: 'Y', type: 'LINEAR', minLimit: -400, maxLimit: 400, maxFeedRate: 45000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 0 },
        Z: { name: 'Z', type: 'LINEAR', minLimit: 0, maxLimit: 550, maxFeedRate: 45000, resolution: 0.0001, units: 'MM', direction: 1, homePosition: 550 },
        A: { name: 'A', type: 'ROTARY', minLimit: -130, maxLimit: 130, maxFeedRate: 25000, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0 },
        B: { name: 'B', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0 },
        C: { name: 'C', type: 'ROTARY', minLimit: -360, maxLimit: 360, maxFeedRate: 40000, resolution: 0.0001, units: 'DEG', direction: 1, homePosition: 0, rotaryContinuous: true },
        U: { name: 'U', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        V: { name: 'V', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        W: { name: 'W', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 }
      },
      spindle: {
        minRpm: 10,
        maxRpm: 18000,
        maxPowerKw: 35.0,
        maxTorqueNm: 175,
        directionSupport: ['CW', 'CCW'],
        coolantMethods: ['M8_FLOOD', 'M88_THROUGH_SPINDLE', 'M9_OFF']
      },
      toolChanger: {
        capacity: 42,
        maxToolDiameterMm: 125,
        maxToolLengthMm: 300,
        maxToolWeightKg: 8.0,
        toolChangeTimeSec: 1.5
      }
    });
    this.machines.set(hermleC42U.machineId, hermleC42U);

    // 4. FANUC ROBODRILL α-D21LiB5 (3/4-Axis Compact Machining Center)
    const fanucRobodrill = await this.buildMachine({
      machineId: 'MACHINE_FANUC_ROBODRILL',
      name: 'FANUC ROBODRILL α-D21LiB5',
      manufacturer: 'FANUC Corporation',
      machineType: 'MILL_4AXIS',
      controllerDialect: 'FANUC_31I',
      defaultUnits: 'METRIC_MM',
      axes: {
        X: { name: 'X', type: 'LINEAR', minLimit: -350, maxLimit: 350, maxFeedRate: 48000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Y: { name: 'Y', type: 'LINEAR', minLimit: -200, maxLimit: 200, maxFeedRate: 48000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Z: { name: 'Z', type: 'LINEAR', minLimit: 0, maxLimit: 330, maxFeedRate: 56000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 330 },
        A: { name: 'A', type: 'ROTARY', minLimit: -360, maxLimit: 360, maxFeedRate: 36000, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0, rotaryContinuous: true },
        B: { name: 'B', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        C: { name: 'C', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        U: { name: 'U', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        V: { name: 'V', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        W: { name: 'W', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 }
      },
      spindle: {
        minRpm: 100,
        maxRpm: 24000,
        maxPowerKw: 11.0,
        maxTorqueNm: 40,
        directionSupport: ['CW', 'CCW'],
        coolantMethods: ['M8_FLOOD', 'M88_THROUGH_SPINDLE', 'M9_OFF']
      },
      toolChanger: {
        capacity: 21,
        maxToolDiameterMm: 80,
        maxToolLengthMm: 250,
        maxToolWeightKg: 3.0,
        toolChangeTimeSec: 0.9
      }
    });
    this.machines.set(fanucRobodrill.machineId, fanucRobodrill);

    // 5. GENERIC ISO 3-AXIS VMC (Reference Baseline)
    const generic3Axis = await this.buildMachine({
      machineId: 'MACHINE_GENERIC_ISO_3X',
      name: 'Generic ISO 3-Axis VMC (Baseline)',
      manufacturer: 'SECP Engineering OS',
      machineType: 'MILL_3AXIS',
      controllerDialect: 'GENERIC_ISO',
      defaultUnits: 'METRIC_MM',
      axes: {
        X: { name: 'X', type: 'LINEAR', minLimit: -500, maxLimit: 500, maxFeedRate: 20000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Y: { name: 'Y', type: 'LINEAR', minLimit: -300, maxLimit: 300, maxFeedRate: 20000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        Z: { name: 'Z', type: 'LINEAR', minLimit: 0, maxLimit: 400, maxFeedRate: 20000, resolution: 0.001, units: 'MM', direction: 1, homePosition: 400 },
        A: { name: 'A', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        B: { name: 'B', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        C: { name: 'C', type: 'ROTARY', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'DEG', direction: 1, homePosition: 0 },
        U: { name: 'U', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        V: { name: 'V', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 },
        W: { name: 'W', type: 'LINEAR', minLimit: 0, maxLimit: 0, maxFeedRate: 0, resolution: 0.001, units: 'MM', direction: 1, homePosition: 0 }
      },
      spindle: {
        minRpm: 50,
        maxRpm: 10000,
        maxPowerKw: 15.0,
        maxTorqueNm: 95,
        directionSupport: ['CW', 'CCW'],
        coolantMethods: ['M8_FLOOD', 'M9_OFF']
      },
      toolChanger: {
        capacity: 24,
        maxToolDiameterMm: 100,
        maxToolLengthMm: 250,
        maxToolWeightKg: 5.0,
        toolChangeTimeSec: 3.0
      }
    });
    this.machines.set(generic3Axis.machineId, generic3Axis);
  }

  private static async buildMachine(props: Omit<MachineDefinition, 'entityHash'>): Promise<MachineDefinition> {
    const hash = await generateDeterministicHash({
      machineId: props.machineId,
      name: props.name,
      manufacturer: props.manufacturer,
      machineType: props.machineType,
      controllerDialect: props.controllerDialect,
      axes: props.axes,
      spindle: props.spindle
    });

    return {
      ...props,
      entityHash: hash
    };
  }

  public static getAllMachines(): MachineDefinition[] {
    return Array.from(this.machines.values());
  }

  public static getMachineById(id: string): MachineDefinition | undefined {
    return this.machines.get(id);
  }
}
