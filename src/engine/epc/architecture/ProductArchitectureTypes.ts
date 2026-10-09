/**
 * SECP Industrial OS — EPC-018: Product Architecture Types
 * Domain-Agnostic Product Architecture, Subsystems, Components, Interfaces,
 * Physical Parameters, and Traceability Schema.
 */

import { EngineeringRequirementCategory } from '../EngineeringRequirementTypes';

export type SubsystemCategory =
  | 'AIRFRAME'
  | 'PROPULSION'
  | 'BATTERY'
  | 'PAYLOAD'
  | 'LANDING_GEAR'
  | 'AVIONICS'
  | 'STRUCTURE'
  | 'HYDRAULIC'
  | 'PNEUMATIC'
  | 'THERMAL_MANAGEMENT'
  | 'ACTUATION'
  | 'SENSING'
  | 'CONTROL_SYSTEM'
  | 'COMMUNICATION'
  | 'POWER_DISTRIBUTION'
  | 'MECHANICAL_TRANSMISSION'
  | 'CUSTOM';

export type ComponentCategory =
  | 'FUSELAGE'
  | 'ARM'
  | 'MOTOR_MOUNT'
  | 'LANDING_GEAR_MOUNT'
  | 'PAYLOAD_MOUNT'
  | 'BATTERY_MOUNT'
  | 'MOTOR'
  | 'PROPELLER'
  | 'ESC'
  | 'BATTERY_PACK'
  | 'BMS'
  | 'PAYLOAD_SENSOR'
  | 'GIMBAL'
  | 'LANDING_SKID'
  | 'LANDING_STRUT'
  | 'FLIGHT_CONTROLLER'
  | 'IMU_SENSOR'
  | 'GNSS_RECEIVER'
  | 'TRANSCEIVER'
  | 'POWER_DISTRIBUTION_BOARD'
  | 'WIRING_HARNESS'
  | 'FASTENER_SET'
  | 'STRUCTURAL_MEMBER'
  | 'ACTUATOR'
  | 'PUMP'
  | 'VALVE'
  | 'ELECTRONIC_MODULE'
  | 'HOUSING'
  | 'CUSTOM';

export type InterfaceType =
  | 'MECHANICAL'
  | 'ELECTRICAL_POWER'
  | 'ELECTRICAL_SIGNAL'
  | 'DATA_COMMUNICATION'
  | 'THERMAL'
  | 'STRUCTURAL_LOAD'
  | 'HYDRAULIC_FLUID'
  | 'PNEUMATIC'
  | 'OPTICAL'
  | 'MULTI_DOMAIN';

export interface Point3D {
  readonly x: number; // meters
  readonly y: number; // meters
  readonly z: number; // meters
}

