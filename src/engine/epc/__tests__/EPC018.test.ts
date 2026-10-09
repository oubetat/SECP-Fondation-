/**
 * SECP Industrial OS — EPC-018: Product Architecture Test Suite
 * Validates Product Architecture, Subsystem Hierarchy, Interfaces, Mass/Inertia Derivations,
 * Multi-Variant Config, Digital Thread, and Cross-Domain Reusability.
 */

import { describe, expect, it } from 'vitest';
import { EPC018Verifier } from '../architecture/EPC018Verifier';
import { IndustrialDroneProductArchitecture } from '../architecture/IndustrialDroneProductArchitecture';
import { ProductArchitectureManager } from '../architecture/ProductArchitectureManager';
import { ProductArchitectureValidator } from '../architecture/ProductArchitectureValidator';
import { ProductArchitectureSerializer } from '../architecture/ProductArchitectureSerializer';
import { ArchitectureTraceabilityBridge } from '../architecture/ArchitectureTraceabilityBridge';
import { ProductArchitecture, ProductArchitectureValidationError } from '../architecture/ProductArchitectureTypes';
import { IndustrialDroneProofCase } from '../mission/IndustrialDroneProofCase';

describe('SECP EPC-018 — Product Architecture Test Suite', () => {
  // Test 1: Full Automated EPC-018 Verifier
  it('should run EPC018Verifier and achieve PASS verdict for Industrial Drone', () => {
    const result = EPC018Verifier.runVerification();

    expect(result.epc).toBe('EPC-018');
    expect(result.verdict).toBe('PASS');
    expect(result.summary.passedChecks).toBeGreaterThanOrEqual(12);
    expect(result.summary.failedChecks).toBe(0);
    expect(result.summary.subsystemCount).toBe(6);
    expect(result.summary.componentCount).toBeGreaterThanOrEqual(15);
    expect(result.summary.interfaceCount).toBeGreaterThanOrEqual(10);
    expect(result.summary.thrustToWeightRatio).toBeGreaterThanOrEqual(1.5);
    expect(result.summary.hoverEnduranceMinutes).toBeGreaterThanOrEqual(20);
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64); // SHA-256 length
  });

  // Test 2: Core Subsystems Verification
  it('should synthesize all 6 mandatory subsystems with correct categories', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    expect(arch.subsystems.length).toBe(6);
    const categories = arch.subsystems.map(s => s.category);

    expect(categories).toContain('AIRFRAME');
    expect(categories).toContain('PROPULSION');
    expect(categories).toContain('BATTERY');
    expect(categories).toContain('PAYLOAD');
    expect(categories).toContain('LANDING_GEAR');
    expect(categories).toContain('AVIONICS');
  });

  // Test 3: Subsystem Hierarchy and Component Details
  it('should contain detailed components in each subsystem with valid physical properties', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    const airframe = arch.subsystems.find(s => s.category === 'AIRFRAME')!;
    expect(airframe.components.length).toBeGreaterThanOrEqual(5);
    expect(airframe.components.some(c => c.category === 'FUSELAGE')).toBe(true);
    expect(airframe.components.some(c => c.category === 'ARM')).toBe(true);
    expect(airframe.components.some(c => c.category === 'MOTOR_MOUNT')).toBe(true);
    expect(airframe.components.some(c => c.category === 'BATTERY_MOUNT')).toBe(true);
    expect(airframe.components.some(c => c.category === 'PAYLOAD_MOUNT')).toBe(true);

    const propulsion = arch.subsystems.find(s => s.category === 'PROPULSION')!;
    expect(propulsion.components.some(c => c.category === 'MOTOR')).toBe(true);
    expect(propulsion.components.some(c => c.category === 'PROPELLER')).toBe(true);
    expect(propulsion.components.some(c => c.category === 'ESC')).toBe(true);

    const battery = arch.subsystems.find(s => s.category === 'BATTERY')!;
    expect(battery.components.some(c => c.category === 'BATTERY_PACK')).toBe(true);
    expect(battery.components.some(c => c.category === 'BMS')).toBe(true);

    const payload = arch.subsystems.find(s => s.category === 'PAYLOAD')!;
    expect(payload.components.some(c => c.category === 'PAYLOAD_SENSOR')).toBe(true);
    expect(payload.components.some(c => c.category === 'GIMBAL')).toBe(true);

    const landingGear = arch.subsystems.find(s => s.category === 'LANDING_GEAR')!;
    expect(landingGear.components.some(c => c.category === 'LANDING_SKID')).toBe(true);
    expect(landingGear.components.some(c => c.category === 'LANDING_STRUT')).toBe(true);

    const avionics = arch.subsystems.find(s => s.category === 'AVIONICS')!;
    expect(avionics.components.some(c => c.category === 'FLIGHT_CONTROLLER')).toBe(true);
    expect(avionics.components.some(c => c.category === 'IMU_SENSOR')).toBe(true);
    expect(avionics.components.some(c => c.category === 'GNSS_RECEIVER')).toBe(true);
    expect(avionics.components.some(c => c.category === 'TRANSCEIVER')).toBe(true);
    expect(avionics.components.some(c => c.category === 'POWER_DISTRIBUTION_BOARD')).toBe(true);
  });

  // Test 4: Interface Graph Completeness
  it('should define explicit inter-subsystem interfaces with mechanical, electrical, and data specs', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();
    const ifaces = arch.interfaces;

    expect(ifaces.length).toBeGreaterThanOrEqual(12);

    // Check Mechanical interface Airframe ↔ Propulsion
    const airProp = ifaces.find(i => i.interfaceId === 'INT-AIR-PROP-01')!;
    expect(airProp).toBeDefined();
    expect(airProp.interfaceType).toBe('MECHANICAL');
    expect(airProp.mechanical?.mountType).toBe('BOLTED_FLANGE');
    expect(airProp.mechanical?.vibrationIsolation).toBe(true);

    // Check Electrical Power interface Battery ↔ Propulsion
    const batProp = ifaces.find(i => i.interfaceId === 'INT-BAT-PROP-01')!;
    expect(batProp).toBeDefined();
    expect(batProp.interfaceType).toBe('ELECTRICAL_POWER');
    expect(batProp.electrical?.nominalVoltageV).toBe(44.4);
    expect(batProp.electrical?.maxContinuousCurrentA).toBeGreaterThanOrEqual(100);

    // Check Data interface Avionics ↔ Propulsion
    const avProp = ifaces.find(i => i.interfaceId === 'INT-AV-PROP-01')!;
    expect(avProp).toBeDefined();
    expect(avProp.interfaceType).toBe('DATA_COMMUNICATION');
    expect(avProp.data?.protocol).toContain('DShot');
    expect(avProp.data?.updateRateHz).toBeGreaterThanOrEqual(400);

    // Check Data interface Avionics ↔ Telemetry
    const avTel = ifaces.find(i => i.interfaceId === 'INT-AV-TEL-01')!;
    expect(avTel).toBeDefined();
    expect(avTel.data?.protocol).toContain('MAVLink');
  });

  // Test 5: Mass Conservation and Center of Gravity Computation
  it('should strictly conserve mass and calculate 3D center of gravity', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    let expectedMass = 0;
    for (const sub of arch.subsystems) {
      for (const comp of sub.components) {
        expectedMass += comp.physical.massKg * (comp.quantity || 1);
      }
    }

    const { massBreakdown, centerOfGravity, inertiaTensor } = arch.systemParameters;

    expect(Math.abs(massBreakdown.totalMassKg - expectedMass)).toBeLessThan(0.001);
    expect(massBreakdown.structuralMassKg).toBeGreaterThan(0);
    expect(massBreakdown.propulsionMassKg).toBeGreaterThan(0);
    expect(massBreakdown.batteryMassKg).toBeGreaterThan(0);
    expect(massBreakdown.payloadMassKg).toBeGreaterThan(0);

    // Center of gravity must be centered horizontally and slightly below deck
    expect(Math.abs(centerOfGravity.x)).toBeLessThan(0.01);
    expect(Math.abs(centerOfGravity.y)).toBeLessThan(0.01);
    expect(centerOfGravity.z).toBeDefined();

    // Moments of inertia must be strictly positive
    expect(inertiaTensor.Ixx).toBeGreaterThan(0);
    expect(inertiaTensor.Iyy).toBeGreaterThan(0);
    expect(inertiaTensor.Izz).toBeGreaterThan(0);
  });

  // Test 6: Flight Dynamics and Energy Viability
  it('should derive propulsion thrust, hover power, TWR, and endurance from component specs', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();
    const { flightMetrics, powerBudget, massBreakdown } = arch.systemParameters;

    const expectedWeightN = massBreakdown.totalMassKg * 9.80665;
    expect(Math.abs(flightMetrics.hoverThrustRequiredNewtons - expectedWeightN)).toBeLessThan(0.5);

    expect(flightMetrics.thrustToWeightRatio).toBeGreaterThanOrEqual(1.8);
    expect(flightMetrics.estimatedHoverEnduranceMinutes).toBeGreaterThan(20);
    expect(powerBudget.totalEnergyCapacityWh).toBeGreaterThanOrEqual(600);
    expect(powerBudget.hoverPowerWatts).toBeGreaterThan(0);
  });

  // Test 7: Multi-Variant Configuration (4X vs 6X vs 8X)
  it('should support multi-variant configurations and calculate accurate variant diffs', () => {
    const manager = new ProductArchitectureManager();

    const quadArch = manager.registerArchitecture(
      IndustrialDroneProductArchitecture.createDroneArchitecture({ variant: 'QUAD_INSPECTION_4X' })
    );
    const hexaArch = manager.registerArchitecture(
      IndustrialDroneProductArchitecture.createDroneArchitecture({ variant: 'HEXA_HEAVY_LIFT_6X' })
    );
    const octoArch = manager.registerArchitecture(
      IndustrialDroneProductArchitecture.createDroneArchitecture({ variant: 'OCTO_ENDURANCE_8X' })
    );

    const quadMotors = quadArch.subsystems.find(s => s.category === 'PROPULSION')!.components.find(c => c.category === 'MOTOR')!.quantity;
    const hexaMotors = hexaArch.subsystems.find(s => s.category === 'PROPULSION')!.components.find(c => c.category === 'MOTOR')!.quantity;
    const octoMotors = octoArch.subsystems.find(s => s.category === 'PROPULSION')!.components.find(c => c.category === 'MOTOR')!.quantity;

    expect(quadMotors).toBe(4);
    expect(hexaMotors).toBe(6);
    expect(octoMotors).toBe(8);

    // Compare Quad vs Hexa
    const diff = manager.compareArchitectures(quadArch.architectureId, hexaArch.architectureId);
    expect(diff.massDeltaKg).toBeGreaterThan(0);
    expect(diff.modifiedComponents.length).toBeGreaterThan(0);
  });

  // Test 8: Immutable Revision Management and Impact Analysis
  it('should update component, generate new revision, and produce multidisciplinary impact report', () => {
    const manager = new ProductArchitectureManager();
    const initialArch = manager.registerArchitecture(
      IndustrialDroneProductArchitecture.createDroneArchitecture({ revisionCode: '1.0' })
    );

    const { updatedArchitecture, impact } = manager.updateComponent(
      initialArch.architectureId,
      'COMP-AIR-001',
      { massKg: 0.50 },
      'Reinforced central fuselage deck plate',
      'Lead Airframe Engineer'
    );

    expect(updatedArchitecture.revision).toBe('1.1');
    expect(updatedArchitecture.architectureId).not.toBe(initialArch.architectureId);
    expect(updatedArchitecture.systemParameters.massBreakdown.totalMassKg).toBeGreaterThan(
      initialArch.systemParameters.massBreakdown.totalMassKg
    );

    expect(impact.targetComponentId).toBe('COMP-AIR-001');
    expect(impact.affectedSubsystems).toContain('SUB-AIRFRAME');
    expect(impact.massImpactKg).toBeCloseTo(0.08, 2);
    expect(impact.affectedRequirements).toContain('DRONE-REQ-005');

    // Check revision history contains both revisions
    const history = manager.getRevisionsForProduct(initialArch.productId);
    expect(history.length).toBe(2);
    expect(history[0].revision).toBe('1.0');
    expect(history[1].revision).toBe('1.1');
  });

  // Test 9: Digital Thread Graph and BOM Export
  it('should generate connected Digital Thread graph and BOM representation', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    const thread = ArchitectureTraceabilityBridge.buildDigitalThreadGraph(arch);
    expect(thread.nodes.length).toBeGreaterThanOrEqual(30);
    expect(thread.traceabilityCoveragePercentage).toBe(100);

    const productNode = thread.nodes.find(n => n.nodeType === 'PRODUCT')!;
    expect(productNode).toBeDefined();
    expect(productNode.referenceId).toBe(arch.productId);

    const bom = ArchitectureTraceabilityBridge.exportToBOM(arch);
    expect(bom.items.length).toBeGreaterThanOrEqual(15);
    expect(bom.assemblyId).toContain(arch.productId);

    const traceGraph = ArchitectureTraceabilityBridge.exportToTraceabilityGraph(arch);
    expect(traceGraph.nodes.length).toBeGreaterThan(20);
    expect(traceGraph.edges.length).toBeGreaterThan(20);
  });

  // Test 10: Serialization & Deserialization
  it('should serialize to JSON/JSON-LD and deserialize without loss', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    const json = ProductArchitectureSerializer.toJSON(arch);
    expect(json).toBeDefined();

    const deserialized = ProductArchitectureSerializer.fromJSON(json);
    expect(deserialized.architectureId).toBe(arch.architectureId);
    expect(deserialized.subsystems.length).toBe(arch.subsystems.length);
    expect(deserialized.interfaces.length).toBe(arch.interfaces.length);
    expect(deserialized.systemParameters.massBreakdown.totalMassKg).toBe(arch.systemParameters.massBreakdown.totalMassKg);

    const jsonld = ProductArchitectureSerializer.toJSONLD(arch);
    expect(jsonld['@type']).toBe('ProductArchitecture');
    expect(jsonld['@id']).toBe(`urn:secp:architecture:${arch.architectureId}`);
  });

  // Test 11: Validation Error Handling
  it('should reject invalid architectures (missing required subsystem, negative mass, orphan interface)', () => {
    const arch = IndustrialDroneProductArchitecture.createDroneArchitecture();

    // 1. Missing mandatory subsystem
    const missingSubArch: ProductArchitecture = {
      ...arch,
      subsystems: arch.subsystems.filter(s => s.category !== 'BATTERY')
    };
    expect(() => ProductArchitectureValidator.validateArchitecture(missingSubArch)).toThrow(
      /missing mandatory subsystem category: BATTERY/
    );

    // 2. Negative mass
    const badMassArch: ProductArchitecture = {
      ...arch,
      subsystems: arch.subsystems.map(s =>
        s.category === 'AIRFRAME'
          ? {
              ...s,
              components: s.components.map(c => (c.componentId === 'COMP-AIR-001' ? { ...c, physical: { ...c.physical, massKg: -1 } } : c))
            }
          : s
      )
    };
    expect(() => ProductArchitectureValidator.validateArchitecture(badMassArch)).toThrow(/mass cannot be negative/);

    // 3. Orphan Interface
    const orphanIfaceArch: ProductArchitecture = {
      ...arch,
      interfaces: [
        ...arch.interfaces,
        {
          interfaceId: 'INT-ORPHAN-01',
          name: 'Non-existent Interface',
          sourceSubsystemId: 'SUB-NON-EXISTENT',
          sourceComponentId: 'COMP-NON-EXISTENT',
          targetSubsystemId: 'SUB-PROPULSION',
          targetComponentId: 'COMP-PROP-001',
          interfaceType: 'MECHANICAL',
          constraints: [],
          linkedRequirementIds: [],
          status: 'SPECIFIED'
        }
      ]
    };
    expect(() => ProductArchitectureValidator.validateArchitecture(orphanIfaceArch)).toThrow(
      /references non-existent source subsystem/
    );
  });

  // Test 12: Domain Neutrality (Electro-Hydraulic Actuator System)
  it('should model non-drone engineering machines (Electro-Hydraulic Actuator) seamlessly', () => {
    const hydraulicArch: ProductArchitecture = {
      architectureId: 'ARCH-HYD-ACT-01',
      productId: 'PROD-HYD-ACT-01',
      productName: 'High-Pressure Electro-Hydraulic Linear Actuator',
      productType: 'HYDRAULIC_ACTUATOR',
      revision: '1.0',
      variantCode: 'STROKE_500MM',
      variantName: '500mm Stroke Industrial Linear Actuator',
      description: 'Electro-hydraulic servo actuator for industrial presses and test rigs.',
      subsystems: [
        {
          subsystemId: 'SUB-HYD_CYLINDER',
          name: 'Hydraulic Cylinder Subsystem',
          category: 'HYDRAULIC',
          description: 'Double-acting heavy duty cylinder.',
          revision: '1.0',
          components: [
            {
              componentId: 'COMP-CYL-01',
              subsystemId: 'SUB-HYD_CYLINDER',
              name: 'Honed Steel Barrel & Chrome Plated Rod',
              category: 'ACTUATOR',
              description: '100mm bore, 500mm stroke cylinder barrel.',
              partNumber: 'HYD-CYL-100-500',
              revision: '1.0',
              quantity: 1,
              physical: {
                massKg: 32.0,
                centerOfGravity: { x: 0, y: 0, z: 0.25 },
                dimensions: { lengthMm: 750, widthMm: 140, heightMm: 140 },
                materialName: 'St52 Honed Steel'
              },
              performance: { staticLoadRatingN: 150000 },
              isCritical: true,
              traceableRequirementIds: ['HYD-REQ-001']
            }
          ],
          totalMassKg: 32.0,
          centerOfGravity: { x: 0, y: 0, z: 0.25 },
          totalPowerDrawWatts: 0,
          traceableRequirementIds: ['HYD-REQ-001'],
          isCritical: true
        },
        {
          subsystemId: 'SUB-SERVO_VALVE',
          name: 'Proportional Servo Valve Subsystem',
          category: 'CONTROL_SYSTEM',
          description: 'Direct drive proportional directional valve.',
          revision: '1.0',
          components: [
            {
              componentId: 'COMP-VALVE-01',
              subsystemId: 'SUB-SERVO_VALVE',
              name: '4/3 High Response Proportional Valve',
              category: 'VALVE',
              description: 'Integrated electronics (OBE) servo valve.',
              partNumber: 'VALVE-PROP-40LPM',
              revision: '1.0',
              quantity: 1,
              physical: {
                massKg: 2.8,
                centerOfGravity: { x: 0.05, y: 0, z: 0.1 },
                dimensions: { lengthMm: 180, widthMm: 80, heightMm: 110 }
              },
              electrical: { nominalVoltageV: 24.0, powerDrawWatts: 35.0 },
              performance: { bandwidthHz: 75 },
              isCritical: true,
              traceableRequirementIds: ['HYD-REQ-002']
            }
          ],
          totalMassKg: 2.8,
          centerOfGravity: { x: 0.05, y: 0, z: 0.1 },
          totalPowerDrawWatts: 35.0,
          traceableRequirementIds: ['HYD-REQ-002'],
          isCritical: true
        }
      ],
      interfaces: [
        {
          interfaceId: 'INT-CYL-VALVE-01',
          name: 'Subplate Manifold to Cylinder Port Interface',
          sourceSubsystemId: 'SUB-SERVO_VALVE',
          sourceComponentId: 'COMP-VALVE-01',
          targetSubsystemId: 'SUB-HYD_CYLINDER',
          targetComponentId: 'COMP-CYL-01',
          interfaceType: 'HYDRAULIC_FLUID',
          constraints: ['Max working pressure 315 bar', 'Leakage < 0.1 ml/min'],
          linkedRequirementIds: ['HYD-REQ-001', 'HYD-REQ-002'],
          status: 'VERIFIED'
        }
      ],
      systemParameters: {
        massBreakdown: {
          totalMassKg: 34.8,
          structuralMassKg: 32.0,
          propulsionMassKg: 0,
          batteryMassKg: 0,
          payloadMassKg: 0,
          avionicsMassKg: 2.8,
          landingGearMassKg: 0,
          harnessAndFastenersMassKg: 0,
          massMarginKg: 5.2,
          massMarginPercentage: 13.0
        },
        centerOfGravity: { x: 0.004, y: 0, z: 0.238 },
        inertiaTensor: { Ixx: 1.5, Iyy: 1.5, Izz: 0.12, Ixy: 0, Ixz: 0, Iyz: 0 },
        powerBudget: {
          totalEnergyCapacityWh: 0,
          usableEnergyWh: 0,
          batteryNominalVoltageV: 24,
          batteryCapacityAh: 0,
          maxContinuousPowerWatts: 35,
          peakPowerWatts: 60,
          hoverPowerWatts: 0,
          cruisePowerWatts: 0,
          avionicsAndPayloadPowerWatts: 35
        },
        flightMetrics: {
          motorCount: 0,
          maxThrustPerMotorNewtons: 0,
          totalMaxThrustNewtons: 150000,
          hoverThrustRequiredNewtons: 341.27,
          thrustToWeightRatio: 1.0,
          hoverThrottlePercentage: 100,
          estimatedHoverEnduranceMinutes: 0,
          estimatedCruiseEnduranceMinutes: 0,
          maximumClimbRateMs: 0,
          maximumForwardSpeedMs: 0.5
        },
        operatingEnvelope: {
          maxTakeoffMassKg: 40.0,
          maxPayloadCapacityKg: 15000.0,
          serviceCeilingAltitudeMeters: 3000,
          maxWindResistanceMs: 0,
          operatingTempRangeC: { min: -10, max: 70 },
          ingressProtectionRating: 'IP67'
        }
      },
      requirementLinks: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: 'Hydraulics Core',
        configurationId: 'CFG-HYD-500MM',
        domain: 'FLUID_POWER_SYSTEMS'
      }
    };

    const validated = ProductArchitectureValidator.validateArchitecture(hydraulicArch);
    expect(validated.architectureId).toBe('ARCH-HYD-ACT-01');
    expect(validated.subsystems.length).toBe(2);
    expect(validated.interfaces[0].interfaceType).toBe('HYDRAULIC_FLUID');

    const thread = ArchitectureTraceabilityBridge.buildDigitalThreadGraph(validated);
    expect(thread.nodes.length).toBeGreaterThanOrEqual(6);
  });
});
