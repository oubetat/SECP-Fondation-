/**
 * SECP Industrial OS — EPC-016: Mission & Product Definition Types
 * Canonical Domain-Agnostic Types for Mission, Environment, Payload,
 * Endurance, Constraints, Assumptions, and Product Definition.
 */

import {
  EngineeringRequirement,
  RequirementPriority,
  RequirementVerificationMethod,
  RequirementValidationMethod,
  RequirementTolerance
} from '../EngineeringRequirementTypes';
import { ProofCaseProject, ProofCaseStatus } from '../ProofCaseTypes';
import { EvidenceProvenance } from '../evidence/EvidenceProvenanceTypes';
import { EvidencePackageLifecycle } from '../evidence/EngineeringEvidencePackageTypes';

export type RequirementCategory =
  | 'MISSION'
  | 'PERFORMANCE'
  | 'ENVIRONMENT'
  | 'PAYLOAD'
  | 'ENERGY'
  | 'OPERATIONAL'
  | 'SAFETY'
  | 'MANUFACTURING';

export type RequirementStatus =
  | 'DRAFT'
  | 'DEFINED'
  | 'APPROVED'
  | 'VERIFIED'
  | 'VALIDATED'
  | 'REJECTED';

export type RequirementSource =
  | 'MISSION_DEFINITION'
  | 'CUSTOMER_REQUIREMENT'
  | 'ENGINEERING_ASSUMPTION'
  | 'REGULATORY_REFERENCE'
  | 'DESIGN_TARGET';

export type EnvironmentMode = 'INDOOR' | 'OUTDOOR' | 'HYBRID';

export interface QuantityWithUnit<T = number> {
  readonly value: T;
  readonly unit: string;
}

export interface RangeWithUnit<T = number> {
  readonly min: T;
  readonly max: T;
  readonly unit: string;
}

export interface Vector3DWithUnit {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly unit: string;
}

export interface Dimensions3DWithUnit {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly unit: string;
}

/**
 * Operating Environment Specification
 */
