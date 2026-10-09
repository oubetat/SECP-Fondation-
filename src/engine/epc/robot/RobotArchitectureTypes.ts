/**
 * SECP Industrial OS — EPC-037: Robot Architecture Types
 * Data models and interfaces for Industrial Robotic Arm System Architecture,
 * Joints, Actuators, Sensors, Controllers, Power, End Effector, and SECP Traceability.
 */

export interface RobotComponent {
  readonly id: string;
  readonly type: string;
  readonly partId: string;
  readonly material: string;
  readonly mass: number; // kg
  readonly geometryRef?: string;
  readonly parentId?: string;
  readonly revision: string;
}

export interface RobotJointLimits {
  readonly min: number;
  readonly max: number;
  readonly unit: 'rad' | 'deg' | 'm';
}

export interface RobotJoint {
  readonly id: string;
  readonly type: 'REVOLUTE' | 'PRISMATIC' | 'SPHERICAL' | 'FIXED';
  readonly parentComponent: string;
  readonly childComponent: string;
  readonly axis: { readonly x: number; readonly y: number; readonly z: number };
  readonly limits: RobotJointLimits;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly velocityLimit: number; // rad/s or m/s
  readonly accelerationLimit: number; // rad/s² or m/s²
  readonly torqueLimit: number; // N·m or N
}

export interface RobotActuator {
  readonly id: string;
  readonly jointId: string;
  readonly type: string;
  readonly torqueLimit: number; // N·m
  readonly speedLimit: number; // RPM or rad/s
  readonly powerLimit: number; // Watts
  readonly transmissionRatio: number; // e.g. 100:1 -> 100
}

export interface RobotSensor {
  readonly id: string;
  readonly type: string;
  readonly target: string; // Component, Joint, or Interface ID
  readonly measurement: 'POSITION' | 'VELOCITY' | 'TORQUE' | 'FORCE' | 'TEMPERATURE' | 'ACCELERATION';
  readonly unit: string;
  readonly accuracy: number;
  readonly provenance: string;
}

export interface RobotArchitectureRelation {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationType:
    | 'REQUIREMENT_SATISFACTION'
    | 'PARENT_CHILD'
    | 'ACTUATES_JOINT'
    | 'SENSES_TARGET'
    | 'MECHANICAL_INTERFACE'
    | 'POWER_FEED'
    | 'CONTROL_BUS';
  readonly dependency: boolean;
  readonly revision: string;
}

export interface JointControlLoop {
  readonly jointId: string;
  readonly controlLoopHz: number;
  readonly kp: number;
  readonly ki: number;
  readonly kd: number;
}

export interface RobotControllerSystem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly motionController: string;
  readonly jointControllers: readonly JointControlLoop[];
  readonly controlParameters: {
    readonly cycleTimeMs: number;
    readonly interpolationMode: string;
    readonly busProtocol: string;
    readonly safetyCategory: string;
  };
}

export interface RobotPowerSubsystem {
  readonly id: string;
  readonly name: string;
  readonly powerInput: {
    readonly voltageV: number;
    readonly currentA: number;
    readonly frequencyHz: number;
    readonly phase: string;
  };
  readonly distribution: {
    readonly busVoltageV: number;
    readonly auxVoltageV: number;
  };
  readonly powerRequirementsWatts: {
    readonly idleWatts: number;
    readonly nominalWatts: number;
    readonly peakWatts: number;
  };
}

export interface RobotEndEffectorSubsystem {
  readonly id: string;
  readonly name: string;
  readonly toolInterface: {
    readonly spec: string;
    readonly flangeDiameterMm: number;
    readonly boltCircleMm: number;
    readonly maxPayloadKg: number;
  };
  readonly payloadDefinition: {
    readonly nominalPayloadKg: number;
    readonly maxPayloadKg: number;
    readonly toolMassKg: number;
    readonly centerOfGravity: { readonly x: number; readonly y: number; readonly z: number };
  };
}

export interface RobotSystem {
  readonly id: string;
  readonly name: string;
  readonly revision: string;
  readonly configurationId: string;
  readonly requirements: readonly string[];
  readonly components: readonly RobotComponent[];
  readonly joints: readonly RobotJoint[];
  readonly actuators: readonly RobotActuator[];
  readonly sensors: readonly RobotSensor[];
  readonly controller: RobotControllerSystem;
  readonly powerSystem: RobotPowerSubsystem;
  readonly endEffector: RobotEndEffectorSubsystem;
  readonly assemblyId: string;
  readonly bomId: string;
  readonly evidenceRefs: readonly string[];
  readonly relations: readonly RobotArchitectureRelation[];
}

export interface EPC037ValidationResult {
  readonly epc: 'EPC-037';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly implementationRevision: string;
  readonly systemId: string;
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly summary: {
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
    readonly componentCount: number;
    readonly jointCount: number;
    readonly actuatorCount: number;
    readonly sensorCount: number;
    readonly totalMassKg: number;
    readonly maxPayloadKg: number;
    readonly reachMm: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
