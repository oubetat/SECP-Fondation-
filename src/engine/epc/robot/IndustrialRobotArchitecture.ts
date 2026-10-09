/**
 * SECP Industrial OS — EPC-037: Industrial Robot Architecture Factory & Bridge
 * Generates authoritative 6-DOF Industrial Robotic Arm system architecture,
 * and seamlessly bridges it with SECP Core ProductArchitecture & Evidence infrastructure.
 */

import {
  RobotActuator,
  RobotArchitectureRelation,
  RobotComponent,
  RobotControllerSystem,
  RobotEndEffectorSubsystem,
  RobotJoint,
  RobotPowerSubsystem,
  RobotSensor,
  RobotSystem
} from './RobotArchitectureTypes';
import {
  ArchitectureComponent,
  ProductArchitecture,
  SubsystemDefinition,
  SystemInterface
} from '../architecture/ProductArchitectureTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export interface IndustrialRobotConfigOptions {
  readonly robotId?: string;
  readonly name?: string;
  readonly revision?: string;
  readonly payloadMassKg?: number;
  readonly reachRadiusMm?: number;
  readonly configurationId?: string;
}

export class IndustrialRobotArchitecture {
  public static readonly DEFAULT_ROBOT_ID = 'ROBOT-ARM-6DOF-10KG';
  public static readonly DEFAULT_NAME = 'SECP 6-Axis Articulated Industrial Robotic Arm';
  public static readonly CASE_ID = 'EPC-CASE-002';

