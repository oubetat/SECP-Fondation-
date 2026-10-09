/**
 * SECP Industrial OS — EPC-016: Mission to Requirement Transformer
 * Converts high-level Mission, Operating Environment, Payload, Endurance,
 * and Performance definitions into a formal set of traceable EPC-002
 * Engineering Requirements and Product Definition references.
 */

import {
  EPC016InputConfig,
  ProductDefinition,
  QuantityWithUnit,
  RangeWithUnit
} from './MissionTypes';
import {
  EngineeringRequirement,
  RequirementPriority,
  RequirementVerificationMethod,
  RequirementValidationMethod,
  RequirementTolerance
} from '../EngineeringRequirementTypes';

export class MissionTransformer {
  /**
   * Transforms input mission configuration into canonical EPC-002 Engineering Requirements.
   */
  public static transformToRequirements(config: EPC016InputConfig): EngineeringRequirement[] {
    const requirements: EngineeringRequirement[] = [];

    // 1. Performance Requirements Mapping
    requirements.push(
      this.createRequirement({
        id: 'REQ-DRONE-MTOM-001',
        description: 'Maximum Takeoff Mass (MTOM) limitation for structural and propulsion sizing',
        parameter: 'maximumTakeoffMass',
        quantity: config.performance.maximumTakeoffMass,
        tolerance: { type: 'BOUNDS', upperBound: config.performance.maximumTakeoffMass.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'PERFORMANCE',
        source: 'DESIGN_TARGET'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-EMPTYMASS-001',
        description: 'Target empty mass (airframe, avionics, battery, propulsion without payload)',
        parameter: 'emptyMassTarget',
        quantity: config.performance.emptyMassTarget,
        tolerance: { type: 'BOUNDS', upperBound: config.performance.emptyMassTarget.value },
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'PERFORMANCE',
        source: 'DESIGN_TARGET'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-PAYLOAD-CAP-001',
        description: 'Required payload carriage capacity',
        parameter: 'payloadCapacity',
        quantity: config.performance.payloadCapacity,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.payloadCapacity.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'PAYLOAD',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-VMAX-001',
        description: 'Maximum forward horizontal flight speed',
        parameter: 'maximumSpeed',
        quantity: config.performance.maximumSpeed,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.maximumSpeed.value },
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'PERFORMANCE',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-VCRUISE-001',
        description: 'Nominal cruise speed for energy-optimal transit',
        parameter: 'cruiseSpeed',
        quantity: config.performance.cruiseSpeed,
        tolerance: { type: 'RELATIVE', nominalValue: config.performance.cruiseSpeed.value, relativeTolerance: 0.1 },
        priority: 'MEDIUM',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'PERFORMANCE',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-CLIMB-001',
        description: 'Maximum sustained vertical climb rate',
        parameter: 'climbRate',
        quantity: config.performance.climbRate,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.climbRate.value },
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'PERFORMANCE',
        source: 'DESIGN_TARGET'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-CEILING-001',
        description: 'Maximum operating altitude / service ceiling AMSL',
        parameter: 'maximumAltitude',
        quantity: config.performance.maximumAltitude,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.maximumAltitude.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'FIELD_TEST',
        category: 'OPERATIONAL',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-RANGE-001',
        description: 'Operational mission transit range',
        parameter: 'missionRange',
        quantity: config.performance.missionRange,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.missionRange.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'FIELD_TEST',
        category: 'MISSION',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-ENDURANCE-001',
        description: 'Required total flight endurance at nominal mission profile',
        parameter: 'endurance',
        quantity: config.performance.endurance,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.endurance.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'FIELD_TEST',
        category: 'ENERGY',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-HOVER-001',
        description: 'Required stationary hover capability duration',
        parameter: 'hoverTime',
        quantity: config.performance.hoverTime,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.hoverTime.value },
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'PERFORMANCE',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-WIND-RESIST-001',
        description: 'Maximum sustained operating wind resistance',
        parameter: 'maximumWindSpeed',
        quantity: config.performance.maximumWindSpeed,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.maximumWindSpeed.value },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'ENVIRONMENT',
        source: 'CUSTOMER_REQUIREMENT'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-GUST-RESIST-001',
        description: 'Maximum operating wind gust resistance',
        parameter: 'maximumGust',
        quantity: config.performance.maximumGust,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.maximumGust.value },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'ENVIRONMENT',
        source: 'CUSTOMER_REQUIREMENT'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-TURNING-001',
        description: 'Maximum yaw turning rate capability',
        parameter: 'turningRate',
        quantity: config.performance.turningRate,
        tolerance: { type: 'BOUNDS', lowerBound: config.performance.turningRate.value },
        priority: 'MEDIUM',
        verificationMethod: 'SIMULATION',
        validationMethod: 'FIELD_TEST',
        category: 'PERFORMANCE',
        source: 'DESIGN_TARGET'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-ACCEL-001',
        description: 'Maximum allowable acceleration limit for avionics and structure',
        parameter: 'accelerationLimit',
        quantity: config.performance.accelerationLimit,
        tolerance: { type: 'BOUNDS', upperBound: config.performance.accelerationLimit.value },
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        category: 'SAFETY',
        source: 'DESIGN_TARGET'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-LANDING-V-001',
        description: 'Maximum touchdown vertical landing speed',
        parameter: 'landingSpeed',
        quantity: config.performance.landingSpeed,
        tolerance: { type: 'BOUNDS', upperBound: config.performance.landingSpeed.value },
        priority: 'HIGH',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST',
        category: 'SAFETY',
        source: 'DESIGN_TARGET'
      })
    );

    // 2. Endurance & Energy Budget Requirements
    requirements.push(
      this.createRequirement({
        id: 'REQ-DRONE-BATTERY-CAP-001',
        description: 'Battery energy capacity budget',
        parameter: 'batteryCapacity',
        quantity: config.endurance.batteryCapacity,
        tolerance: { type: 'BOUNDS', lowerBound: config.endurance.batteryCapacity.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'ENERGY',
        source: 'ENGINEERING_ASSUMPTION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-CRUISE-POWER-001',
        description: 'Cruise power consumption budget threshold',
        parameter: 'cruisePowerBudget',
        quantity: config.endurance.cruisePowerBudget,
        tolerance: { type: 'BOUNDS', upperBound: config.endurance.cruisePowerBudget.value },
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'ENERGY',
        source: 'ENGINEERING_ASSUMPTION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-HOVER-POWER-001',
        description: 'Hover power consumption budget threshold',
        parameter: 'hoverPowerBudget',
        quantity: config.endurance.hoverPowerBudget,
        tolerance: { type: 'BOUNDS', upperBound: config.endurance.hoverPowerBudget.value },
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'ENERGY',
        source: 'ENGINEERING_ASSUMPTION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-RESERVE-ENERGY-001',
        description: 'Reserve energy requirement at mission completion',
        parameter: 'reserveEnergy',
        quantity: config.endurance.reserveEnergy,
        tolerance: { type: 'BOUNDS', lowerBound: config.endurance.reserveEnergy.value },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'FIELD_TEST',
        category: 'SAFETY',
        source: 'REGULATORY_REFERENCE'
      })
    );

    // 3. Payload Requirements
    requirements.push(
      this.createRequirement({
        id: 'REQ-DRONE-PAYLOAD-MASS-001',
        description: `Dedicated payload mass allocation for ${config.payload.payloadName}`,
        parameter: 'payloadMass',
        quantity: config.payload.payloadMass,
        tolerance: { type: 'BOUNDS', upperBound: config.payload.payloadMass.value },
        priority: 'CRITICAL',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST',
        category: 'PAYLOAD',
        source: 'MISSION_DEFINITION'
      }),
      this.createRequirement({
        id: 'REQ-DRONE-PAYLOAD-PWR-001',
        description: `Dedicated payload power supply allocation for ${config.payload.payloadName}`,
        parameter: 'payloadPower',
        quantity: config.payload.payloadPower,
        tolerance: { type: 'BOUNDS', upperBound: config.payload.payloadPower.value },
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'PHYSICAL_TEST',
        category: 'PAYLOAD',
        source: 'MISSION_DEFINITION'
      })
    );

    // Add sub-requirements from Payload definition if provided
    if (config.payload.payloadRequirements && Array.isArray(config.payload.payloadRequirements)) {
      for (const pReq of config.payload.payloadRequirements) {
        // Ensure no duplicate IDs
        if (!requirements.some(r => r.requirementId === pReq.requirementId)) {
          requirements.push({
            ...pReq,
            metadata: {
              ...pReq.metadata,
              status: pReq.metadata?.status || 'DEFINED',
              evidenceStatus: 'NOT_YET_AVAILABLE',
              designFeatureLink: 'NOT_YET_LINKED',
              analysisLink: 'NOT_YET_LINKED',
              testLink: 'NOT_YET_LINKED',
              evidenceLink: 'NOT_YET_LINKED',
              isCritical: pReq.priority === 'CRITICAL'
            }
          });
        }
      }
    }

    // 4. Operating Environment Requirements
    requirements.push(
      this.createRangeRequirement({
        id: 'REQ-DRONE-ENV-TEMP-001',
        description: 'Operating temperature range tolerance',
        parameter: 'operatingTemperature',
        range: config.environment.temperatureRange,
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'EXPERIMENT',
        category: 'ENVIRONMENT',
        source: 'CUSTOMER_REQUIREMENT'
      }),
      this.createRangeRequirement({
        id: 'REQ-DRONE-ENV-PRESS-001',
        description: 'Operating atmospheric pressure range tolerance',
        parameter: 'operatingPressure',
        range: config.environment.pressureRange,
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'EXPERIMENT',
        category: 'ENVIRONMENT',
        source: 'CUSTOMER_REQUIREMENT'
      }),
      this.createRangeRequirement({
        id: 'REQ-DRONE-ENV-HUMID-001',
        description: 'Operating relative humidity range tolerance',
        parameter: 'relativeHumidity',
        range: config.environment.humidityRange,
        priority: 'MEDIUM',
        verificationMethod: 'INSPECTION',
        validationMethod: 'EXPERIMENT',
        category: 'ENVIRONMENT',
        source: 'CUSTOMER_REQUIREMENT'
      })
    );

    // 5. Append Custom Requirements if any
    if (config.customRequirements && Array.isArray(config.customRequirements)) {
      for (const cReq of config.customRequirements) {
        if (!requirements.some(r => r.requirementId === cReq.requirementId)) {
          requirements.push({
            ...cReq,
            metadata: {
              ...cReq.metadata,
              status: cReq.metadata?.status || 'DEFINED',
              evidenceStatus: 'NOT_YET_AVAILABLE',
              designFeatureLink: 'NOT_YET_LINKED',
              analysisLink: 'NOT_YET_LINKED',
              testLink: 'NOT_YET_LINKED',
              evidenceLink: 'NOT_YET_LINKED',
              isCritical: cReq.priority === 'CRITICAL'
            }
          });
        }
      }
    }

    return requirements;
  }

  /**
   * Creates a ProductDefinition metadata container linking all references.
   */
  public static createProductDefinition(
    config: EPC016InputConfig,
    requirements: readonly EngineeringRequirement[],
    createdAt: string
  ): ProductDefinition {
    const revision = config.revision || '1.0';

    return {
      productId: 'PROD-DRONE-001',
      productName: 'Industrial Drone',
      productType: 'UNMANNED_AERIAL_SYSTEM',
      missionId: config.mission.missionId,
      environmentProfileId: config.environment.environmentProfileId,
      payloadProfileId: config.payload.payloadId,
      performanceRequirementRefs: requirements.map(r => r.requirementId),
      constraintRefs: config.constraints.map(c => c.constraintId),
      assumptionRefs: config.assumptions.map(a => a.assumptionId),
      revision,
      status: 'DEFINED',
      createdAt,
      createdBy: config.author || 'SECP_MISSION_ENGINE',
      metadata: {
        missionClass: config.mission.missionClass,
        payloadType: config.payload.payloadType,
        totalRequirementsCount: requirements.length,
        criticalRequirementsCount: requirements.filter(r => r.priority === 'CRITICAL').length
      }
    };
  }

  /**
   * Helper to build a scalar quantity requirement.
   */
  private static createRequirement(args: {
    id: string;
    description: string;
    parameter: string;
    quantity: QuantityWithUnit;
    tolerance: RequirementTolerance;
    priority: RequirementPriority;
    verificationMethod: RequirementVerificationMethod;
    validationMethod: RequirementValidationMethod;
    category: string;
    source: string;
  }): EngineeringRequirement {
    return {
      requirementId: args.id,
      description: args.description,
      parameter: args.parameter,
      unit: args.quantity.unit,
      tolerance: args.tolerance,
      priority: args.priority,
      verificationMethod: args.verificationMethod,
      validationMethod: args.validationMethod,
      category: args.category,
      revision: '1.0',
      metadata: {
        nominalValue: args.quantity.value,
        source: args.source,
        status: 'DEFINED',
        evidenceStatus: 'NOT_YET_AVAILABLE',
        isCritical: args.priority === 'CRITICAL',
        designFeatureLink: 'NOT_YET_LINKED',
        analysisLink: 'NOT_YET_LINKED',
        testLink: 'NOT_YET_LINKED',
        evidenceLink: 'NOT_YET_LINKED'
      }
    };
  }

  /**
   * Helper to build a range-based quantity requirement.
   */
  private static createRangeRequirement(args: {
    id: string;
    description: string;
    parameter: string;
    range: RangeWithUnit;
    priority: RequirementPriority;
    verificationMethod: RequirementVerificationMethod;
    validationMethod: RequirementValidationMethod;
    category: string;
    source: string;
  }): EngineeringRequirement {
    return {
      requirementId: args.id,
      description: args.description,
      parameter: args.parameter,
      unit: args.range.unit,
      tolerance: {
        type: 'BOUNDS',
        lowerBound: args.range.min,
        upperBound: args.range.max
      },
      priority: args.priority,
      verificationMethod: args.verificationMethod,
      validationMethod: args.validationMethod,
      category: args.category,
      revision: '1.0',
      metadata: {
        minValue: args.range.min,
        maxValue: args.range.max,
        source: args.source,
        status: 'DEFINED',
        evidenceStatus: 'NOT_YET_AVAILABLE',
        isCritical: args.priority === 'CRITICAL',
        designFeatureLink: 'NOT_YET_LINKED',
        analysisLink: 'NOT_YET_LINKED',
        testLink: 'NOT_YET_LINKED',
        evidenceLink: 'NOT_YET_LINKED'
      }
    };
  }
}
