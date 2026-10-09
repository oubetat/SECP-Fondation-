/**
 * SECP Industrial OS — EPC-018: Industrial Drone Product Architecture
 * Authoritative, parameterized product architecture for the Industrial Drone (Proof Case 01),
 * synthesizing Airframe, Propulsion, Battery, Payload, Landing Gear, and Avionics
 * with explicit interfaces, physics-derived properties, and traceability links.
 */

import { EPC016InputConfig } from '../mission/MissionTypes';
import { IndustrialDroneProofCase } from '../mission/IndustrialDroneProofCase';
import {
  ArchitectureComponent,
  ArchitectureRequirementLink,
  Dimensions3D,
  InertiaTensor,
  MassBreakdown,
  OperatingEnvelope,
  Point3D,
  PowerAndEnergyBudget,
  ProductArchitecture,
  PropulsionFlightMetrics,
  SubsystemDefinition,
  SystemInterface,
  SystemLevelParameters
} from './ProductArchitectureTypes';

export interface DroneArchitectureOptions {
  readonly variant?: 'QUAD_INSPECTION_4X' | 'HEXA_HEAVY_LIFT_6X' | 'OCTO_ENDURANCE_8X';
  readonly missionConfig?: EPC016InputConfig;
  readonly revisionCode?: string;
  readonly author?: string;
}

export class IndustrialDroneProductArchitecture {
  public static readonly PRODUCT_ID = 'PROD-DRONE-SEC01';
  public static readonly PRODUCT_NAME = 'SECP Industrial Inspection & Mapping UAV';
  public static readonly DEFAULT_VARIANT = 'QUAD_INSPECTION_4X';
  public static readonly CASE_ID = 'EPC-CASE-001';

  /**
   * Generates a fully realized, valid, traceable ProductArchitecture for the Industrial Drone.
   */
  public static createDroneArchitecture(options?: DroneArchitectureOptions): ProductArchitecture {
    const config = options?.missionConfig || IndustrialDroneProofCase.createDefaultInspectionDroneConfig();
    const variant = options?.variant || 'QUAD_INSPECTION_4X';
    const revision = options?.revisionCode || '1.0';
    const author = options?.author || 'SECP Systems Engineering Core';
    const now = new Date().toISOString();

    const architectureId = `ARCH-${this.PRODUCT_ID}-${variant}-REV${revision.replace('.', '_')}`;

    // Subsystems generation
    const airframeSubsystem = this.buildAirframeSubsystem(variant, config);
    const propulsionSubsystem = this.buildPropulsionSubsystem(variant, config);
    const batterySubsystem = this.buildBatterySubsystem(variant, config);
    const payloadSubsystem = this.buildPayloadSubsystem(variant, config);
    const landingGearSubsystem = this.buildLandingGearSubsystem(variant, config);
    const avionicsSubsystem = this.buildAvionicsSubsystem(variant, config);

    const subsystems: readonly SubsystemDefinition[] = [
      airframeSubsystem,
      propulsionSubsystem,
      batterySubsystem,
      payloadSubsystem,
      landingGearSubsystem,
      avionicsSubsystem
    ];

    // Build interfaces between subsystems
    const interfaces = this.buildSystemInterfaces(subsystems);

    // Compute System-Level Parameters derived from components
    const systemParameters = this.computeSystemParameters(subsystems, variant, config);

    // Requirement Links
    const requirementLinks = this.buildRequirementLinks(subsystems, interfaces);

    const architecture: ProductArchitecture = {
      architectureId,
      productId: this.PRODUCT_ID,
      productName: this.PRODUCT_NAME,
      productType: 'INDUSTRIAL_DRONE',
      revision,
      variantCode: variant,
      variantName: this.getVariantDisplayName(variant),
      description: `Industrial autonomous multicopter architecture configured for ${config.mission.missionClass} with ${config.payload.payloadType} payload.`,
      subsystems,
      interfaces,
      systemParameters,
      requirementLinks,
      metadata: {
        createdAt: now,
        updatedAt: now,
        author,
        configurationId: `CFG-${this.PRODUCT_ID}-${variant}`,
        baselineId: `BSL-${this.PRODUCT_ID}-INITIAL`,
        domain: 'AEROSPACE_AUTONOMOUS_SYSTEMS',
        proofCaseId: this.CASE_ID
      }
    };

    return architecture;
  }

  private static getVariantDisplayName(variant: string): string {
    switch (variant) {
      case 'HEXA_HEAVY_LIFT_6X':
        return 'Industrial Hexacopter Heavy Payload Variant (6X)';
      case 'OCTO_ENDURANCE_8X':
        return 'Industrial Octocopter Extended Endurance Variant (8X)';
      case 'QUAD_INSPECTION_4X':
      default:
        return 'Industrial Quadcopter Inspection Baseline Variant (4X)';
    }
  }

  // 1. AIRFRAME SUBSYSTEM
  private static buildAirframeSubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const isHexa = variant === 'HEXA_HEAVY_LIFT_6X';
    const isOcto = variant === 'OCTO_ENDURANCE_8X';
    const armCount = isOcto ? 8 : isHexa ? 6 : 4;
    const armLengthMm = isOcto ? 380 : isHexa ? 350 : 320;
    const armMassKg = isOcto ? 0.085 : isHexa ? 0.080 : 0.075;