  /**
   * Constructs a complete, highly detailed 6-DOF Industrial Robotic Arm System Architecture.
   */
  public static createDefaultIndustrialRobot(options?: IndustrialRobotConfigOptions): RobotSystem {
    const id = options?.robotId || this.DEFAULT_ROBOT_ID;
    const name = options?.name || this.DEFAULT_NAME;
    const revision = options?.revision || '1.0';
    const configurationId = options?.configurationId || `CFG-${id}-BASE`;
    const payloadKg = options?.payloadMassKg || 10.0;
    const reachMm = options?.reachRadiusMm || 1100.0;

    // 1. COMPONENTS (Mechanical System & Structure)
    const components: RobotComponent[] = [
      {
        id: 'COMP-ROB-BASE',
        type: 'BASE',
        partId: 'PART-ROB-BASE-01',
        material: 'Ductile Cast Iron GGG-40',
        mass: 32.5,
        geometryRef: 'CAD/ROBOT/BASE_PEDESTAL.STEP',
        revision
      },
      {
        id: 'COMP-ROB-SHOULDER',
        type: 'LINK_1',
        partId: 'PART-ROB-LINK1-01',
        material: 'Cast Aluminum A356-T6',
        mass: 14.2,
        geometryRef: 'CAD/ROBOT/LINK1_SHOULDER.STEP',
        parentId: 'COMP-ROB-BASE',
        revision
      },
      {
        id: 'COMP-ROB-UPPER_ARM',
        type: 'LINK_2',
        partId: 'PART-ROB-LINK2-01',
        material: 'High-Strength Aluminum 7075-T6',
        mass: 18.8,
        geometryRef: 'CAD/ROBOT/LINK2_UPPER_ARM.STEP',
        parentId: 'COMP-ROB-SHOULDER',
        revision
      },
      {
        id: 'COMP-ROB-FOREARM',
        type: 'LINK_3',
        partId: 'PART-ROB-LINK3-01',
        material: 'Aluminum 7075-T6 / Carbon Composite Shell',
        mass: 11.4,
        geometryRef: 'CAD/ROBOT/LINK3_FOREARM.STEP',
        parentId: 'COMP-ROB-UPPER_ARM',
        revision
      },
      {
        id: 'COMP-ROB-WRIST_PITCH',
        type: 'LINK_4',
        partId: 'PART-ROB-LINK4-01',
        material: 'CNC Aluminum 6061-T6',
        mass: 5.6,
        geometryRef: 'CAD/ROBOT/LINK4_WRIST.STEP',
        parentId: 'COMP-ROB-FOREARM',
        revision
      },
      {
        id: 'COMP-ROB-WRIST_YAW',
        type: 'LINK_5',
        partId: 'PART-ROB-LINK5-01',
        material: 'CNC Aluminum 6061-T6',
        mass: 3.8,
        geometryRef: 'CAD/ROBOT/LINK5_WRIST.STEP',
        parentId: 'COMP-ROB-WRIST_PITCH',
        revision
      },
      {
        id: 'COMP-ROB-WRIST_FLANGE',
        type: 'LINK_6',
        partId: 'PART-ROB-LINK6-01',
        material: 'Stainless Steel 316L / Tool Steel',
        mass: 2.1,
        geometryRef: 'CAD/ROBOT/LINK6_FLANGE.STEP',
        parentId: 'COMP-ROB-WRIST_YAW',
        revision
      },
      {
        id: 'COMP-ROB-CONTROL_CABINET',
        type: 'HOUSING',
        partId: 'PART-ROB-CABINET-01',
        material: 'Powder-Coated Sheet Steel / IP54 Gaskets',
        mass: 28.0,
        geometryRef: 'CAD/ROBOT/CONTROL_CABINET.STEP',
        parentId: 'COMP-ROB-BASE',
        revision
      }
    ];

    // 2. JOINTS (Kinematic Tree J1 to J6)
    const joints: RobotJoint[] = [
      {
        id: 'JOINT-J1',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-BASE',
        childComponent: 'COMP-ROB-SHOULDER',
        axis: { x: 0, y: 0, z: 1 },
        limits: { min: -170, max: 170, unit: 'deg' },
        position: { x: 0, y: 0, z: 0.28 },
        velocityLimit: 3.14, // rad/s (180 deg/s)
        accelerationLimit: 12.0, // rad/s²
        torqueLimit: 350.0 // N·m
      },
      {
        id: 'JOINT-J2',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-SHOULDER',
        childComponent: 'COMP-ROB-UPPER_ARM',
        axis: { x: 0, y: 1, z: 0 },
        limits: { min: -135, max: 85, unit: 'deg' },
        position: { x: 0, y: 0.12, z: 0.45 },
        velocityLimit: 2.8,
        accelerationLimit: 10.0,
        torqueLimit: 480.0
      },
      {
        id: 'JOINT-J3',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-UPPER_ARM',
        childComponent: 'COMP-ROB-FOREARM',
        axis: { x: 0, y: 1, z: 0 },
        limits: { min: -210, max: 65, unit: 'deg' },
        position: { x: 0, y: 0, z: 0.95 },
        velocityLimit: 3.5,
        accelerationLimit: 14.0,
        torqueLimit: 220.0
      },
      {
        id: 'JOINT-J4',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-FOREARM',
        childComponent: 'COMP-ROB-WRIST_PITCH',
        axis: { x: 1, y: 0, z: 0 },
        limits: { min: -200, max: 200, unit: 'deg' },
        position: { x: 0.52, y: 0, z: 0.95 },
        velocityLimit: 5.2,
        accelerationLimit: 25.0,
        torqueLimit: 95.0
      },
      {
        id: 'JOINT-J5',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-WRIST_PITCH',
        childComponent: 'COMP-ROB-WRIST_YAW',
        axis: { x: 0, y: 1, z: 0 },
        limits: { min: -125, max: 125, unit: 'deg' },
        position: { x: 0.88, y: 0, z: 0.95 },
        velocityLimit: 5.5,
        accelerationLimit: 28.0,
        torqueLimit: 70.0
      },
      {
        id: 'JOINT-J6',
        type: 'REVOLUTE',
        parentComponent: 'COMP-ROB-WRIST_YAW',
        childComponent: 'COMP-ROB-WRIST_FLANGE',
        axis: { x: 1, y: 0, z: 0 },
        limits: { min: -360, max: 360, unit: 'deg' },
        position: { x: 1.1, y: 0, z: 0.95 },
        velocityLimit: 7.2,
        accelerationLimit: 35.0,
        torqueLimit: 45.0
      }
    ];

    // 3. ACTUATORS (1-to-1 matching to Joints)
    const actuators: RobotActuator[] = [
      {
        id: 'ACTUATOR-J1',
        jointId: 'JOINT-J1',
        type: 'BRUSHLESS_AC_SERVO_J1',
        torqueLimit: 350.0,
        speedLimit: 3000, // RPM
        powerLimit: 1200, // Watts
        transmissionRatio: 121.0 // Harmonic/Planetary drive ratio
      },
      {
        id: 'ACTUATOR-J2',
        jointId: 'JOINT-J2',
        type: 'BRUSHLESS_AC_SERVO_J2',
        torqueLimit: 480.0,
        speedLimit: 3000,
        powerLimit: 1800,
        transmissionRatio: 160.0
      },
      {
        id: 'ACTUATOR-J3',
        jointId: 'JOINT-J3',
        type: 'BRUSHLESS_AC_SERVO_J3',
        torqueLimit: 220.0,
        speedLimit: 3600,
        powerLimit: 850,
        transmissionRatio: 100.0
      },
      {
        id: 'ACTUATOR-J4',
        jointId: 'JOINT-J4',
        type: 'BRUSHLESS_AC_SERVO_J4',
        torqueLimit: 95.0,
        speedLimit: 4500,
        powerLimit: 450,
        transmissionRatio: 80.0
      },
      {
        id: 'ACTUATOR-J5',
        jointId: 'JOINT-J5',
        type: 'BRUSHLESS_AC_SERVO_J5',
        torqueLimit: 70.0,
        speedLimit: 4500,
        powerLimit: 350,
        transmissionRatio: 80.0
      },
      {
        id: 'ACTUATOR-J6',
        jointId: 'JOINT-J6',
        type: 'BRUSHLESS_AC_SERVO_J6',
        torqueLimit: 45.0,
        speedLimit: 6000,
        powerLimit: 250,
        transmissionRatio: 50.0
      }
    ];

    // 4. SENSORS (Joint Encoders, Torque Sensors, Wrist F/T)
    const sensors: RobotSensor[] = [
      {
        id: 'SENSOR-ENC-J1',
        type: 'OPTICAL_ABSOLUTE_ENCODER_24BIT',
        target: 'JOINT-J1',
        measurement: 'POSITION',
        unit: 'rad',
        accuracy: 0.00001,
        provenance: 'CALIBRATED_FACTORY_ENCODER_J1'
      },
      {
        id: 'SENSOR-ENC-J2',
        type: 'OPTICAL_ABSOLUTE_ENCODER_24BIT',
        target: 'JOINT-J2',
        measurement: 'POSITION',
        unit: 'rad',
        accuracy: 0.00001,
        provenance: 'CALIBRATED_FACTORY_ENCODER_J2'
      },
      {
        id: 'SENSOR-ENC-J3',
        type: 'OPTICAL_ABSOLUTE_ENCODER_24BIT',
        target: 'JOINT-J3',
        measurement: 'POSITION',
        unit: 'rad',
        accuracy: 0.00001,
        provenance: 'CALIBRATED_FACTORY_ENCODER_J3'
      },
      {
        id: 'SENSOR-TORQUE-J2',
        type: 'STRAIN_GAUGE_JOINT_TORQUE_SENSOR',
        target: 'JOINT-J2',
        measurement: 'TORQUE',
        unit: 'N·m',
        accuracy: 0.1,
        provenance: 'CALIBRATED_TORQUE_CELL_J2'
      },
      {
        id: 'SENSOR-FT-WRIST',
        type: '6_AXIS_WRIST_FORCE_TORQUE_SENSOR',
        target: 'COMP-ROB-WRIST_FLANGE',
        measurement: 'FORCE',
        unit: 'N',
        accuracy: 0.05,
        provenance: 'NIST_TRACEABLE_FT_SENSOR_01'
      }
    ];

    // 5. CONTROL SYSTEM
    const controller: RobotControllerSystem = {
      id: 'CTRL-ROB-MASTER-01',
      name: 'SECP Real-Time Industrial Motion Controller',
      type: 'REALTIME_ETHERCAT_MASTER',
      motionController: 'SECP 1kHz Closed-Loop Trajectory Engine',
      jointControllers: joints.map(j => ({
        jointId: j.id,
        controlLoopHz: 2000,
        kp: 180.0,
        ki: 12.0,
        kd: 8.5
      })),
      controlParameters: {
        cycleTimeMs: 0.5,
        interpolationMode: 'CUBIC_HERMITE_SPLINE',
        busProtocol: 'EtherCAT_CoE_CiA402',
        safetyCategory: 'ISO_13849_1_PLd_Cat3'
      }
    };

    // 6. POWER SYSTEM
    const powerSystem: RobotPowerSubsystem = {
      id: 'PWR-ROB-SUB-01',
      name: '400V 3-Phase Industrial Power Distribution Unit',
      powerInput: {
        voltageV: 400.0,
        currentA: 16.0,
        frequencyHz: 50.0,
        phase: '3-PHASE_AC'
      },
      distribution: {
        busVoltageV: 560.0, // DC Bus voltage from 400V AC rectification
        auxVoltageV: 24.0 // 24V DC logic & safety bus
      },
      powerRequirementsWatts: {
        idleWatts: 85.0,
        nominalWatts: 1450.0,
        peakWatts: 4900.0
      }
    };

    // 7. END EFFECTOR & PAYLOAD
    const endEffector: RobotEndEffectorSubsystem = {
      id: 'EE-ROB-PNEUMATIC-GRIPPER-01',
      name: 'ISO 9409-1-50-4-M6 Heavy Industrial Servo Gripper',
      toolInterface: {
        spec: 'ISO 9409-1-50-4-M6 Flange',
        flangeDiameterMm: 50.0,
        boltCircleMm: 31.5,
        maxPayloadKg: payloadKg
      },
      payloadDefinition: {
        nominalPayloadKg: payloadKg,
        maxPayloadKg: payloadKg * 1.25,
        toolMassKg: 2.8,
        centerOfGravity: { x: 0.08, y: 0.0, z: 0.0 }
      }
    };

    // 8. REQUIREMENTS LINKAGE (Traceability to EPC-036)
    const requirements = [
      'ROBOT-REQ-001', // Max Payload (10 kg)
      'ROBOT-REQ-002', // Reach Radius (1100 mm)
      'ROBOT-REQ-003', // Repeatability (+/- 0.05 mm)
      'ROBOT-REQ-004', // Joint J1 Velocity (180 deg/s)
      'ROBOT-REQ-005', // E-Stop Response Time (< 20 ms)
      'ROBOT-REQ-006', // Shoulder Torque Reserve (> 1.25 SF)
      'ROBOT-REQ-007'  // IP65 Ingress Rating
    ];

    // 9. RELATIONS (Explicit & Traceable Graph)
    const relations: RobotArchitectureRelation[] = [
      {
        sourceId: 'ROBOT-REQ-001',
        targetId: id,
        relationType: 'REQUIREMENT_SATISFACTION',
        dependency: true,
        revision
      },
      {
        sourceId: 'COMP-ROB-BASE',
        targetId: 'COMP-ROB-SHOULDER',
        relationType: 'PARENT_CHILD',
        dependency: true,
        revision
      },
      {
        sourceId: 'ACTUATOR-J1',
        targetId: 'JOINT-J1',
        relationType: 'ACTUATES_JOINT',
        dependency: true,
        revision
      },
      {
        sourceId: 'ACTUATOR-J2',
        targetId: 'JOINT-J2',
        relationType: 'ACTUATES_JOINT',
        dependency: true,
        revision
      },
      {
        sourceId: 'SENSOR-ENC-J1',
        targetId: 'JOINT-J1',
        relationType: 'SENSES_TARGET',
        dependency: true,
        revision
      },
      {
        sourceId: 'SENSOR-FT-WRIST',
        targetId: 'COMP-ROB-WRIST_FLANGE',
        relationType: 'SENSES_TARGET',
        dependency: true,
        revision
      },
      {
        sourceId: 'PWR-ROB-SUB-01',
        targetId: 'CTRL-ROB-MASTER-01',
        relationType: 'POWER_FEED',
        dependency: true,
        revision
      },
      {
        sourceId: 'CTRL-ROB-MASTER-01',
        targetId: 'ACTUATOR-J1',
        relationType: 'CONTROL_BUS',
        dependency: true,
        revision
      }
    ];

    const evidenceRefs = [
      'EVID-ROB-ARCH-DES-01',
      'EVID-ROB-KINEMATIC-MODEL-01',
      'EVID-ROB-DYNAMIC-SIM-01',
      'EVID-ROB-ISO9283-REPEATABILITY-01'
    ];

    return {
      id,
      name,
      revision,
      configurationId,
      requirements,
      components,
      joints,
      actuators,
      sensors,
      controller,
      powerSystem,
      endEffector,
      assemblyId: `ASSY-${id}-MAIN`,
      bomId: `BOM-${id}-01`,
      evidenceRefs,
      relations
    };
  }