export interface Dimensions3D {
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface InertiaTensor {
  readonly Ixx: number; // kg·m²
  readonly Iyy: number; // kg·m²
  readonly Izz: number; // kg·m²
  readonly Ixy: number; // kg·m²
  readonly Ixz: number; // kg·m²
  readonly Iyz: number; // kg·m²
}

export interface ComponentPhysicalProperties {
  readonly massKg: number;
  readonly centerOfGravity: Point3D;
  readonly dimensions: Dimensions3D;
  readonly momentsOfInertia?: InertiaTensor;
  readonly materialId?: string;
  readonly materialName?: string;
  readonly densityKgM3?: number;
}

export interface ComponentElectricalProperties {
  readonly nominalVoltageV?: number;
  readonly maxVoltageV?: number;
  readonly minVoltageV?: number;
  readonly continuousCurrentA?: number;
  readonly peakCurrentA?: number;
  readonly powerDrawWatts?: number;
  readonly energyCapacityWh?: number;
  readonly capacityAh?: number;
  readonly cellCount?: number;
  readonly cellChemistry?: string;
}

export interface ComponentPerformanceProperties {
  readonly maxThrustNewtons?: number;
  readonly maxTorqueNm?: number;
  readonly kvRpmPerVolt?: number;
  readonly maxPowerWatts?: number;
  readonly efficiencyGramsPerWatt?: number;
  readonly bandwidthHz?: number;
  readonly samplingRateHz?: number;
  readonly staticLoadRatingN?: number;
  readonly maxDropImpactVelocityMs?: number;
}

export interface ComponentEnvironmentalProperties {
  readonly ipRating?: string;
  readonly minOperatingTempC?: number;
  readonly maxOperatingTempC?: number;
  readonly vibrationToleranceG?: number;
}

export interface ArchitectureComponent {
  readonly componentId: string;
  readonly subsystemId: string;
  readonly name: string;
  readonly category: ComponentCategory;
  readonly description: string;
  readonly partNumber: string;
  readonly revision: string;
  readonly quantity: number;
  readonly physical: ComponentPhysicalProperties;
  readonly electrical?: ComponentElectricalProperties;
  readonly performance?: ComponentPerformanceProperties;
  readonly environmental?: ComponentEnvironmentalProperties;
  readonly traceableRequirementIds: readonly string[];
  readonly cadModelReference?: string;
  readonly feaModelReference?: string;
  readonly isCritical: boolean;
  readonly notes?: string;
}

export interface MechanicalInterfaceSpec {
  readonly mountType: string; // e.g. 'BOLTED_FLANGE', 'QUICK_RELEASE_RAIL', 'CLAMP', 'DAMPED_GROMMET'
  readonly fastenerSpecification?: string; // e.g. '4x M3x8 Grade 12.9 Titanium'
  readonly maxLoadCapacityN?: number;
  readonly shearCapacityN?: number;
  readonly torqueLimitNm?: number;
  readonly vibrationIsolation?: boolean;
  readonly isolationDampingRatio?: number;
  readonly contactSurfaceAreaMm2?: number;
}

export interface ElectricalInterfaceSpec {
  readonly nominalVoltageV?: number;
  readonly maxContinuousCurrentA?: number;
  readonly peakCurrentA?: number;
  readonly connectorType?: string; // e.g. 'XT90-S Anti-Spark', 'JST-GH 6-Pin', 'Molex Micro-Fit'
  readonly wireGaugeAwg?: number;
  readonly isRedundant?: boolean;
}

export interface DataInterfaceSpec {
  readonly protocol: string; // e.g. 'MAVLink_v2', 'CAN_Bus_2.0B', 'UART_8N1', 'SPI', 'I2C', 'Ethernet_100BaseT'
  readonly baudRateOrBandwidthBps?: number;
  readonly updateRateHz?: number;
  readonly maxLatencyMs?: number;
  readonly messageTypes?: readonly string[];
}

export interface ThermalInterfaceSpec {
  readonly heatDissipationWatts?: number;
  readonly maxInterfaceTempC?: number;
  readonly coolingType?: 'NATURAL_CONVECTION' | 'FORCED_AIR' | 'HEAT_SINK' | 'LIQUID' | 'DIRECT_CONDUCTION';
  readonly thermalResistanceCW?: number;
}

export interface SystemInterface {
  readonly interfaceId: string;
  readonly name: string;
  readonly sourceSubsystemId: string;
  readonly sourceComponentId: string;
  readonly targetSubsystemId: string;
  readonly targetComponentId: string;
  readonly interfaceType: InterfaceType;
  readonly mechanical?: MechanicalInterfaceSpec;
  readonly electrical?: ElectricalInterfaceSpec;
  readonly data?: DataInterfaceSpec;
  readonly thermal?: ThermalInterfaceSpec;
  readonly constraints: readonly string[];
  readonly linkedRequirementIds: readonly string[];
  readonly evidenceReference?: string;
  readonly status: 'SPECIFIED' | 'VERIFIED' | 'VALIDATED';
}

export interface SubsystemDefinition {
  readonly subsystemId: string;
  readonly name: string;
  readonly category: SubsystemCategory;
  readonly description: string;
  readonly revision: string;
  readonly components: readonly ArchitectureComponent[];
  readonly totalMassKg: number;
  readonly centerOfGravity: Point3D;
  readonly totalPowerDrawWatts: number;
  readonly traceableRequirementIds: readonly string[];
  readonly isCritical: boolean;
}

export interface MassBreakdown {
  readonly totalMassKg: number;
  readonly structuralMassKg: number;
  readonly propulsionMassKg: number;
  readonly batteryMassKg: number;
  readonly payloadMassKg: number;
  readonly avionicsMassKg: number;
  readonly landingGearMassKg: number;
  readonly harnessAndFastenersMassKg: number;
  readonly massMarginKg: number;
  readonly massMarginPercentage: number;
}

export interface PowerAndEnergyBudget {
  readonly totalEnergyCapacityWh: number;
  readonly usableEnergyWh: number;
  readonly batteryNominalVoltageV: number;
  readonly batteryCapacityAh: number;
  readonly maxContinuousPowerWatts: number;
  readonly peakPowerWatts: number;
  readonly hoverPowerWatts: number;
  readonly cruisePowerWatts: number;
  readonly avionicsAndPayloadPowerWatts: number;
}

export interface PropulsionFlightMetrics {
  readonly motorCount: number;
  readonly maxThrustPerMotorNewtons: number;
  readonly totalMaxThrustNewtons: number;
  readonly hoverThrustRequiredNewtons: number;
  readonly thrustToWeightRatio: number;
  readonly hoverThrottlePercentage: number;
  readonly estimatedHoverEnduranceMinutes: number;
  readonly estimatedCruiseEnduranceMinutes: number;
  readonly maximumClimbRateMs: number;
  readonly maximumForwardSpeedMs: number;
}

export interface OperatingEnvelope {
  readonly maxTakeoffMassKg: number;
  readonly maxPayloadCapacityKg: number;
  readonly serviceCeilingAltitudeMeters: number;
  readonly maxWindResistanceMs: number;
  readonly operatingTempRangeC: { min: number; max: number };
  readonly ingressProtectionRating: string;
}

export interface SystemLevelParameters {
  readonly massBreakdown: MassBreakdown;
  readonly centerOfGravity: Point3D;
  readonly inertiaTensor: InertiaTensor;
  readonly powerBudget: PowerAndEnergyBudget;
  readonly flightMetrics: PropulsionFlightMetrics;
  readonly operatingEnvelope: OperatingEnvelope;
}

export interface ArchitectureRequirementLink {
  readonly requirementId: string;
  readonly subsystemId: string;
  readonly componentIds: readonly string[];
  readonly interfaceIds?: readonly string[];
  readonly satisfactionRationale: string;
  readonly verificationMethod: string;
  readonly status: 'LINKED' | 'VERIFIED' | 'VALIDATED';
}

export interface DigitalThreadNode {
  readonly nodeId: string;
  readonly nodeType: 'PRODUCT' | 'REVISION' | 'VARIANT' | 'SUBSYSTEM' | 'COMPONENT' | 'INTERFACE' | 'REQUIREMENT' | 'ANALYSIS' | 'TEST' | 'EVIDENCE';
  readonly name: string;
  readonly referenceId: string;
  readonly status: string;
  readonly parentNodeIds: readonly string[];
  readonly childNodeIds: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ArchitectureDigitalThreadGraph {
  readonly architectureId: string;
  readonly rootProductId: string;
  readonly nodes: readonly DigitalThreadNode[];
  readonly totalNodeCount: number;
  readonly traceabilityCoveragePercentage: number;
}

export interface ProductArchitecture {
  readonly architectureId: string;
  readonly productId: string;
  readonly productName: string;
  readonly productType: string;
  readonly revision: string;
  readonly variantCode: string;
  readonly variantName: string;
  readonly description: string;
  readonly subsystems: readonly SubsystemDefinition[];
  readonly interfaces: readonly SystemInterface[];
  readonly systemParameters: SystemLevelParameters;
  readonly requirementLinks: readonly ArchitectureRequirementLink[];
  readonly digitalThreadGraph?: ArchitectureDigitalThreadGraph;
  readonly metadata: {
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly author: string;
    readonly configurationId: string;
    readonly baselineId?: string;
    readonly domain: string;
    readonly proofCaseId?: string;
  };
  readonly provenanceHash?: string;
}

export class ProductArchitectureValidationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'ARCH_VALIDATION_ERROR', details?: unknown) {
    super(message);
    this.name = 'ProductArchitectureValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ProductArchitectureValidationError.prototype);
  }
}

export interface EPC018ValidationResult {
  readonly epc: 'EPC-018';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly implementationRevision: string;
  readonly architectureId: string;
  readonly productId: string;
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly summary: {
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
    readonly subsystemCount: number;
    readonly componentCount: number;
    readonly interfaceCount: number;
    readonly requirementLinksCount: number;
    readonly totalMassKg: number;
    readonly thrustToWeightRatio: number;
    readonly hoverEnduranceMinutes: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