export interface OperatingEnvironmentDefinition {
  readonly environmentProfileId: string;
  readonly profileName: string;
  readonly mode: EnvironmentMode;
  readonly temperatureRange: RangeWithUnit; // °C
  readonly pressureRange: RangeWithUnit; // Pa
  readonly humidityRange: RangeWithUnit; // %
  readonly windSpeedRange: RangeWithUnit; // m/s
  readonly maximumGust: QuantityWithUnit; // m/s
  readonly operatingAltitudeRange: RangeWithUnit; // m
  readonly dustExposure: string; // e.g. IP54, IEC 60529
  readonly rainExposure: string; // e.g. Light rain, 5 mm/hr
  readonly visibilityConditions: QuantityWithUnit | string; // m or rating
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Payload Specification
 */
export interface PayloadDefinition {
  readonly payloadId: string;
  readonly payloadName: string;
  readonly payloadType: 'INSPECTION_CAMERA' | 'THERMAL_CAMERA' | 'LIDAR' | 'MULTISPECTRAL_SENSOR' | 'CUSTOM_SENSOR' | string;
  readonly payloadMass: QuantityWithUnit; // kg
  readonly payloadDimensions: Dimensions3DWithUnit; // m
  readonly payloadPower: QuantityWithUnit; // W
  readonly payloadCG: Vector3DWithUnit; // m
  readonly payloadMountLocation: string; // e.g. 'Gimbal Bottom Mount'
  readonly payloadOperationalMode: string; // e.g. 'CONTINUOUS_RECORDING'
  readonly payloadDutyCycle: QuantityWithUnit; // %
  readonly payloadRequirements: readonly EngineeringRequirement[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Endurance Specification & Power Budget
 */
export interface EnduranceDefinition {
  readonly targetEndurance: QuantityWithUnit; // s or min
  readonly minimumEndurance: QuantityWithUnit; // s or min
  readonly missionDuration: QuantityWithUnit; // s or min
  readonly reserveEnergy: QuantityWithUnit; // Wh or %
  readonly batteryCapacity: QuantityWithUnit; // Wh
  readonly energyConsumptionBudget: QuantityWithUnit; // Wh
  readonly cruisePowerBudget: QuantityWithUnit; // W
  readonly hoverPowerBudget: QuantityWithUnit; // W
  readonly payloadPowerBudget: QuantityWithUnit; // W
  readonly reservePolicy: string; // e.g. '20% reserve at landing'
  readonly metadata?: Record<string, unknown>;
}

/**
 * Mission Assumptions (Strictly separated from verified requirements)
 */
export interface MissionAssumption {
  readonly assumptionId: string;
  readonly description: string;
  readonly parameter: string;
  readonly value: number | string | boolean;
  readonly unit: string;
  readonly rationale: string;
  readonly impact: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'REJECTED';
  readonly metadata?: Record<string, unknown>;
}

/**
 * Mission Constraints
 */
export interface MissionConstraint {
  readonly constraintId: string;
  readonly constraintType:
    | 'MaximumMass'
    | 'MaximumVolume'
    | 'BatteryLimit'
    | 'PayloadLimit'
    | 'EnvironmentalLimit'
    | 'ManufacturingLimit'
    | 'OperationalLimit'
    | 'SafetyLimit'
    | string;
  readonly description: string;
  readonly limitValue: number;
  readonly unit: string;
  readonly rationale: string;
  readonly priority?: RequirementPriority;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Performance Requirements Set
 */
export interface PerformanceRequirementValues {
  readonly maximumTakeoffMass: QuantityWithUnit; // kg
  readonly emptyMassTarget: QuantityWithUnit; // kg
  readonly payloadCapacity: QuantityWithUnit; // kg
  readonly maximumSpeed: QuantityWithUnit; // m/s
  readonly cruiseSpeed: QuantityWithUnit; // m/s
  readonly climbRate: QuantityWithUnit; // m/s
  readonly maximumAltitude: QuantityWithUnit; // m
  readonly missionRange: QuantityWithUnit; // m
  readonly endurance: QuantityWithUnit; // s or min
  readonly hoverTime: QuantityWithUnit; // s or min
  readonly maximumWindSpeed: QuantityWithUnit; // m/s
  readonly maximumGust: QuantityWithUnit; // m/s
  readonly turningRate: QuantityWithUnit; // deg/s
  readonly accelerationLimit: QuantityWithUnit; // m/s²
  readonly landingSpeed: QuantityWithUnit; // m/s
}

/**
 * Mission Definition
 */
export interface MissionDefinition {
  readonly missionId: string;
  readonly missionName: string;
  readonly missionDescription: string;
  readonly missionClass: 'INSPECTION' | 'SURVEILLANCE' | 'DELIVERY' | 'SURVEYING' | 'SEARCH_AND_RESCUE' | string;
  readonly operatingScenario: string;
  readonly primaryObjective: string;
  readonly secondaryObjectives: readonly string[];
  readonly missionDuration: QuantityWithUnit; // s or min
  readonly requiredRange: QuantityWithUnit; // m
  readonly requiredPayload: QuantityWithUnit; // kg
  readonly operatingAltitude: QuantityWithUnit; // m
  readonly operatingSpeed: QuantityWithUnit; // m/s
  readonly environmentalConditionsRef: string; // ref to EnvironmentProfileId
  readonly operationalConstraints: readonly string[];
  readonly safetyConstraints: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Product Definition
 */
export interface ProductDefinition {
  readonly productId: string;
  readonly productName: string;
  readonly productType: string;
  readonly missionId: string;
  readonly environmentProfileId: string;
  readonly payloadProfileId: string;
  readonly performanceRequirementRefs: readonly string[];
  readonly constraintRefs: readonly string[];
  readonly assumptionRefs: readonly string[];
  readonly revision: string;
  readonly status: 'DEFINED';
  readonly createdAt: string;
  readonly createdBy: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Input configuration for creating an EPC-016 Industrial Drone Proof Case
 */
export interface EPC016InputConfig {
  readonly caseId?: string;
  readonly revision?: string;
  readonly mission: MissionDefinition;
  readonly environment: OperatingEnvironmentDefinition;
  readonly payload: PayloadDefinition;
  readonly endurance: EnduranceDefinition;
  readonly performance: PerformanceRequirementValues;
  readonly assumptions: readonly MissionAssumption[];
  readonly constraints: readonly MissionConstraint[];
  readonly author?: string;
  readonly customRequirements?: readonly EngineeringRequirement[];
}

/**
 * EPC-016 Definition Bundle Output
 */
export interface EPC016ProductBundle {
  readonly proofCase: ProofCaseProject;
  readonly mission: MissionDefinition;
  readonly environment: OperatingEnvironmentDefinition;
  readonly payload: PayloadDefinition;
  readonly endurance: EnduranceDefinition;
  readonly performance: PerformanceRequirementValues;
  readonly requirements: readonly EngineeringRequirement[];
  readonly assumptions: readonly MissionAssumption[];
  readonly constraints: readonly MissionConstraint[];
  readonly productDefinition: ProductDefinition;
  readonly configurationBaseline: Record<string, unknown>;
  readonly evidencePackage: Record<string, unknown>;
  readonly provenance: EvidenceProvenance;
  readonly revisionHistory: readonly {
    readonly revision: string;
    readonly timestamp: string;
    readonly author: string;
    readonly changeSummary: string;
  }[];
}

export class EPC016ValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string = 'EPC016_VALIDATION_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'EPC016ValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, EPC016ValidationError.prototype);
  }
}