  /**
   * Bridges RobotSystem into SECP's standard domain-neutral ProductArchitecture schema
   * so that existing SECP core infrastructure (ProductArchitectureManager, DigitalThread, BOM) works directly!
   */
  public static toProductArchitecture(robot: RobotSystem): ProductArchitecture {
    const structuralMass = robot.components.reduce((sum, c) => sum + c.mass, 0);
    const actuatorMass = robot.actuators.length * 3.5;
    const sensorMass = robot.sensors.length * 0.25;
    const controllerMass = 4.5;
    const powerMass = 8.0;
    const toolMass = robot.endEffector.payloadDefinition.toolMassKg;

    const totalSystemMassKg = Number(
      (structuralMass + actuatorMass + sensorMass + controllerMass + powerMass + toolMass).toFixed(3)
    );

    const subsystems: SubsystemDefinition[] = [
      {
        subsystemId: 'SUB-MECHANICAL_STRUCTURE',
        name: 'Mechanical & Structural Links Subsystem',
        category: 'STRUCTURE',
        description: 'Base pedestal and 6 articulated structural link arms.',
        revision: robot.revision,
        components: robot.components.map(c => ({
          componentId: c.id,
          subsystemId: 'SUB-MECHANICAL_STRUCTURE',
          name: c.type,
          category: 'STRUCTURAL_MEMBER',
          description: `Robot structural link part ${c.partId}`,
          partNumber: c.partId,
          revision: c.revision,
          quantity: 1,
          physical: {
            massKg: c.mass,
            centerOfGravity: { x: 0, y: 0, z: 0.1 },
            dimensions: { lengthMm: 300, widthMm: 200, heightMm: 200 },
            materialName: c.material
          },
          isCritical: true,
          traceableRequirementIds: robot.requirements
        })),
        totalMassKg: robot.components.reduce((sum, c) => sum + c.mass, 0),
        centerOfGravity: { x: 0.1, y: 0.0, z: 0.45 },
        totalPowerDrawWatts: 0,
        traceableRequirementIds: robot.requirements,
        isCritical: true
      },
      {
        subsystemId: 'SUB-ACTUATION_DRIVES',
        name: 'Joint Actuation & Servomotor Subsystem',
        category: 'ACTUATION',
        description: '6x AC Brushless Servomotors with high-precision harmonic gearing.',
        revision: robot.revision,
        components: robot.actuators.map(a => ({
          componentId: a.id,
          subsystemId: 'SUB-ACTUATION_DRIVES',
          name: `Actuator for ${a.jointId}`,
          category: 'ACTUATOR',
          description: `AC Servo Motor (${a.type}) with ${a.transmissionRatio}:1 gear ratio`,
          partNumber: `PART-${a.id}`,
          revision: robot.revision,
          quantity: 1,
          physical: {
            massKg: 3.5,
            centerOfGravity: { x: 0, y: 0, z: 0 },
            dimensions: { lengthMm: 120, widthMm: 120, heightMm: 180 }
          },
          electrical: {
            nominalVoltageV: 400,
            powerDrawWatts: a.powerLimit
          },
          performance: {
            maxTorqueNm: a.torqueLimit
          },
          isCritical: true,
          traceableRequirementIds: robot.requirements
        })),
        totalMassKg: robot.actuators.length * 3.5,
        centerOfGravity: { x: 0.1, y: 0.0, z: 0.45 },
        totalPowerDrawWatts: robot.actuators.reduce((sum, a) => sum + a.powerLimit, 0),
        traceableRequirementIds: robot.requirements,
        isCritical: true
      },
      {
        subsystemId: 'SUB-SENSING_FEEDBACK',
        name: 'Sensing & Feedback Subsystem',
        category: 'SENSING',
        description: 'Optical absolute encoders, joint torque cells, and wrist F/T transducer.',
        revision: robot.revision,
        components: robot.sensors.map(s => ({
          componentId: s.id,
          subsystemId: 'SUB-SENSING_FEEDBACK',
          name: s.type,
          category: 'ELECTRONIC_MODULE',
          description: `Sensor measuring ${s.measurement} on ${s.target}`,
          partNumber: `PART-${s.id}`,
          revision: robot.revision,
          quantity: 1,
          physical: {
            massKg: 0.25,
            centerOfGravity: { x: 0, y: 0, z: 0 },
            dimensions: { lengthMm: 40, widthMm: 40, heightMm: 20 }
          },
          isCritical: true,
          traceableRequirementIds: robot.requirements
        })),
        totalMassKg: robot.sensors.length * 0.25,
        centerOfGravity: { x: 0, y: 0, z: 0 },
        totalPowerDrawWatts: robot.sensors.length * 2.0,
        traceableRequirementIds: robot.requirements,
        isCritical: true
      },
      {
        subsystemId: 'SUB-CONTROL_ELECTRONICS',
        name: 'Control System & EtherCAT Master',
        category: 'CONTROL_SYSTEM',
        description: robot.controller.name,
        revision: robot.revision,
        components: [
          {
            componentId: robot.controller.id,
            subsystemId: 'SUB-CONTROL_ELECTRONICS',
            name: robot.controller.name,
            category: 'ELECTRONIC_MODULE',
            description: robot.controller.motionController,
            partNumber: 'PART-CTRL-01',
            revision: robot.revision,
            quantity: 1,
            physical: {
              massKg: 4.5,
              centerOfGravity: { x: 0, y: 0, z: 0 },
              dimensions: { lengthMm: 250, widthMm: 180, heightMm: 80 }
            },
            isCritical: true,
            traceableRequirementIds: robot.requirements
          }
        ],
        totalMassKg: 4.5,
        centerOfGravity: { x: 0, y: 0, z: 0 },
        totalPowerDrawWatts: 85.0,
        traceableRequirementIds: robot.requirements,
        isCritical: true
      },
      {
        subsystemId: 'SUB-POWER_DISTRIBUTION',
        name: 'Power System Subsystem',
        category: 'POWER_DISTRIBUTION',
        description: robot.powerSystem.name,
        revision: robot.revision,
        components: [
          {
            componentId: robot.powerSystem.id,
            subsystemId: 'SUB-POWER_DISTRIBUTION',
            name: robot.powerSystem.name,
            category: 'POWER_DISTRIBUTION_BOARD',
            description: '400V 3-phase power supply unit',
            partNumber: 'PART-PWR-01',
            revision: robot.revision,
            quantity: 1,
            physical: {
              massKg: 8.0,
              centerOfGravity: { x: 0, y: 0, z: 0 },
              dimensions: { lengthMm: 300, widthMm: 220, heightMm: 120 }
            },
            isCritical: true,
            traceableRequirementIds: robot.requirements
          }
        ],
        totalMassKg: 8.0,
        centerOfGravity: { x: 0, y: 0, z: 0 },
        totalPowerDrawWatts: robot.powerSystem.powerRequirementsWatts.nominalWatts,
        traceableRequirementIds: robot.requirements,
        isCritical: true
      },
      {
        subsystemId: 'SUB-END_EFFECTOR',
        name: 'End Effector & Tooling Subsystem',
        category: 'PAYLOAD',
        description: robot.endEffector.name,
        revision: robot.revision,
        components: [
          {
            componentId: robot.endEffector.id,
            subsystemId: 'SUB-END_EFFECTOR',
            name: robot.endEffector.name,
            category: 'HOUSING',
            description: robot.endEffector.toolInterface.spec,
            partNumber: 'PART-EE-01',
            revision: robot.revision,
            quantity: 1,
            physical: {
              massKg: robot.endEffector.payloadDefinition.toolMassKg,
              centerOfGravity: robot.endEffector.payloadDefinition.centerOfGravity,
              dimensions: { lengthMm: 150, widthMm: 100, heightMm: 100 }
            },
            isCritical: true,
            traceableRequirementIds: robot.requirements
          }
        ],
        totalMassKg: robot.endEffector.payloadDefinition.toolMassKg,
        centerOfGravity: robot.endEffector.payloadDefinition.centerOfGravity,
        totalPowerDrawWatts: 45.0,
        traceableRequirementIds: robot.requirements,
        isCritical: true
      }
    ];

    const interfaces: SystemInterface[] = robot.joints.map(j => ({
      interfaceId: `INT-${j.id}`,
      name: `Joint Interface ${j.id} (${j.parentComponent} -> ${j.childComponent})`,
      sourceSubsystemId: 'SUB-MECHANICAL_STRUCTURE',
      sourceComponentId: j.parentComponent,
      targetSubsystemId: 'SUB-MECHANICAL_STRUCTURE',
      targetComponentId: j.childComponent,
      interfaceType: 'MECHANICAL',
      mechanical: {
        mountType: 'BEARING_JOURNAL_FLANGE',
        maxLoadCapacityN: j.torqueLimit * 10,
        torqueLimitNm: j.torqueLimit
      },
      constraints: [`Velocity limit: ${j.velocityLimit} rad/s`],
      linkedRequirementIds: robot.requirements,
      status: 'VERIFIED'
    }));

    const now = new Date().toISOString();

    return {
      architectureId: `ARCH-${robot.id}-REV${robot.revision.replace('.', '_')}`,
      productId: robot.id,
      productName: robot.name,
      productType: 'INDUSTRIAL_ROBOTIC_ARM',
      revision: robot.revision,
      variantCode: 'STANDARD_6DOF',
      variantName: '6-Axis Articulated Industrial Robotic Arm',
      description: `6-DOF Industrial Robotic Arm with ${robot.endEffector.payloadDefinition.nominalPayloadKg}kg payload capability.`,
      subsystems,
      interfaces,
      systemParameters: {
        massBreakdown: {
          totalMassKg: totalSystemMassKg,
          structuralMassKg: robot.components.reduce((sum, c) => sum + c.mass, 0),
          propulsionMassKg: 0,
          batteryMassKg: 0,
          payloadMassKg: robot.endEffector.payloadDefinition.nominalPayloadKg,
          avionicsMassKg: 0,
          landingGearMassKg: 0,
          harnessAndFastenersMassKg: 2.5,
          massMarginKg: 10.0,
          massMarginPercentage: 10.0
        },
        centerOfGravity: { x: 0.1, y: 0.0, z: 0.45 },
        inertiaTensor: { Ixx: 12.5, Iyy: 14.2, Izz: 8.6, Ixy: 0, Ixz: 0, Iyz: 0 },
        powerBudget: {
          totalEnergyCapacityWh: 0,
          usableEnergyWh: 0,
          batteryNominalVoltageV: 400,
          batteryCapacityAh: 0,
          maxContinuousPowerWatts: robot.powerSystem.powerRequirementsWatts.nominalWatts,
          peakPowerWatts: robot.powerSystem.powerRequirementsWatts.peakWatts,
          hoverPowerWatts: 0,
          cruisePowerWatts: 0,
          avionicsAndPayloadPowerWatts: 150
        },
        flightMetrics: {
          motorCount: 0,
          maxThrustPerMotorNewtons: 0,
          totalMaxThrustNewtons: 0,
          hoverThrustRequiredNewtons: 0,
          thrustToWeightRatio: 0,
          hoverThrottlePercentage: 0,
          estimatedHoverEnduranceMinutes: 0,
          estimatedCruiseEnduranceMinutes: 0,
          maximumClimbRateMs: 0,
          maximumForwardSpeedMs: 2.0
        },
        operatingEnvelope: {
          maxTakeoffMassKg: totalSystemMassKg + robot.endEffector.payloadDefinition.maxPayloadKg,
          maxPayloadCapacityKg: robot.endEffector.payloadDefinition.maxPayloadKg,
          serviceCeilingAltitudeMeters: 2000,
          maxWindResistanceMs: 0,
          operatingTempRangeC: { min: 0, max: 50 },
          ingressProtectionRating: 'IP65'
        }
      },
      requirementLinks: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        author: 'SECP Robotics Engineering Core',
        configurationId: robot.configurationId,
        domain: 'INDUSTRIAL_ROBOTICS',
        proofCaseId: this.CASE_ID
      }
    };
  }

  /**
   * Updates a component in the robot system, creates a new revision, and computes cryptographic hash.
   */
  public static updateRobotComponent(
    system: RobotSystem,
    componentId: string,
    updates: Partial<RobotComponent>
  ): { system: RobotSystem; revision: string; provenanceHash: string } {
    let found = false;
    const newComponents = system.components.map(c => {
      if (c.id === componentId) {
        found = true;
        return { ...c, ...updates };
      }
      return c;
    });

    if (!found) {
      throw new Error(`Component ${componentId} not found in robot system ${system.id}`);
    }

    const prevRev = parseFloat(system.revision) || 1.0;
    const newRevision = (prevRev + 0.1).toFixed(1);

    const updatedSystem: RobotSystem = {
      ...system,
      revision: newRevision,
      components: newComponents
    };

    const provenanceHash = EvidenceIntegrityService.computeHash({
      id: updatedSystem.id,
      revision: newRevision,
      componentsCount: updatedSystem.components.length,
      jointsCount: updatedSystem.joints.length,
      timestamp: new Date().toISOString()
    });

    return {
      system: updatedSystem,
      revision: newRevision,
      provenanceHash
    };
  }
}
