/**
 * SECP Industrial OS — EPC-017: Requirement Change Impact Engine
 * Multi-Disciplinary Dependency Tracing and Change Impact Detection
 * for CAD, CAE, CFD, FEA, Flight Dynamics, and Verification Artifacts.
 */

import {
  SystemRequirement,
  ChangeImpactResult,
  SystemRequirementCategory
} from './SystemRequirementTypes';

export interface ImpactRule {
  readonly parameterMatcher: RegExp;
  readonly categoryMatcher?: string | RegExp;
  readonly impactedSubsystems: readonly string[];
  readonly impactedDisciplines: readonly string[];
  readonly impactedArtifacts: readonly string[];
  readonly descriptionTemplate: (param: string, oldVal: unknown, newVal: unknown) => string;
}

export class RequirementImpactEngine {
  private static readonly IMPACT_RULES: readonly ImpactRule[] = [
    // Mass & CG
    {
      parameterMatcher: /mass|weight|mtom|cg|center_of_gravity|payload_mass/i,
      impactedSubsystems: [
        'MASS_PROPERTIES',
        'PROPULSION',
        'AIRFRAME_STRUCTURE',
        'BATTERY_POWER',
        'FLIGHT_CONTROL',
        'LANDING_GEAR'
      ],
      impactedDisciplines: [
        'MASS_PROPERTIES_ESTIMATION',
        'FLIGHT_DYNAMICS_STABILITY',
        'PROPULSION_THRUST_MARGIN',
        'STRUCTURAL_FEA',
        'MISSION_ENERGY_SIMULATION'
      ],
      impactedArtifacts: [
        'CAD_AIRFRAME_MODEL',
        'CAE_STRUCTURAL_LOADCASES',
        'SIM_MISSION_ENDURANCE',
        'PROP_THRUST_CURVE',
        'FLIGHT_CONTROL_GAINS'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in mass parameter '${param}' from ${String(oldVal)} to ${String(newVal)} alters CG, vehicle inertia tensor, required hover/cruise thrust margins, and structural static load cases.`
    },

    // Aerodynamics & Speeds
    {
      parameterMatcher: /speed|velocity|airspeed|drag|lift|thrust|rotor|propeller|aerodynamic/i,
      impactedSubsystems: [
        'AERODYNAMICS_ROTOR',
        'PROPULSION_MOTORS',
        'AVIONICS_AIRSPEED',
        'THERMAL_COOLING'
      ],
      impactedDisciplines: [
        'CFD_AERODYNAMICS',
        'PROPULSION_EFFICIENCY',
        'AERODYNAMIC_LOADS',
        'DYNAMIC_RESPONSE'
      ],
      impactedArtifacts: [
        'CFD_FLUID_MESH',
        'PROP_RPM_LOOKUP_TABLE',
        'SIM_FLIGHT_PROFILE',
        'AERO_ACOUSTIC_PREDICTION'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in aerodynamic parameter '${param}' from ${String(oldVal)} to ${String(newVal)} invalidates rotor CFD flow fields, power polar, and cruise thrust calibrations.`
    },

    // Energy & Electrical Power
    {
      parameterMatcher: /power|battery|capacity|energy|voltage|current|endurance|range/i,
      impactedSubsystems: [
        'ENERGY_STORAGE',
        'POWER_DISTRIBUTION_BOARD',
        'MOTOR_ELECTRONIC_SPEED_CONTROLLER',
        'BATTERY_THERMAL_MANAGEMENT'
      ],
      impactedDisciplines: [
        'ELECTRICAL_SYSTEMS',
        'MISSION_ENDURANCE_SIMULATION',
        'THERMAL_DISSIPATION_ANALYSIS',
        'BATTERY_CYCLE_DEGRADATION'
      ],
      impactedArtifacts: [
        'SIM_ENERGY_BUDGET',
        'THERMAL_FEA_BATTERY_PACK',
        'BMS_SAFETY_FIRMWARE',
        'POWER_HARNESS_SCHEMATIC'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in energy parameter '${param}' from ${String(oldVal)} to ${String(newVal)} impacts flight endurance envelope, C-rate thermal buildup, and low-voltage return-to-home trigger thresholds.`
    },

    // Structural & Mechanics
    {
      parameterMatcher: /stress|strain|stiffness|deflection|yield|ultimate|factor_of_safety|load_factor|fatigue|vibration/i,
      impactedSubsystems: [
        'PRIMARY_STRUCTURE_FRAME',
        'MOTOR_ARM_JOINTS',
        'PAYLOAD_MOUNTING_GIMBAL',
        'FASTENERS_HARDWARE'
      ],
      impactedDisciplines: [
        'STRUCTURAL_FEA',
        'FATIGUE_FRACTURE_MECHANICS',
        'AEROELASTIC_MODAL_ANALYSIS',
        'PHYSICAL_LOAD_TESTING'
      ],
      impactedArtifacts: [
        'FEA_MESH_AND_BOUNDARY_CONDITIONS',
        'LOAD_CASE_MATRIX',
        'MATERIAL_ALLOWABLES_DATABASE',
        'STATIC_TENSILE_PULL_TEST_RIG'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in structural parameter '${param}' from ${String(oldVal)} to ${String(newVal)} requires FEA stress re-convergence, margin-of-safety updates, and physical coupon test revalidation.`
    },

    // Environmental & Thermal
    {
      parameterMatcher: /temperature|thermal|wind|gust|altitude|pressure|humidity|ingress|ip_rating|dust|rain/i,
      impactedSubsystems: [
        'ENCLOSURE_SEALING',
        'AVIONICS_THERMAL_SINK',
        'BATTERY_INSULATION',
        'PROPULSION_AERODYNAMICS'
      ],
      impactedDisciplines: [
        'THERMAL_CFD_FEA',
        'AIR_DENSITY_ALTITUDE_CORRECTION',
        'ENVIRONMENTAL_CHAMBER_TESTING',
        'MATERIAL_ENVIRONMENTAL_RESISTANCE'
      ],
      impactedArtifacts: [
        'THERMAL_FEA_HEAT_SINK_MODEL',
        'CLIMATIC_CHAMBER_TEST_PLAN',
        'IP_INGRESS_SEAL_DRAWING',
        'HOT_HIGH_FLIGHT_POLAR'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in environmental parameter '${param}' from ${String(oldVal)} to ${String(newVal)} alters air density lift-to-thrust equations, heatsink boundary conditions, and gasket compression tolerances.`
    },

    // Controls & Avionics
    {
      parameterMatcher: /control|bandwidth|latency|stability|attitude|rate|pid|frequency|telemetry|failsafe/i,
      impactedSubsystems: [
        'AUTOPILOT_FLIGHT_CONTROLLER',
        'IMU_SENSOR_SUITE',
        'ACTUATOR_SERVOS_ESC',
        'TELEMETRY_LINK'
      ],
      impactedDisciplines: [
        'CONTROL_SYSTEMS_ENGINEERING',
        'HARDWARE_IN_THE_LOOP_HIL',
        'FREQUENCY_DOMAIN_STABILITY',
        'COMMUNICATIONS_RF'
      ],
      impactedArtifacts: [
        'FLIGHT_CONTROLLER_PID_GAINS',
        'HIL_SIMULATION_SCENARIOS',
        'BODE_NYQUIST_STABILITY_MARGINS',
        'RF_LINK_BUDGET_CALCULATION'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in control parameter '${param}' from ${String(oldVal)} to ${String(newVal)} necessitates flight dynamics stability re-tuning, phase/gain margin checks, and HIL scenario verification.`
    },

    // Payload & Interfaces
    {
      parameterMatcher: /payload|gimbal|fov|sensor|camera|interface|connector|mounting/i,
      impactedSubsystems: [
        'PAYLOAD_BAY_INTEGRATION',
        'GIMBAL_VIBRATION_ISOLATOR',
        'DATA_BUS_INTERFACE',
        'MASS_PROPERTIES'
      ],
      impactedDisciplines: [
        'MECHANICAL_PACKAGING_CAD',
        'VIBRATION_ISOLATION_DYNAMICS',
        'ELECTRICAL_BUS_INTEROPERABILITY',
        'OPTICAL_POINTING_ACCURACY'
      ],
      impactedArtifacts: [
        'CAD_PAYLOAD_INTERFACE_PLATE',
        'VIBRATION_TRANSMISSIBILITY_CURVE',
        'INTERFACE_CONTROL_DOCUMENT_ICD',
        'POWER_AND_DATA_PINOUT'
      ],
      descriptionTemplate: (param, oldVal, newVal) =>
        `Change in payload interface parameter '${param}' from ${String(oldVal)} to ${String(newVal)} modifies mechanical mounting footprint, vibration damper durometer, and data bus throughput allocations.`
    }
  ];

  /**
   * Evaluates the multi-disciplinary impact of modifying a requirement.
   */
  public static analyzeChange(
    oldRequirement: SystemRequirement,
    newRequirement: SystemRequirement
  ): ChangeImpactResult {
    const param = newRequirement.parameter || newRequirement.title || newRequirement.requirementId;
    const oldVal = oldRequirement.value ?? oldRequirement.targetValue ?? oldRequirement.tolerance ?? oldRequirement.description;
    const newVal = newRequirement.value ?? newRequirement.targetValue ?? newRequirement.tolerance ?? newRequirement.description;

    return this.evaluateParameterImpact(
      newRequirement.requirementId,
      param,
      oldVal,
      newVal,
      newRequirement.category
    );
  }

  /**
   * Evaluates parameter-level impact given parameter name, previous value, and new value.
   */
  public static evaluateParameterImpact(
    requirementId: string,
    parameter: string,
    previousValue: unknown,
    newValue: unknown,
    category?: SystemRequirementCategory
  ): ChangeImpactResult {
    const matchedSubsystems = new Set<string>();
    const matchedDisciplines = new Set<string>();
    const matchedArtifacts = new Set<string>();
    const descriptions: string[] = [];

    const searchTarget = `${parameter} ${category || ''}`.trim();

    for (const rule of this.IMPACT_RULES) {
      if (rule.parameterMatcher.test(searchTarget)) {
        rule.impactedSubsystems.forEach(s => matchedSubsystems.add(s));
        rule.impactedDisciplines.forEach(d => matchedDisciplines.add(d));
        rule.impactedArtifacts.forEach(a => matchedArtifacts.add(a));
        descriptions.push(rule.descriptionTemplate(parameter, previousValue, newValue));
      }
    }

    // Default fallback if no specific rule matched
    if (matchedSubsystems.size === 0) {
      matchedSubsystems.add('SYSTEM_INTEGRATION');
      matchedDisciplines.add('SYSTEMS_ENGINEERING');
      matchedArtifacts.add('SYSTEM_REQUIREMENTS_BASELINE');
      descriptions.push(
        `Modification of parameter '${parameter}' from ${String(previousValue)} to ${String(newValue)} impacts baseline system configuration and downstream trace checks.`
      );
    }

    return {
      requirementId,
      parameter,
      previousValue,
      newValue,
      impactedSubsystems: Array.from(matchedSubsystems),
      impactedDisciplines: Array.from(matchedDisciplines),
      impactedArtifacts: Array.from(matchedArtifacts),
      requiresReanalysis: true,
      description: descriptions.join(' ')
    };
  }
}