    const components: ArchitectureComponent[] = [
      // 1.1 Fuselage / Central Body
      {
        componentId: 'COMP-AIR-001',
        subsystemId: 'SUB-AIRFRAME',
        name: 'Central Body Upper & Lower Deck Assembly',
        category: 'FUSELAGE',
        description: 'CNC high-modulus carbon fiber composite core plates with internal EMI shielding and IP54 sealed perimeter gasket.',
        partNumber: 'AIR-FUS-CF-01',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.42,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.0 },
          dimensions: { lengthMm: 240, widthMm: 240, heightMm: 55 },
          materialName: 'Toray T700 High-Modulus Carbon Fiber / 6061-T6 Aluminum Standoffs',
          densityKgM3: 1550
        },
        environmental: {
          ipRating: 'IP54',
          minOperatingTempC: -20,
          maxOperatingTempC: 50,
          vibrationToleranceG: 15.0
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-010', 'DRONE-REQ-019'],
        cadModelReference: 'CAD/AIRFRAME/FUSELAGE_ASSY.STEP',
        feaModelReference: 'FEA/AIRFRAME/FUSELAGE_STRESS_MODAL.H5',
        isCritical: true
      },
      // 1.2 Arms Assembly
      {
        componentId: 'COMP-AIR-002',
        subsystemId: 'SUB-AIRFRAME',
        name: `${armCount}x Carbon Fiber Tubular Arm Set with Quick-Lock Joints`,
        category: 'ARM',
        description: `Set of ${armCount} roll-wrapped 3K matte carbon fiber tubes (25mm OD) with CNC 7075-T6 aluminum folding hinges.`,
        partNumber: `AIR-ARM-25MM-${armCount}X`,
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: armCount * armMassKg,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.01 },
          dimensions: { lengthMm: armLengthMm * 2, widthMm: armLengthMm * 2, heightMm: 35 },
          materialName: '3K Carbon Fiber Torayca T700 25mm OD / 7075-T6 Folding Knuckles'
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-018'],
        cadModelReference: 'CAD/AIRFRAME/ARM_SET.STEP',
        isCritical: true
      },
      // 1.3 Motor Mounts
      {
        componentId: 'COMP-AIR-003',
        subsystemId: 'SUB-AIRFRAME',
        name: `${armCount}x Billet Aluminum Motor Mount Brackets`,
        category: 'MOTOR_MOUNT',
        description: `CNC machined 7075-T6 motor clamping brackets with integrated silicone vibration isolation bushings and ESC cavity.`,
        partNumber: 'AIR-MMT-7075-01',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: armCount * 0.035,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.02 },
          dimensions: { lengthMm: 60, widthMm: 45, heightMm: 28 },
          materialName: '7075-T6 Hard-Anodized Billet Aluminum'
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008'],
        isCritical: true
      },
      // 1.4 Battery Mount & Retention Quick-Release
      {
        componentId: 'COMP-AIR-004',
        subsystemId: 'SUB-AIRFRAME',
        name: 'Battery Quick-Release Sled and Dual Latch Tray',
        category: 'BATTERY_MOUNT',
        description: 'Vibration-isolated carbon fiber battery sliding tray with secondary mechanical safety locking latch.',
        partNumber: 'AIR-BAT-TRAY-01',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.14,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.03 },
          dimensions: { lengthMm: 200, widthMm: 95, heightMm: 25 },
          materialName: 'Carbon Fiber Plate / Stainless 316 Retention Springs'
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-006', 'DRONE-REQ-008'],
        isCritical: true
      },
      // 1.5 Payload Mount & Damping Interface
      {
        componentId: 'COMP-AIR-005',
        subsystemId: 'SUB-AIRFRAME',
        name: 'Universal Payload Quick-Release Gimbal Damping Rail',
        category: 'PAYLOAD_MOUNT',
        description: '12mm carbon rail mount system with 4-point fluorosilicone oil-damped vibration dampers and quick-release shoe.',
        partNumber: 'AIR-PAY-RAIL-01',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.12,
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.04 },
          dimensions: { lengthMm: 180, widthMm: 120, heightMm: 30 },
          materialName: 'Carbon Fiber / 6061 Aluminum / Silicone Dampers'
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-007', 'DRONE-REQ-008'],
        isCritical: true
      },
      // 1.6 Landing Gear Mount Hardpoints
      {
        componentId: 'COMP-AIR-006',
        subsystemId: 'SUB-AIRFRAME',
        name: 'Fuselage Landing Gear Structural Interface Brackets',
        category: 'LANDING_GEAR_MOUNT',
        description: '4x high-strength CNC bracket mounts transferring drop landing loads to the central fuselage composite ribs.',
        partNumber: 'AIR-LGM-BRK-01',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.065,
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.02 },
          dimensions: { lengthMm: 40, widthMm: 30, heightMm: 20 },
          materialName: '7075-T6 Aluminum'
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-020'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg, 0);

    return {
      subsystemId: 'SUB-AIRFRAME',
      name: 'Airframe Structural Subsystem',
      category: 'AIRFRAME',
      description: 'Primary structural airframe composed of central fuselage, tubular arms, motor mounts, battery tray, and payload mounts.',
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: 0.002 },
      totalPowerDrawWatts: 0,
      traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-010', 'DRONE-REQ-018', 'DRONE-REQ-019'],
      isCritical: true
    };
  }

  // 2. PROPULSION SUBSYSTEM
  private static buildPropulsionSubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const isHexa = variant === 'HEXA_HEAVY_LIFT_6X';
    const isOcto = variant === 'OCTO_ENDURANCE_8X';
    const motorCount = isOcto ? 8 : isHexa ? 6 : 4;
    const motorModel = isOcto ? 'T-Motor U8 II KV100' : isHexa ? 'T-Motor MN501-S KV240' : 'T-Motor MN6007 KV160';
    const motorMassEach = isOcto ? 0.24 : isHexa ? 0.17 : 0.20;
    const maxThrustEach = isOcto ? 38.0 : isHexa ? 29.0 : 42.0; // Newtons
    const maxPowerEach = isOcto ? 420 : isHexa ? 340 : 520; // Watts
    const propDiameterInches = isOcto ? 18 : isHexa ? 16 : 21;

    const components: ArchitectureComponent[] = [
      // 2.1 Motors
      {
        componentId: 'COMP-PROP-001',
        subsystemId: 'SUB-PROPULSION',
        name: `${motorCount}x High-Efficiency Brushless DC Motors (${motorModel})`,
        category: 'MOTOR',
        description: `${motorCount}x industrial sealed outrunner BLDC motors with IP55 weatherproofing and precision dynamic balancing.`,
        partNumber: `PROP-MOT-${motorCount}X-KV160`,
        revision: '1.0',
        quantity: motorCount,
        physical: {
          massKg: motorMassEach,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.035 },
          dimensions: { lengthMm: 68, widthMm: 68, heightMm: 36 },
          materialName: 'Silicon Steel Stator / N45SH Neodymium Magnets / Ezo Japanese Bearings'
        },
        performance: {
          maxThrustNewtons: maxThrustEach,
          maxTorqueNm: 1.45,
          kvRpmPerVolt: 160,
          maxPowerWatts: maxPowerEach,
          efficiencyGramsPerWatt: 9.8
        },
        environmental: {
          ipRating: 'IP55',
          minOperatingTempC: -20,
          maxOperatingTempC: 60
        },
        traceableRequirementIds: ['DRONE-REQ-002', 'DRONE-REQ-003', 'DRONE-REQ-004', 'DRONE-REQ-012'],
        cadModelReference: 'CAD/PROPULSION/BLDC_MOTOR.STEP',
        isCritical: true
      },
      // 2.2 Propellers
      {
        componentId: 'COMP-PROP-002',
        subsystemId: 'SUB-PROPULSION',
        name: `${motorCount}x Carbon Fiber Propeller Blades (${propDiameterInches}" Folding/Fixed Pair)`,
        category: 'PROPELLER',
        description: `${motorCount}x ultralight solid carbon fiber low-noise airfoil matched CW/CCW propeller set.`,
        partNumber: `PROP-BLD-${propDiameterInches}IN-CF`,
        revision: '1.0',
        quantity: motorCount,
        physical: {
          massKg: 0.045,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.055 },
          dimensions: { lengthMm: propDiameterInches * 25.4, widthMm: 42, heightMm: 18 },
          materialName: 'Toray High-Modulus Carbon Fiber with Foam Core'
        },
        performance: {
          maxThrustNewtons: maxThrustEach,
          maxPowerWatts: maxPowerEach
        },
        traceableRequirementIds: ['DRONE-REQ-002', 'DRONE-REQ-003', 'DRONE-REQ-004', 'DRONE-REQ-017'],
        cadModelReference: 'CAD/PROPULSION/PROPELLER.STEP',
        isCritical: true
      },
      // 2.3 Electronic Speed Controllers (ESCs)
      {
        componentId: 'COMP-PROP-003',
        subsystemId: 'SUB-PROPULSION',
        name: `${motorCount}x FOC Intelligent Motor Controllers (6S-12S 60A ESC)`,
        category: 'ESC',
        description: `${motorCount}x Field Oriented Control (FOC) sinusoidal ESCs with real-time CAN/DShot telemetry reporting RPM, voltage, current, and temperature.`,
        partNumber: 'PROP-ESC-60A-FOC',
        revision: '1.0',
        quantity: motorCount,
        physical: {
          massKg: 0.042,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.015 },
          dimensions: { lengthMm: 62, widthMm: 28, heightMm: 12 },
          materialName: 'FR4 Aluminum Substrate PCB with Aluminum Heat Sink'
        },
        electrical: {
          nominalVoltageV: 44.4,
          maxVoltageV: 50.4,
          continuousCurrentA: 50.0,
          peakCurrentA: 70.0,
          powerDrawWatts: 15.0
        },
        environmental: {
          ipRating: 'IP55',
          minOperatingTempC: -20,
          maxOperatingTempC: 75
        },
        traceableRequirementIds: ['DRONE-REQ-003', 'DRONE-REQ-004', 'DRONE-REQ-012'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg * c.quantity, 0);

    return {
      subsystemId: 'SUB-PROPULSION',
      name: 'Propulsion & Aerodynamic Actuation Subsystem',
      category: 'PROPULSION',
      description: `Propulsion system comprising ${motorCount} BLDC motors, matched carbon fiber propellers, and intelligent FOC ESCs.`,
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: 0.038 },
      totalPowerDrawWatts: motorCount * 15,
      traceableRequirementIds: ['DRONE-REQ-002', 'DRONE-REQ-003', 'DRONE-REQ-004', 'DRONE-REQ-012', 'DRONE-REQ-017'],
      isCritical: true
    };
  }

  // 3. BATTERY SUBSYSTEM
  private static buildBatterySubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const isHexa = variant === 'HEXA_HEAVY_LIFT_6X';
    const isOcto = variant === 'OCTO_ENDURANCE_8X';
    const capacityAh = isOcto ? 28.0 : isHexa ? 22.0 : 16.0;
    const nominalVoltage = 44.4; // 12S LiPo
    const totalEnergyWh = capacityAh * nominalVoltage;
    const batteryMass = isOcto ? 4.2 : isHexa ? 3.4 : 2.65;

    const components: ArchitectureComponent[] = [
      // 3.1 Main Battery Pack
      {
        componentId: 'COMP-BAT-001',
        subsystemId: 'SUB-BATTERY',
        name: `12S 44.4V High-Energy-Density Lithium-Polymer Battery Pack (${capacityAh}Ah)`,
        category: 'BATTERY_PACK',
        description: `Solid-state enhanced LiPo 12S pack delivering ${totalEnergyWh.toFixed(1)} Wh total energy capacity with aluminum structural casing.`,
        partNumber: `BAT-12S-${capacityAh}AH-LIPO`,
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: batteryMass,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.025 },
          dimensions: { lengthMm: 195, widthMm: 88, heightMm: 78 },
          materialName: 'Lithium Cobalt Oxide / Solid Electrolyte / Aluminum Enclosure',
          densityKgM3: 2100
        },
        electrical: {
          nominalVoltageV: nominalVoltage,
          maxVoltageV: 50.4,
          minVoltageV: 37.2,
          capacityAh,
          energyCapacityWh: totalEnergyWh,
          cellCount: 12,
          cellChemistry: 'LiPo High Energy Density',
          continuousCurrentA: 120.0,
          peakCurrentA: 200.0,
          powerDrawWatts: 0
        },
        environmental: {
          ipRating: 'IP54',
          minOperatingTempC: -15,
          maxOperatingTempC: 45
        },
        traceableRequirementIds: ['DRONE-REQ-002', 'DRONE-REQ-005', 'DRONE-REQ-006', 'DRONE-REQ-011', 'DRONE-REQ-016'],
        cadModelReference: 'CAD/BATTERY/BATTERY_PACK_12S.STEP',
        isCritical: true
      },
      // 3.2 Battery Management System (BMS)
      {
        componentId: 'COMP-BAT-002',
        subsystemId: 'SUB-BATTERY',
        name: 'Intelligent Active-Balancing Battery Management System (BMS)',
        category: 'BMS',
        description: 'Microcontroller-managed active cell balancing BMS with dual NTC temperature probes, short-circuit protection, and CAN bus telemetry.',
        partNumber: 'BAT-BMS-12S-CAN',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.085,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.03 },
          dimensions: { lengthMm: 80, widthMm: 45, heightMm: 12 },
          materialName: 'Epoxy Potted PCB'
        },
        electrical: {
          nominalVoltageV: nominalVoltage,
          continuousCurrentA: 150.0,
          powerDrawWatts: 3.5
        },
        environmental: {
          ipRating: 'IP55',
          minOperatingTempC: -20,
          maxOperatingTempC: 70
        },
        traceableRequirementIds: ['DRONE-REQ-006', 'DRONE-REQ-011', 'DRONE-REQ-016'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg, 0);

    return {
      subsystemId: 'SUB-BATTERY',
      name: 'Electrical Energy & Storage Subsystem',
      category: 'BATTERY',
      description: `Energy storage system with 12S ${capacityAh}Ah LiPo battery and CAN-enabled smart BMS.`,
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: 0.025 },
      totalPowerDrawWatts: 3.5,
      traceableRequirementIds: ['DRONE-REQ-002', 'DRONE-REQ-005', 'DRONE-REQ-006', 'DRONE-REQ-011', 'DRONE-REQ-016'],
      isCritical: true
    };
  }

  // 4. PAYLOAD SUBSYSTEM
  private static buildPayloadSubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const payloadMass = config.payload.payloadMass?.value ?? 1.2;
    const payloadPower = config.payload.payloadPower?.value ?? 25;
    const dims = config.payload.payloadDimensions || { length: 0.16, width: 0.14, height: 0.18, unit: 'm' };
    const payloadName = config.payload.payloadName || 'Dual Optical & Radiometric Thermal Gimbal Camera';

    const components: ArchitectureComponent[] = [
      // 4.1 Primary Payload Sensor Head
      {
        componentId: 'COMP-PAY-001',
        subsystemId: 'SUB-PAYLOAD',
        name: payloadName,
        category: 'PAYLOAD_SENSOR',
        description: `Primary inspection sensor package: ${payloadName} with direct optical zoom and radiometric temperature measurement.`,
        partNumber: 'PAY-SENS-DUAL-4K',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: Number((payloadMass * 0.65).toFixed(3)),
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.09 },
          dimensions: {
            lengthMm: (dims.length || 0.16) * 1000,
            widthMm: (dims.width || 0.14) * 1000,
            heightMm: (dims.height || 0.18) * 1000
          },
          materialName: 'Magnesium Alloy Housing / Optical Glass / Germanium Thermal Lens'
        },
        electrical: {
          nominalVoltageV: 12.0,
          maxVoltageV: 24.0,
          continuousCurrentA: 1.5,
          powerDrawWatts: Number((payloadPower * 0.7).toFixed(1))
        },
        environmental: {
          ipRating: 'IP54',
          minOperatingTempC: -20,
          maxOperatingTempC: 50
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-007', 'DRONE-REQ-010'],
        cadModelReference: 'CAD/PAYLOAD/GIMBAL_SENSOR.STEP',
        isCritical: true
      },
      // 4.2 3-Axis Precision Gimbal Mechanism
      {
        componentId: 'COMP-PAY-002',
        subsystemId: 'SUB-PAYLOAD',
        name: '3-Axis Brushless Direct-Drive Gimbal Stabilizer',
        category: 'GIMBAL',
        description: 'Direct-drive brushless motor 3-axis gimbal with 0.01-degree angular stabilization and continuous 360-degree pan.',
        partNumber: 'PAY-GMB-3AXIS-PRO',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: Number((payloadMass * 0.35).toFixed(3)),
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.06 },
          dimensions: { lengthMm: 130, widthMm: 120, heightMm: 95 },
          materialName: 'CNC 6061-T6 Aluminum / Carbon Fiber Beams'
        },
        electrical: {
          nominalVoltageV: 12.0,
          continuousCurrentA: 0.8,
          powerDrawWatts: Number((payloadPower * 0.3).toFixed(1))
        },
        performance: {
          bandwidthHz: 120,
          samplingRateHz: 1000
        },
        environmental: {
          ipRating: 'IP54',
          minOperatingTempC: -20,
          maxOperatingTempC: 50
        },
        traceableRequirementIds: ['DRONE-REQ-007', 'DRONE-REQ-010'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg, 0);

    return {
      subsystemId: 'SUB-PAYLOAD',
      name: 'Mission Payload Subsystem',
      category: 'PAYLOAD',
      description: `Inspection sensor package with 3-axis stabilized gimbal and optical/thermal sensors.`,
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: -0.08 },
      totalPowerDrawWatts: payloadPower,
      traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-007', 'DRONE-REQ-010'],
      isCritical: true
    };
  }

  // 5. LANDING GEAR SUBSYSTEM
  private static buildLandingGearSubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const isHexa = variant === 'HEXA_HEAVY_LIFT_6X';
    const isOcto = variant === 'OCTO_ENDURANCE_8X';
    const gearHeightMm = isOcto ? 280 : isHexa ? 260 : 240;
    const gearWidthMm = isOcto ? 380 : isHexa ? 340 : 310;
    const gearMass = isOcto ? 0.32 : isHexa ? 0.28 : 0.24;

    const components: ArchitectureComponent[] = [
      // 5.1 Landing Skids
      {
        componentId: 'COMP-LG-001',
        subsystemId: 'SUB-LANDING_GEAR',
        name: 'Dual Carbon Fiber Landing Skids with Rubber Dampers',
        category: 'LANDING_SKID',
        description: '2x parallel carbon fiber skid tubes (16mm OD) with silicone ground contact end caps for rough terrain landing.',
        partNumber: 'LG-SKID-16MM-PAIR',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: gearMass * 0.45,
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.16 },
          dimensions: { lengthMm: 360, widthMm: gearWidthMm, heightMm: 25 },
          materialName: '3K Carbon Fiber Tube / Silicone Rubber Boots'
        },
        performance: {
          staticLoadRatingN: 450.0,
          maxDropImpactVelocityMs: 2.5
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-020'],
        cadModelReference: 'CAD/LANDING_GEAR/SKID_ASSY.STEP',
        isCritical: true
      },
      // 5.2 Vertical Struts & Shock Absorbers
      {
        componentId: 'COMP-LG-002',
        subsystemId: 'SUB-LANDING_GEAR',
        name: '4x Cantilever Landing Struts with Elastomer Energy Absorbers',
        category: 'LANDING_STRUT',
        description: '4x splayed carbon fiber composite support struts with engineered flex joints to absorb kinetic energy during 2.0 m/s drop landings.',
        partNumber: 'LG-STRUT-FLEX-04',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: gearMass * 0.55,
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.09 },
          dimensions: { lengthMm: 180, widthMm: 160, heightMm: gearHeightMm },
          materialName: 'Composite Carbon Fiber / TPU Elastomer Dampers'
        },
        performance: {
          staticLoadRatingN: 600.0,
          maxDropImpactVelocityMs: 2.5
        },
        traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-020'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg, 0);

    return {
      subsystemId: 'SUB-LANDING_GEAR',
      name: 'Landing Gear & Ground Interface Subsystem',
      category: 'LANDING_GEAR',
      description: 'Ruggedized wide-stance carbon fiber landing gear with progressive elastomer impact damping.',
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: -0.125 },
      totalPowerDrawWatts: 0,
      traceableRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-008', 'DRONE-REQ-020'],
      isCritical: true
    };
  }

  // 6. AVIONICS SUBSYSTEM
  private static buildAvionicsSubsystem(variant: string, config: EPC016InputConfig): SubsystemDefinition {
    const components: ArchitectureComponent[] = [
      // 6.1 Flight Controller
      {
        componentId: 'COMP-AV-001',
        subsystemId: 'SUB-AVIONICS',
        name: 'Triple-Redundant Industrial Autopilot & Flight Controller Unit',
        category: 'FLIGHT_CONTROLLER',
        description: 'High-reliability STM32H7 dual-core flight controller running SECP real-time flight guidance with internal vibration damping.',
        partNumber: 'AV-FC-H7-PRO',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.075,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.01 },
          dimensions: { lengthMm: 75, widthMm: 45, heightMm: 18 },
          materialName: 'CNC Aluminum Shielded Housing / Multilayer High-TG PCB'
        },
        electrical: {
          nominalVoltageV: 5.0,
          continuousCurrentA: 1.2,
          powerDrawWatts: 6.0
        },
        performance: {
          bandwidthHz: 800,
          samplingRateHz: 8000
        },
        environmental: {
          ipRating: 'IP55',
          minOperatingTempC: -20,
          maxOperatingTempC: 70
        },
        traceableRequirementIds: ['DRONE-REQ-009', 'DRONE-REQ-013', 'DRONE-REQ-014', 'DRONE-REQ-018'],
        cadModelReference: 'CAD/AVIONICS/FLIGHT_CONTROLLER.STEP',
        isCritical: true
      },
      // 6.2 IMU Sensor Array
      {
        componentId: 'COMP-AV-002',
        subsystemId: 'SUB-AVIONICS',
        name: 'Dual Temperature-Controlled 6-DOF IMU & High-Precision Barometer',
        category: 'IMU_SENSOR',
        description: 'Heated, isolated dual IMU array (ICM-42688P + IIM-42652) with barometric altitude transducer.',
        partNumber: 'AV-IMU-DUAL-ISO',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.022,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.01 },
          dimensions: { lengthMm: 35, widthMm: 28, heightMm: 8 },
          materialName: 'Silicon MEMS / Ceramic Carrier'
        },
        electrical: {
          nominalVoltageV: 3.3,
          powerDrawWatts: 1.8
        },
        performance: {
          samplingRateHz: 8000
        },
        traceableRequirementIds: ['DRONE-REQ-009', 'DRONE-REQ-014', 'DRONE-REQ-018'],
        isCritical: true
      },
      // 6.3 GNSS / RTK Navigation
      {
        componentId: 'COMP-AV-003',
        subsystemId: 'SUB-AVIONICS',
        name: 'Dual Multi-Band RTK GNSS Receiver & Magnetometer Mast',
        category: 'GNSS_RECEIVER',
        description: 'Multi-constellation (GPS L1/L2, GLONASS, Galileo, BeiDou) RTK positioning module providing centimeter-level position accuracy.',
        partNumber: 'AV-RTK-F9P-DUAL',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.065,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.08 },
          dimensions: { lengthMm: 65, widthMm: 65, heightMm: 15 },
          materialName: 'Polycarbonate Helix Antenna / Aluminum Ground Plane'
        },
        electrical: {
          nominalVoltageV: 5.0,
          continuousCurrentA: 0.5,
          powerDrawWatts: 2.5
        },
        performance: {
          samplingRateHz: 20
        },
        environmental: {
          ipRating: 'IP55',
          minOperatingTempC: -20,
          maxOperatingTempC: 65
        },
        traceableRequirementIds: ['DRONE-REQ-009', 'DRONE-REQ-013'],
        isCritical: true
      },
      // 6.4 Communication & Long-Range Telemetry Transceiver
      {
        componentId: 'COMP-AV-004',
        subsystemId: 'SUB-AVIONICS',
        name: 'Encrypted Dual-Band 2.4/5.8GHz COFDM Telemetry & HD Video Link',
        category: 'TRANSCEIVER',
        description: 'AES-256 encrypted broadband digital link providing 15km line-of-sight command, control, and real-time telemetry.',
        partNumber: 'AV-COMM-COFDM-15KM',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.095,
          centerOfGravity: { x: 0.0, y: 0.0, z: -0.01 },
          dimensions: { lengthMm: 82, widthMm: 50, heightMm: 16 },
          materialName: 'Shielded Billet Aluminum Enclosure'
        },
        electrical: {
          nominalVoltageV: 12.0,
          continuousCurrentA: 1.0,
          powerDrawWatts: 12.0
        },
        performance: {
          bandwidthHz: 20000000
        },
        environmental: {
          ipRating: 'IP54',
          minOperatingTempC: -20,
          maxOperatingTempC: 60
        },
        traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-015'],
        isCritical: true
      },
      // 6.5 Power Distribution Board & PMU
      {
        componentId: 'COMP-AV-005',
        subsystemId: 'SUB-AVIONICS',
        name: 'Dual-Output High-Current Intelligent Power Distribution Unit',
        category: 'POWER_DISTRIBUTION_BOARD',
        description: 'Heavy copper 12S PDB with redundant 5V/12V step-down buck regulators, Hall-effect current monitoring, and solid-state emergency isolator.',
        partNumber: 'AV-PDB-12S-200A',
        revision: '1.0',
        quantity: 1,
        physical: {
          massKg: 0.082,
          centerOfGravity: { x: 0.0, y: 0.0, z: 0.005 },
          dimensions: { lengthMm: 90, widthMm: 60, heightMm: 14 },
          materialName: '4-Layer 4oz Heavy Copper FR4 PCB'
        },
        electrical: {
          nominalVoltageV: 44.4,
          continuousCurrentA: 180.0,
          peakCurrentA: 240.0,
          powerDrawWatts: 4.5
        },
        traceableRequirementIds: ['DRONE-REQ-006', 'DRONE-REQ-011', 'DRONE-REQ-016'],
        isCritical: true
      }
    ];

    const totalMass = components.reduce((sum, c) => sum + c.physical.massKg, 0);

    return {
      subsystemId: 'SUB-AVIONICS',
      name: 'Avionics, Flight Control & Navigation Subsystem',
      category: 'AVIONICS',
      description: 'Avionics suite comprising triple-redundant autopilot, RTK GNSS, telemetry transceiver, and intelligent PDU.',
      revision: '1.0',
      components,
      totalMassKg: Number(totalMass.toFixed(4)),
      centerOfGravity: { x: 0.0, y: 0.0, z: 0.015 },
      totalPowerDrawWatts: 26.8,
      traceableRequirementIds: [
        'DRONE-REQ-001',
        'DRONE-REQ-006',
        'DRONE-REQ-009',
        'DRONE-REQ-011',
        'DRONE-REQ-013',
        'DRONE-REQ-014',
        'DRONE-REQ-015',
        'DRONE-REQ-016',
        'DRONE-REQ-018'
      ],
      isCritical: true
    };
  }

  // SYSTEM INTERFACES
  private static buildSystemInterfaces(subsystems: readonly SubsystemDefinition[]): readonly SystemInterface[] {
    const interfaces: SystemInterface[] = [
      // 1. Airframe ↔ Propulsion (Mechanical / Structural load)
      {
        interfaceId: 'INT-AIR-PROP-01',
        name: 'Airframe to Motor Mount Structural Interface',
        sourceSubsystemId: 'SUB-AIRFRAME',
        sourceComponentId: 'COMP-AIR-003',
        targetSubsystemId: 'SUB-PROPULSION',
        targetComponentId: 'COMP-PROP-001',
        interfaceType: 'MECHANICAL',
        mechanical: {
          mountType: 'BOLTED_FLANGE',
          fastenerSpecification: '4x M3x10 Grade 12.9 Titanium Screws with Loctite 243',
          maxLoadCapacityN: 500.0,
          torqueLimitNm: 2.2,
          vibrationIsolation: true,
          isolationDampingRatio: 0.18
        },
        constraints: ['Max allowable motor vibration transmission < 0.5g RMS', 'Operating temperature up to 80C'],
        linkedRequirementIds: ['DRONE-REQ-003', 'DRONE-REQ-008', 'DRONE-REQ-018'],
        status: 'VERIFIED'
      },
      // 2. Airframe ↔ Battery (Mechanical / Retention)
      {
        interfaceId: 'INT-AIR-BAT-01',
        name: 'Airframe to Battery Tray Retention Interface',
        sourceSubsystemId: 'SUB-AIRFRAME',
        sourceComponentId: 'COMP-AIR-004',
        targetSubsystemId: 'SUB-BATTERY',
        targetComponentId: 'COMP-BAT-001',
        interfaceType: 'MECHANICAL',
        mechanical: {
          mountType: 'QUICK_RELEASE_RAIL',
          fastenerSpecification: 'Dual stainless steel spring-loaded index locking pins',
          maxLoadCapacityN: 400.0,
          shearCapacityN: 600.0,
          vibrationIsolation: true
        },
        constraints: ['Retention force must resist 15g crash deceleration without unlatching'],
        linkedRequirementIds: ['DRONE-REQ-005', 'DRONE-REQ-006', 'DRONE-REQ-008'],
        status: 'VERIFIED'
      },
      // 3. Airframe ↔ Payload (Mechanical / Gimbal Rail)
      {
        interfaceId: 'INT-AIR-PAY-01',
        name: 'Airframe to Payload Gimbal Vibration-Isolated Rail Interface',
        sourceSubsystemId: 'SUB-AIRFRAME',
        sourceComponentId: 'COMP-AIR-005',
        targetSubsystemId: 'SUB-PAYLOAD',
        targetComponentId: 'COMP-PAY-002',
        interfaceType: 'MECHANICAL',
        mechanical: {
          mountType: 'DAMPED_GROMMET',
          fastenerSpecification: '4x fluorosilicone silicone oil dampers with quick-detach clamp',
          maxLoadCapacityN: 180.0,
          vibrationIsolation: true,
          isolationDampingRatio: 0.28
        },
        constraints: ['Gimbal angular vibration < 0.02 deg under 40 km/h wind'],
        linkedRequirementIds: ['DRONE-REQ-007', 'DRONE-REQ-008', 'DRONE-REQ-010'],
        status: 'VERIFIED'
      },
      // 4. Airframe ↔ Landing Gear (Structural Impact)
      {
        interfaceId: 'INT-AIR-LG-01',
        name: 'Airframe to Landing Gear Hardpoint Attachment',
        sourceSubsystemId: 'SUB-AIRFRAME',
        sourceComponentId: 'COMP-AIR-006',
        targetSubsystemId: 'SUB-LANDING_GEAR',
        targetComponentId: 'COMP-LG-002',
        interfaceType: 'STRUCTURAL_LOAD',
        mechanical: {
          mountType: 'BOLTED_FLANGE',
          fastenerSpecification: '8x M3x12 Grade 10.9 Steel Screws with Nyloc nuts',
          maxLoadCapacityN: 800.0,
          shearCapacityN: 950.0
        },
        constraints: ['Must withstand 2.0 m/s hard landing impact load of 550 N without plastic deformation'],
        linkedRequirementIds: ['DRONE-REQ-008', 'DRONE-REQ-020'],
        status: 'VERIFIED'
      },
      // 5. Airframe ↔ Avionics (Mechanical / Enclosure mounting)
      {
        interfaceId: 'INT-AIR-AV-01',
        name: 'Airframe Fuselage to Avionics Deck Mounting Interface',
        sourceSubsystemId: 'SUB-AIRFRAME',
        sourceComponentId: 'COMP-AIR-001',
        targetSubsystemId: 'SUB-AVIONICS',
        targetComponentId: 'COMP-AV-001',
        interfaceType: 'MECHANICAL',
        mechanical: {
          mountType: 'DAMPED_GROMMET',
          fastenerSpecification: '4x M2.5 brass standoffs with elastomer vibration rings',
          maxLoadCapacityN: 60.0,
          vibrationIsolation: true,
          isolationDampingRatio: 0.35
        },
        constraints: ['Avionics bay vibration isolation cutoff frequency > 50 Hz'],
        linkedRequirementIds: ['DRONE-REQ-008', 'DRONE-REQ-014', 'DRONE-REQ-019'],
        status: 'VERIFIED'
      },
      // 6. Battery ↔ Propulsion (Electrical Power High-Current Bus)
      {
        interfaceId: 'INT-BAT-PROP-01',
        name: 'Battery High-Current Bus to Propulsion ESC Power Feed',
        sourceSubsystemId: 'SUB-BATTERY',
        sourceComponentId: 'COMP-BAT-001',
        targetSubsystemId: 'SUB-PROPULSION',
        targetComponentId: 'COMP-PROP-003',
        interfaceType: 'ELECTRICAL_POWER',
        electrical: {
          nominalVoltageV: 44.4,
          maxContinuousCurrentA: 120.0,
          peakCurrentA: 180.0,
          connectorType: 'AS150 Anti-Spark / XT90-S Gold Plated',
          wireGaugeAwg: 8,
          isRedundant: false
        },
        constraints: ['Voltage drop over main power harness < 0.25V at 100A draw'],
        linkedRequirementIds: ['DRONE-REQ-003', 'DRONE-REQ-006', 'DRONE-REQ-011'],
        status: 'VERIFIED'
      },
      // 7. Battery ↔ Avionics (Electrical Power Regulated Bus)
      {
        interfaceId: 'INT-BAT-AV-01',
        name: 'Battery Output to Avionics Power Distribution Unit',
        sourceSubsystemId: 'SUB-BATTERY',
        sourceComponentId: 'COMP-BAT-001',
        targetSubsystemId: 'SUB-AVIONICS',
        targetComponentId: 'COMP-AV-005',
        interfaceType: 'ELECTRICAL_POWER',
        electrical: {
          nominalVoltageV: 44.4,
          maxContinuousCurrentA: 10.0,
          connectorType: 'Molex Micro-Fit 3.0',
          wireGaugeAwg: 16,
          isRedundant: true
        },
        constraints: ['Independent redundant power feeds to flight controller with transient surge protection'],
        linkedRequirementIds: ['DRONE-REQ-006', 'DRONE-REQ-011', 'DRONE-REQ-016'],
        status: 'VERIFIED'
      },
      // 8. Battery ↔ Payload (Electrical Power Auxiliary Feed)
      {
        interfaceId: 'INT-BAT-PAY-01',
        name: 'Avionics/Battery Auxiliary DC Power Feed to Payload Gimbal',
        sourceSubsystemId: 'SUB-BATTERY',
        sourceComponentId: 'COMP-BAT-001',
        targetSubsystemId: 'SUB-PAYLOAD',
        targetComponentId: 'COMP-PAY-001',
        interfaceType: 'ELECTRICAL_POWER',
        electrical: {
          nominalVoltageV: 12.0,
          maxContinuousCurrentA: 3.5,
          connectorType: 'JST-GH 4-Pin Protected',
          wireGaugeAwg: 20
        },
        constraints: ['Regulated low-noise 12V rail with ripple < 20mV peak-to-peak'],
        linkedRequirementIds: ['DRONE-REQ-007', 'DRONE-REQ-011'],
        status: 'VERIFIED'
      },
      // 9. Avionics ↔ Propulsion (Motor Control & Telemetry Signal)
      {
        interfaceId: 'INT-AV-PROP-01',
        name: 'Autopilot to Motor ESCs DShot/CAN Control Bus',
        sourceSubsystemId: 'SUB-AVIONICS',
        sourceComponentId: 'COMP-AV-001',
        targetSubsystemId: 'SUB-PROPULSION',
        targetComponentId: 'COMP-PROP-003',
        interfaceType: 'DATA_COMMUNICATION',
        data: {
          protocol: 'DShot600 / CAN_Aerospace',
          updateRateHz: 600,
          maxLatencyMs: 1.5,
          messageTypes: ['MOTOR_THROTTLE_COMMAND', 'ESC_TELEMETRY_RPM_CURRENT_TEMP']
        },
        constraints: ['Command update jitter < 50 microseconds'],
        linkedRequirementIds: ['DRONE-REQ-003', 'DRONE-REQ-012', 'DRONE-REQ-018'],
        status: 'VERIFIED'
      },
      // 10. Avionics ↔ Sensors (High-Speed IMU Bus)
      {
        interfaceId: 'INT-AV-SENS-01',
        name: 'Autopilot MCU to Dual IMU Sensor Array SPI Bus',
        sourceSubsystemId: 'SUB-AVIONICS',
        sourceComponentId: 'COMP-AV-001',
        targetSubsystemId: 'SUB-AVIONICS',
        targetComponentId: 'COMP-AV-002',
        interfaceType: 'DATA_COMMUNICATION',
        data: {
          protocol: 'SPI_24MHz',
          updateRateHz: 8000,
          maxLatencyMs: 0.12,
          messageTypes: ['ACCEL_RAW_XYZ', 'GYRO_RAW_XYZ', 'BARO_PRESSURE_TEMP']
        },
        constraints: ['Zero packet loss under continuous maximum sampling'],
        linkedRequirementIds: ['DRONE-REQ-009', 'DRONE-REQ-014', 'DRONE-REQ-018'],
        status: 'VERIFIED'
      },
      // 11. Avionics ↔ Navigation (RTK GNSS Data Stream)
      {
        interfaceId: 'INT-AV-NAV-01',
        name: 'RTK Positioning Module to Autopilot Navigation Engine',
        sourceSubsystemId: 'SUB-AVIONICS',
        sourceComponentId: 'COMP-AV-003',
        targetSubsystemId: 'SUB-AVIONICS',
        targetComponentId: 'COMP-AV-001',
        interfaceType: 'DATA_COMMUNICATION',
        data: {
          protocol: 'UBX_Binary_HighSpeed',
          baudRateOrBandwidthBps: 460800,
          updateRateHz: 20,
          maxLatencyMs: 15.0,
          messageTypes: ['NAV_PVT', 'NAV_RELPOSNED', 'NAV_STATUS']
        },
        constraints: ['RTK fix loss detection and fallback within 100ms'],
        linkedRequirementIds: ['DRONE-REQ-009', 'DRONE-REQ-013'],
        status: 'VERIFIED'
      },
      // 12. Avionics ↔ Telemetry (Long-Range Radio Ground Link)
      {
        interfaceId: 'INT-AV-TEL-01',
        name: 'Autopilot to Ground Control Station Telemetry Link',
        sourceSubsystemId: 'SUB-AVIONICS',
        sourceComponentId: 'COMP-AV-001',
        targetSubsystemId: 'SUB-AVIONICS',
        targetComponentId: 'COMP-AV-004',
        interfaceType: 'DATA_COMMUNICATION',
        data: {
          protocol: 'MAVLink_v2_Encrypted',
          baudRateOrBandwidthBps: 115200,
          updateRateHz: 50,
          maxLatencyMs: 25.0,
          messageTypes: ['HEARTBEAT', 'ATTITUDE', 'GLOBAL_POSITION_INT', 'SYS_STATUS', 'BATTERY_STATUS']
        },
        constraints: ['RF link heartbeat timeout triggers automated RTL within 2.0s'],
        linkedRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-015'],
        status: 'VERIFIED'
      }
    ];

    return interfaces;
  }

  // SYSTEM PARAMETERS CALCULATION (RIGID BODY PHYSICS & PROPULSION/POWER BALANCE)
  private static computeSystemParameters(
    subsystems: readonly SubsystemDefinition[],
    variant: string,
    config: EPC016InputConfig
  ): SystemLevelParameters {
    const isHexa = variant === 'HEXA_HEAVY_LIFT_6X';
    const isOcto = variant === 'OCTO_ENDURANCE_8X';

    // Mass properties computation
    let totalMassKg = 0;
    let structuralMassKg = 0;
    let propulsionMassKg = 0;
    let batteryMassKg = 0;
    let payloadMassKg = 0;
    let avionicsMassKg = 0;
    let landingGearMassKg = 0;
    const harnessAndFastenersMassKg = 0.12;

    let weightedX = 0;
    let weightedY = 0;
    let weightedZ = 0;

    for (const sub of subsystems) {
      for (const comp of sub.components) {
        const compMass = comp.physical.massKg * (comp.quantity || 1);
        totalMassKg += compMass;

        // Position weighting for CG
        weightedX += compMass * comp.physical.centerOfGravity.x;
        weightedY += compMass * comp.physical.centerOfGravity.y;
        weightedZ += compMass * comp.physical.centerOfGravity.z;

        // Breakdown categorization
        if (sub.category === 'AIRFRAME') structuralMassKg += compMass;
        else if (sub.category === 'PROPULSION') propulsionMassKg += compMass;
        else if (sub.category === 'BATTERY') batteryMassKg += compMass;
        else if (sub.category === 'PAYLOAD') payloadMassKg += compMass;
        else if (sub.category === 'LANDING_GEAR') landingGearMassKg += compMass;
        else if (sub.category === 'AVIONICS') avionicsMassKg += compMass;
      }
    }

    const totalSystemMass = Number(totalMassKg.toFixed(4));
    const cg: Point3D = {
      x: Number((weightedX / totalSystemMass).toFixed(4)),
      y: Number((weightedY / totalSystemMass).toFixed(4)),
      z: Number((weightedZ / totalSystemMass).toFixed(4))
    };

    // Parallel-axis theorem for Moments of Inertia: I = sum( I_local + m * d^2 )
    let Ixx = 0;
    let Iyy = 0;
    let Izz = 0;
    let Ixy = 0;
    let Ixz = 0;
    let Iyz = 0;

    for (const sub of subsystems) {
      for (const comp of sub.components) {
        const m = comp.physical.massKg * (comp.quantity || 1);
        const dx = comp.physical.centerOfGravity.x - cg.x;
        const dy = comp.physical.centerOfGravity.y - cg.y;
        const dz = comp.physical.centerOfGravity.z - cg.z;

        // Approximation of local moment of inertia for rectangular / cylindrical elements
        const lx = comp.physical.dimensions.lengthMm / 1000;
        const ly = comp.physical.dimensions.widthMm / 1000;
        const lz = comp.physical.dimensions.heightMm / 1000;

        const iLocalX = (1 / 12) * m * (ly * ly + lz * lz);
        const iLocalY = (1 / 12) * m * (lx * lx + lz * lz);
        const iLocalZ = (1 / 12) * m * (lx * lx + ly * ly);

        Ixx += iLocalX + m * (dy * dy + dz * dz);
        Iyy += iLocalY + m * (dx * dx + dz * dz);
        Izz += iLocalZ + m * (dx * dx + dy * dy);
        Ixy += m * (dx * dy);
        Ixz += m * (dx * dz);
        Iyz += m * (dy * dz);
      }
    }

    const inertiaTensor: InertiaTensor = {
      Ixx: Number(Ixx.toFixed(5)),
      Iyy: Number(Iyy.toFixed(5)),
      Izz: Number(Izz.toFixed(5)),
      Ixy: Number(Ixy.toFixed(6)),
      Ixz: Number(Ixz.toFixed(6)),
      Iyz: Number(Iyz.toFixed(6))
    };

    // Mass Breakdown
    const massBreakdown: MassBreakdown = {
      totalMassKg: totalSystemMass,
      structuralMassKg: Number(structuralMassKg.toFixed(4)),
      propulsionMassKg: Number(propulsionMassKg.toFixed(4)),
      batteryMassKg: Number(batteryMassKg.toFixed(4)),
      payloadMassKg: Number(payloadMassKg.toFixed(4)),
      avionicsMassKg: Number(avionicsMassKg.toFixed(4)),
      landingGearMassKg: Number(landingGearMassKg.toFixed(4)),
      harnessAndFastenersMassKg,
      massMarginKg: Number(((config.performance?.maximumTakeoffMass?.value ?? 8.0) - totalSystemMass).toFixed(3)),
      massMarginPercentage: Number(
        ((((config.performance?.maximumTakeoffMass?.value ?? 8.0) - totalSystemMass) / (config.performance?.maximumTakeoffMass?.value ?? 8.0)) * 100).toFixed(1)
      )
    };

    // Propulsion & Flight Metrics
    const motorCount = isOcto ? 8 : isHexa ? 6 : 4;
    const thrustPerMotor = isOcto ? 38.0 : isHexa ? 29.0 : 42.0; // N
    const totalMaxThrustNewtons = Number((motorCount * thrustPerMotor).toFixed(2));
    const hoverThrustRequiredNewtons = Number((totalSystemMass * 9.80665).toFixed(2));
    const thrustToWeightRatio = Number((totalMaxThrustNewtons / hoverThrustRequiredNewtons).toFixed(2));
    const hoverThrottlePercentage = Number(((1 / thrustToWeightRatio) * 100).toFixed(1));

    // Power & Energy Budget
    const batterySub = subsystems.find(s => s.category === 'BATTERY');
    const batteryComp = batterySub?.components.find(c => c.category === 'BATTERY_PACK');
    const capacityAh = batteryComp?.electrical?.capacityAh || 16.0;
    const nominalVoltage = batteryComp?.electrical?.nominalVoltageV || 44.4;
    const totalEnergyCapacityWh = Number((capacityAh * nominalVoltage).toFixed(1));
    const usableEnergyWh = Number((totalEnergyCapacityWh * 0.85).toFixed(1)); // 85% DoD depth of discharge

    // Actuator power model: P_hover = (Hover_Thrust / (eta * sqrt(2*rho*A)))
    // Standard rule of thumb: ~110-140 W per kg at hover for this disc loading
    const hoverPowerWatts = Number((totalSystemMass * 122.0).toFixed(1));
    const cruisePowerWatts = Number((hoverPowerWatts * 0.88).toFixed(1)); // Translational lift reduces power at cruise speed
    const payloadPowerW = config.payload?.payloadPower?.value ?? 25;
    const avionicsAndPayloadPowerWatts = 26.8 + payloadPowerW;
    const totalHoverPowerWatts = hoverPowerWatts + avionicsAndPayloadPowerWatts;
    const totalCruisePowerWatts = cruisePowerWatts + avionicsAndPayloadPowerWatts;

    const maxContinuousPowerWatts = motorCount * 450 + avionicsAndPayloadPowerWatts;
    const peakPowerWatts = motorCount * 600 + avionicsAndPayloadPowerWatts;

    const estimatedHoverEnduranceMinutes = Number(((usableEnergyWh / totalHoverPowerWatts) * 60).toFixed(1));
    const estimatedCruiseEnduranceMinutes = Number(((usableEnergyWh / totalCruisePowerWatts) * 60).toFixed(1));

    const powerBudget: PowerAndEnergyBudget = {
      totalEnergyCapacityWh,
      usableEnergyWh,
      batteryNominalVoltageV: nominalVoltage,
      batteryCapacityAh: capacityAh,
      maxContinuousPowerWatts: Number(maxContinuousPowerWatts.toFixed(1)),
      peakPowerWatts: Number(peakPowerWatts.toFixed(1)),
      hoverPowerWatts: Number(totalHoverPowerWatts.toFixed(1)),
      cruisePowerWatts: Number(totalCruisePowerWatts.toFixed(1)),
      avionicsAndPayloadPowerWatts: Number(avionicsAndPayloadPowerWatts.toFixed(1))
    };

    const flightMetrics: PropulsionFlightMetrics = {
      motorCount,
      maxThrustPerMotorNewtons: thrustPerMotor,
      totalMaxThrustNewtons,
      hoverThrustRequiredNewtons,
      thrustToWeightRatio,
      hoverThrottlePercentage,
      estimatedHoverEnduranceMinutes,
      estimatedCruiseEnduranceMinutes,
      maximumClimbRateMs: 6.0,
      maximumForwardSpeedMs: config.performance?.maximumSpeed?.value ?? 20.0
    };

    const operatingEnvelope: OperatingEnvelope = {
      maxTakeoffMassKg: config.performance?.maximumTakeoffMass?.value ?? 8.0,
      maxPayloadCapacityKg: (config.payload?.payloadMass?.value ?? 1.2) * 1.5,
      serviceCeilingAltitudeMeters: config.performance?.maximumAltitude?.value ?? 2000,
      maxWindResistanceMs: config.performance?.maximumWindSpeed?.value ?? 10.0,
      operatingTempRangeC: {
        min: config.environment?.temperatureRange?.min ?? -10,
        max: config.environment?.temperatureRange?.max ?? 45
      },
      ingressProtectionRating: config.environment?.dustExposure ?? 'IP54'
    };

    return {
      massBreakdown,
      centerOfGravity: cg,
      inertiaTensor,
      powerBudget,
      flightMetrics,
      operatingEnvelope
    };
  }

  // REQUIREMENT TRACEABILITY LINKS
  private static buildRequirementLinks(
    subsystems: readonly SubsystemDefinition[],
    interfaces: readonly SystemInterface[]
  ): readonly ArchitectureRequirementLink[] {
    const links: ArchitectureRequirementLink[] = [
      {
        requirementId: 'DRONE-REQ-001',
        subsystemId: 'SUB-AVIONICS',
        componentIds: ['COMP-AV-004'],
        interfaceIds: ['INT-AV-TEL-01'],
        satisfactionRationale: 'COFDM long-range encrypted transceiver provides 15km line-of-sight communications covering the required mission radius.',
        verificationMethod: 'SIMULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-002',
        subsystemId: 'SUB-BATTERY',
        componentIds: ['COMP-BAT-001', 'COMP-PROP-001', 'COMP-PROP-002'],
        satisfactionRationale: '12S High energy density battery pack combined with large high-aspect-ratio propellers achieves hover endurance meeting flight time requirement.',
        verificationMethod: 'CALCULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-003',
        subsystemId: 'SUB-PROPULSION',
        componentIds: ['COMP-PROP-001', 'COMP-PROP-002', 'COMP-PROP-003'],
        interfaceIds: ['INT-BAT-PROP-01', 'INT-AV-PROP-01'],
        satisfactionRationale: 'High-power BLDC motors and ESCs deliver cruise and maximum airspeed exceeding requirements.',
        verificationMethod: 'SIMULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-004',
        subsystemId: 'SUB-PROPULSION',
        componentIds: ['COMP-PROP-001', 'COMP-PROP-002'],
        interfaceIds: ['INT-AIR-PROP-01'],
        satisfactionRationale: 'Combined motor thrust delivers a thrust-to-weight ratio >= 2.0 ensuring agile climb and high wind resistance.',
        verificationMethod: 'ANALYSIS',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-005',
        subsystemId: 'SUB-AIRFRAME',
        componentIds: ['COMP-AIR-001', 'COMP-AIR-002', 'COMP-AIR-003', 'COMP-BAT-001', 'COMP-PAY-001', 'COMP-LG-001'],
        satisfactionRationale: 'Strict carbon composite and titanium lightweighting keeps total mass below maximum takeoff mass limit.',
        verificationMethod: 'MEASUREMENT',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-006',
        subsystemId: 'SUB-BATTERY',
        componentIds: ['COMP-BAT-001', 'COMP-BAT-002', 'COMP-AV-005'],
        interfaceIds: ['INT-BAT-PROP-01', 'INT-BAT-AV-01'],
        satisfactionRationale: '12S nominal 44.4V battery pack delivers required DC bus voltage within tolerance.',
        verificationMethod: 'MEASUREMENT',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-007',
        subsystemId: 'SUB-PAYLOAD',
        componentIds: ['COMP-PAY-001', 'COMP-PAY-002'],
        interfaceIds: ['INT-AIR-PAY-01', 'INT-BAT-PAY-01'],
        satisfactionRationale: 'Universal payload mount accommodates required payload mass and 3-axis stabilization.',
        verificationMethod: 'INSPECTION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-008',
        subsystemId: 'SUB-AIRFRAME',
        componentIds: ['COMP-AIR-001', 'COMP-AIR-002', 'COMP-LG-002'],
        interfaceIds: ['INT-AIR-PROP-01', 'INT-AIR-LG-01'],
        satisfactionRationale: 'Airframe FEA verified with safety factor > 2.0 under maximum aerodynamic and drop landing load cases.',
        verificationMethod: 'ANALYSIS',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-009',
        subsystemId: 'SUB-AVIONICS',
        componentIds: ['COMP-AV-001', 'COMP-AV-002', 'COMP-AV-003'],
        interfaceIds: ['INT-AV-NAV-01', 'INT-AV-SENS-01'],
        satisfactionRationale: 'Multi-band RTK GNSS coupled with dual temperature-stabilized IMUs achieves centimeter hover accuracy.',
        verificationMethod: 'SIMULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-010',
        subsystemId: 'SUB-AIRFRAME',
        componentIds: ['COMP-AIR-001', 'COMP-PAY-001', 'COMP-AV-001'],
        satisfactionRationale: 'Sealed carbon fiber enclosure with perimeter O-rings achieves IP54 ingress protection rating.',
        verificationMethod: 'TEST',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-013',
        subsystemId: 'SUB-AVIONICS',
        componentIds: ['COMP-AV-001', 'COMP-AV-003'],
        interfaceIds: ['INT-AV-NAV-01'],
        satisfactionRationale: 'RTK positioning engine delivers horizontal position accuracy within +/- 0.05m.',
        verificationMethod: 'TEST',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-014',
        subsystemId: 'SUB-AVIONICS',
        componentIds: ['COMP-AV-001', 'COMP-AV-002'],
        interfaceIds: ['INT-AV-SENS-01'],
        satisfactionRationale: 'Extended Kalman Filter fusing dual 8kHz IMUs achieves attitude estimation accuracy within +/- 0.5 degrees.',
        verificationMethod: 'SIMULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-018',
        subsystemId: 'SUB-AVIONICS',
        componentIds: ['COMP-AV-001', 'COMP-AIR-002', 'COMP-PROP-003'],
        interfaceIds: ['INT-AV-PROP-01'],
        satisfactionRationale: '800Hz inner attitude loop with 600Hz DShot ESC update rate provides control bandwidth exceeding 20 Hz.',
        verificationMethod: 'SIMULATION',
        status: 'LINKED'
      },
      {
        requirementId: 'DRONE-REQ-020',
        subsystemId: 'SUB-LANDING_GEAR',
        componentIds: ['COMP-LG-001', 'COMP-LG-002'],
        interfaceIds: ['INT-AIR-LG-01'],
        satisfactionRationale: 'Elastomer damped cantilever carbon landing gear absorbs vertical drop velocity of 2.0 m/s.',
        verificationMethod: 'TEST',
        status: 'LINKED'
      }
    ];

    return links;
  }
}
