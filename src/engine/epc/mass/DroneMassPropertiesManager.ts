/**
 * SECP Industrial OS — EPC-022: Industrial Drone Mass Properties Manager
 * Calculates real physics-based mass properties (Mass, Center of Gravity, Inertia Tensor)
 * for the Industrial Drone across Part, Subassembly, and Complete Assembly levels,
 * integrating CAD Geometry, Material Registry, Assembly Transforms, and Product Configurations.
 *
 * STRICT NO-GO RULE: Does not build a Drone-specific mass properties engine. Reuses SECP core
 * MassPropertiesCalculator, MaterialRegistry, UnitEngine, and DroneAssemblyManager.
 */

import {
  MassProperties,
  SolidGeometrySpec,
  Vector3D,
  Transform3D,
  MassPropertiesUnits,
  AnalyticalValidationReport
} from '../../physics/mass/MassPropertiesTypes';
import { MassPropertiesCalculator } from '../../physics/mass/MassPropertiesCalculator';
import { MassPropertiesUnitConverter } from '../../physics/mass/MassPropertiesUnitConverter';
import { MaterialRegistry } from '../../materials/MaterialRegistry';
import { DroneAssemblyManager } from '../assembly/DroneAssemblyManager';
import { ProductConfigurationManager } from '../ProductConfigurationManager';

export interface DroneComponentMassSpec {
  instanceId: string;
  partNumber: string;
  name: string;
  subassemblyId: 'AIRFRAME' | 'PROPULSION' | 'LANDING' | 'BATTERY' | 'PAYLOAD' | 'AVIONICS';
  geometrySpec: SolidGeometrySpec;
  materialId: string;
  materialName: string;
  densityKgM3: number;
  transform: Transform3D;
  isSuppressed?: boolean;
}

export type DroneConfigurationMode = 'EMPTY_DRONE' | 'OPERATIONAL_DRONE' | 'MAX_PAYLOAD_DRONE';

export interface InvalidationLogRecord {
  invalidationId: string;
  timestamp: string;
  reason: string;
  targetInstanceId?: string;
  previousRevision: string;
  newRevision: string;
  previousMassKg: number;
  newMassKg: number;
}

export class DroneMassPropertiesManager {
  public readonly assemblyId = 'EPC-016-DRONE-ASSEMBLY';
  public readonly productName = 'Industrial Drone';
  public readonly revision = 'REV-A';

  private assemblyManager: DroneAssemblyManager;
  private components = new Map<string, DroneComponentMassSpec>();
  private calculatedPartProps = new Map<string, MassProperties>();
  private invalidationLogs: InvalidationLogRecord[] = [];
  private recalculationCount = 0;

  constructor(assemblyManager?: DroneAssemblyManager) {
    this.assemblyManager = assemblyManager || new DroneAssemblyManager();
    this.seedMaterialRegistry();
    this.initializeDroneComponents();
    this.evaluateAllPartMassProperties();
  }

  // =========================================================================
  // 1. MATERIAL REGISTRY & DRONE COMPONENT GEOMETRY SPECIFICATION
  // =========================================================================

  private seedMaterialRegistry(): void {
    const materials = [
      { id: 'MAT-CFRP-001', name: 'T700 Carbon Fiber Composite', family: 'COMPOSITES', density: 1600 },
      { id: 'MAT-AL-7075-T6', name: 'Aluminum 7075-T6', family: 'METALS', density: 2810 },
      { id: 'MAT-COPPER-STEEL', name: 'Copper & Steel Motor Core', family: 'ELECTROMECHANICAL', density: 3197 },
      { id: 'MAT-LIPO-PACK', name: 'High-Density LiPo Battery Pack', family: 'ENERGY', density: 1800 },
      { id: 'MAT-OPTICS-AL', name: 'LiDAR Sensor Optics Assembly', family: 'OPTICS', density: 705.46 },
      { id: 'MAT-FR4-PCB', name: 'FR4 Glass-Epoxy Avionics PCB', family: 'ELECTRONICS', density: 1093.75 }
    ];

    for (const mat of materials) {
      MaterialRegistry.register(
        {
          materialId: mat.id,
          canonicalName: mat.name,
          family: mat.family,
          subfamily: 'STRUCTURAL',
          grade: 'GRADE-A',
          revision: 'REV-A'
        },
        [
          {
            propertyName: 'DENSITY',
            value: mat.density,
            unit: 'kg/m³',
            state: 'NOMINAL',
            confidence: 0.99
          }
        ],
        'QUALIFIED'
      );
    }
  }

  private initializeDroneComponents(): void {
    const specs: DroneComponentMassSpec[] = [
      // AIRFRAME SUBASSEMBLY
      {
        instanceId: 'INST-AIRFRAME-001',
        partNumber: 'AIRFRAME-001',
        name: 'Airframe Center Plate Assembly',
        subassemblyId: 'AIRFRAME',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.3, dy: 0.3, dz: 0.004 }, // 300x300x4 mm -> Volume = 0.00036 m3 -> Mass = 0.576 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'AIRFRAME-GEO-HASH-001',
          name: 'Airframe Center Plate'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      },

      // PROPULSION SUBASSEMBLY — 4 Carbon Radial Arms
      {
        instanceId: 'INST-ARM-001',
        partNumber: 'ARM-001',
        name: 'Radial Arm Carbon Tube #1 (Front Right)',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'HOLLOW_CYLINDER',
          dimensions: { radius: 0.015, innerRadius: 0.013, height: 0.45 }, // Vol = 0.00007917 m3 -> Mass = 0.1266 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'ARM-GEO-HASH-001',
          name: 'Radial Arm Tube #1'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0.225, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      },
      {
        instanceId: 'INST-ARM-002',
        partNumber: 'ARM-001',
        name: 'Radial Arm Carbon Tube #2 (Front Left)',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'HOLLOW_CYLINDER',
          dimensions: { radius: 0.015, innerRadius: 0.013, height: 0.45 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'ARM-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: 0.225, z: 0 }, rotation: { x: 0, y: 0, z: Math.PI / 2 } }
      },
      {
        instanceId: 'INST-ARM-003',
        partNumber: 'ARM-001',
        name: 'Radial Arm Carbon Tube #3 (Rear Left)',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'HOLLOW_CYLINDER',
          dimensions: { radius: 0.015, innerRadius: 0.013, height: 0.45 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'ARM-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: -0.225, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: Math.PI } }
      },
      {
        instanceId: 'INST-ARM-004',
        partNumber: 'ARM-001',
        name: 'Radial Arm Carbon Tube #4 (Rear Right)',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'HOLLOW_CYLINDER',
          dimensions: { radius: 0.015, innerRadius: 0.013, height: 0.45 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'ARM-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: -0.225, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }
      },

      // Motor Mounts 1..4
      {
        instanceId: 'INST-MOUNT-001',
        partNumber: 'MOUNT-001',
        name: 'CNC Aluminum Motor Mount #1',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.05, dy: 0.05, dz: 0.02 }, // 0.00005 m3 -> Mass = 0.1405 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOUNT-GEO-HASH-001'
        },
        materialId: 'MAT-AL-7075-T6',
        materialName: 'Aluminum 7075-T6',
        densityKgM3: 2810,
        transform: { position: { x: 0.45, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
      },
      {
        instanceId: 'INST-MOUNT-002',
        partNumber: 'MOUNT-001',
        name: 'CNC Aluminum Motor Mount #2',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.05, dy: 0.05, dz: 0.02 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOUNT-GEO-HASH-001'
        },
        materialId: 'MAT-AL-7075-T6',
        materialName: 'Aluminum 7075-T6',
        densityKgM3: 2810,
        transform: { position: { x: 0, y: 0.45, z: 0 }, rotation: { x: 0, y: 0, z: Math.PI / 2 } }
      },
      {
        instanceId: 'INST-MOUNT-003',
        partNumber: 'MOUNT-001',
        name: 'CNC Aluminum Motor Mount #3',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.05, dy: 0.05, dz: 0.02 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOUNT-GEO-HASH-001'
        },
        materialId: 'MAT-AL-7075-T6',
        materialName: 'Aluminum 7075-T6',
        densityKgM3: 2810,
        transform: { position: { x: -0.45, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: Math.PI } }
      },
      {
        instanceId: 'INST-MOUNT-004',
        partNumber: 'MOUNT-001',
        name: 'CNC Aluminum Motor Mount #4',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.05, dy: 0.05, dz: 0.02 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOUNT-GEO-HASH-001'
        },
        materialId: 'MAT-AL-7075-T6',
        materialName: 'Aluminum 7075-T6',
        densityKgM3: 2810,
        transform: { position: { x: 0, y: -0.45, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }
      },

      // Motors 1..4
      {
        instanceId: 'INST-MOTOR-001',
        partNumber: 'MOTOR-001',
        name: 'Brushless DC Motor #1',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.042, height: 0.035 }, // Vol = 0.0001939 m3 -> Mass = 0.620 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOTOR-GEO-HASH-001'
        },
        materialId: 'MAT-COPPER-STEEL',
        materialName: 'Copper & Steel Motor Core',
        densityKgM3: 3197,
        transform: { position: { x: 0.45, y: 0, z: 0.025 }, rotation: { x: 0, y: 0, z: 0 } }
      },
      {
        instanceId: 'INST-MOTOR-002',
        partNumber: 'MOTOR-001',
        name: 'Brushless DC Motor #2',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.042, height: 0.035 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOTOR-GEO-HASH-001'
        },
        materialId: 'MAT-COPPER-STEEL',
        materialName: 'Copper & Steel Motor Core',
        densityKgM3: 3197,
        transform: { position: { x: 0, y: 0.45, z: 0.025 }, rotation: { x: 0, y: 0, z: Math.PI / 2 } }
      },
      {
        instanceId: 'INST-MOTOR-003',
        partNumber: 'MOTOR-001',
        name: 'Brushless DC Motor #3',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.042, height: 0.035 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOTOR-GEO-HASH-001'
        },
        materialId: 'MAT-COPPER-STEEL',
        materialName: 'Copper & Steel Motor Core',
        densityKgM3: 3197,
        transform: { position: { x: -0.45, y: 0, z: 0.025 }, rotation: { x: 0, y: 0, z: Math.PI } }
      },
      {
        instanceId: 'INST-MOTOR-004',
        partNumber: 'MOTOR-001',
        name: 'Brushless DC Motor #4',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.042, height: 0.035 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'MOTOR-GEO-HASH-001'
        },
        materialId: 'MAT-COPPER-STEEL',
        materialName: 'Copper & Steel Motor Core',
        densityKgM3: 3197,
        transform: { position: { x: 0, y: -0.45, z: 0.025 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }
      },

      // Propellers 1..4
      {
        instanceId: 'INST-PROP-001',
        partNumber: 'PROP-001',
        name: 'Folding Carbon Propeller #1',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.7, dy: 0.04, dz: 0.008 }, // Vol = 0.000224 m3 -> Mass = 0.3584 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'PROP-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0.45, y: 0, z: 0.05 }, rotation: { x: 0, y: 0, z: 0 } }
      },
      {
        instanceId: 'INST-PROP-002',
        partNumber: 'PROP-001',
        name: 'Folding Carbon Propeller #2',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.7, dy: 0.04, dz: 0.008 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'PROP-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: 0.45, z: 0.05 }, rotation: { x: 0, y: 0, z: Math.PI / 2 } }
      },
      {
        instanceId: 'INST-PROP-003',
        partNumber: 'PROP-001',
        name: 'Folding Carbon Propeller #3',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.7, dy: 0.04, dz: 0.008 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'PROP-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: -0.45, y: 0, z: 0.05 }, rotation: { x: 0, y: 0, z: Math.PI } }
      },
      {
        instanceId: 'INST-PROP-004',
        partNumber: 'PROP-001',
        name: 'Folding Carbon Propeller #4',
        subassemblyId: 'PROPULSION',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.7, dy: 0.04, dz: 0.008 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'PROP-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: -0.45, z: 0.05 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }
      },

      // LANDING GEAR SUBASSEMBLY
      {
        instanceId: 'INST-GEAR-001',
        partNumber: 'GEAR-001',
        name: 'Landing Gear Strut Left',
        subassemblyId: 'LANDING',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.01, height: 0.3 }, // Vol = 0.00009425 m3 -> Mass = 0.1508 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'GEAR-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: 0.15, z: -0.15 }, rotation: { x: 0, y: 0, z: 0 } }
      },
      {
        instanceId: 'INST-GEAR-002',
        partNumber: 'GEAR-001',
        name: 'Landing Gear Strut Right',
        subassemblyId: 'LANDING',
        geometrySpec: {
          shapeType: 'CYLINDER',
          dimensions: { radius: 0.01, height: 0.3 },
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'GEAR-GEO-HASH-001'
        },
        materialId: 'MAT-CFRP-001',
        materialName: 'T700 Carbon Fiber Composite',
        densityKgM3: 1600,
        transform: { position: { x: 0, y: -0.15, z: -0.15 }, rotation: { x: 0, y: 0, z: 0 } }
      },

      // BATTERY SYSTEM SUBASSEMBLY
      {
        instanceId: 'INST-BATT-001',
        partNumber: 'BATT-001',
        name: 'LiPo Battery Pack 12S 22000mAh',
        subassemblyId: 'BATTERY',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.22, dy: 0.16, dz: 0.09 }, // Vol = 0.003168 m3 -> Mass = 5.7024 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'BATT-GEO-HASH-001'
        },
        materialId: 'MAT-LIPO-PACK',
        materialName: 'High-Density LiPo Battery Pack',
        densityKgM3: 1800,
        transform: { position: { x: 0, y: 0, z: -0.05 }, rotation: { x: 0, y: 0, z: 0 } }
      },

      // PAYLOAD SYSTEM SUBASSEMBLY
      {
        instanceId: 'INST-PAYLOAD-001',
        partNumber: 'PAYLOAD-001',
        name: 'LiDAR Surveying Pod Payload',
        subassemblyId: 'PAYLOAD',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.18, dy: 0.18, dz: 0.14 }, // Vol = 0.004536 m3 -> Mass = 3.200 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'PAYLOAD-GEO-HASH-001'
        },
        materialId: 'MAT-OPTICS-AL',
        materialName: 'LiDAR Sensor Optics Assembly',
        densityKgM3: 705.467,
        transform: { position: { x: 0, y: 0, z: -0.12 }, rotation: { x: 0, y: 0, z: 0 } }
      },

      // AVIONICS SYSTEM SUBASSEMBLY
      {
        instanceId: 'INST-AVIONICS-001',
        partNumber: 'AVIONICS-001',
        name: 'Flight Controller & Telemetry Module',
        subassemblyId: 'AVIONICS',
        geometrySpec: {
          shapeType: 'BOX',
          dimensions: { dx: 0.10, dy: 0.08, dz: 0.04 }, // Vol = 0.00032 m3 -> Mass = 0.350 kg
          units: 'm',
          isClosedSolid: true,
          hasValidTopology: true,
          geometryHash: 'AVIONICS-GEO-HASH-001'
        },
        materialId: 'MAT-FR4-PCB',
        materialName: 'FR4 Glass-Epoxy Avionics PCB',
        densityKgM3: 1093.75,
        transform: { position: { x: 0, y: 0, z: 0.03 }, rotation: { x: 0, y: 0, z: 0 } }
      }
    ];

    for (const spec of specs) {
      this.components.set(spec.instanceId, spec);
    }
  }

  // =========================================================================
  // 2. PART-LEVEL MASS PROPERTIES EVALUATION
  // =========================================================================

  public evaluateAllPartMassProperties(): Map<string, MassProperties> {
    this.calculatedPartProps.clear();

    for (const [instanceId, comp] of this.components.entries()) {
      const props = MassPropertiesCalculator.calculatePartLocalMassProperties(
        comp.geometrySpec,
        comp.densityKgM3,
        comp.materialId,
        comp.geometrySpec.geometryHash
      );
      this.calculatedPartProps.set(instanceId, props);
    }

    return this.calculatedPartProps;
  }

  public getPartMassProperties(instanceId: string): MassProperties {
    let props = this.calculatedPartProps.get(instanceId);
    if (!props) {
      const comp = this.components.get(instanceId);
      if (!comp) throw new Error(`Component instance '${instanceId}' not found.`);
      props = MassPropertiesCalculator.calculatePartLocalMassProperties(
        comp.geometrySpec,
        comp.densityKgM3,
        comp.materialId
      );
      this.calculatedPartProps.set(instanceId, props);
    }
    return props;
  }

  // =========================================================================
  // 3. SUBASSEMBLY-LEVEL MASS PROPERTIES EVALUATION
  // =========================================================================

  public evaluateSubassemblyMassProperties(
    subassemblyId: 'AIRFRAME' | 'PROPULSION' | 'LANDING' | 'BATTERY' | 'PAYLOAD' | 'AVIONICS'
  ): MassProperties {
    const subComps = Array.from(this.components.values()).filter(
      c => c.subassemblyId === subassemblyId && !c.isSuppressed
    );

    const compRollupList = subComps.map(c => ({
      props: this.getPartMassProperties(c.instanceId),
      transform: c.transform,
      isSuppressed: c.isSuppressed
    }));

    return MassPropertiesCalculator.rollupAssemblyMassProperties(
      compRollupList,
      'SUBASSEMBLY'
    );
  }

  // =========================================================================
  // 4. CONFIGURATION-BASED COMPLETE ASSEMBLY MASS PROPERTIES
  // =========================================================================

  public evaluateCompleteAssemblyMassProperties(
    configMode: DroneConfigurationMode = 'OPERATIONAL_DRONE'
  ): MassProperties {
    const allComps = Array.from(this.components.values());

    const compRollupList = allComps.map(c => {
      let isSuppressed = c.isSuppressed ?? false;

      // Adjust suppression based on Product Configuration
      if (configMode === 'EMPTY_DRONE') {
        if (c.subassemblyId === 'BATTERY' || c.subassemblyId === 'PAYLOAD') {
          isSuppressed = true;
        }
      } else if (configMode === 'MAX_PAYLOAD_DRONE') {
        // In max payload drone, we double payload density/dimensions to simulate heavy payload
        if (c.instanceId === 'INST-PAYLOAD-001') {
          const heavyProps = MassPropertiesCalculator.calculatePartLocalMassProperties(
            {
              ...c.geometrySpec,
              dimensions: { dx: 0.25, dy: 0.25, dz: 0.18 }
            },
            c.densityKgM3 * 1.5,
            c.materialId
          );
          return {
            props: heavyProps,
            transform: c.transform,
            isSuppressed: false
          };
        }
      }

      return {
        props: this.getPartMassProperties(c.instanceId),
        transform: c.transform,
        isSuppressed
      };
    });

    // Also register in ProductConfigurationManager
    try {
      const pcm = new ProductConfigurationManager();
      pcm.createProduct({
        productId: 'PROD-INDUSTRIAL-DRONE',
        name: 'Industrial Drone Platform',
        description: 'Industrial Drone Aerospace Platform',
        productType: 'AEROSPACE'
      });
    } catch {
      // Ignore if product already registered in manager instance
    }

    return MassPropertiesCalculator.rollupAssemblyMassProperties(
      compRollupList,
      'ASSEMBLY'
    );
  }

  // =========================================================================
  // 5. PARAMETRIC UPDATES & DEPENDENCY INVALIDATION
  // =========================================================================

  public updateComponentGeometryParameter(
    instanceId: string,
    paramName: string,
    newValue: number
  ): MassProperties {
    const comp = this.components.get(instanceId);
    if (!comp) throw new Error(`Component instance ${instanceId} not found.`);

    const oldProps = this.getPartMassProperties(instanceId);

    // Create updated geometry spec
    const updatedDims = { ...comp.geometrySpec.dimensions, [paramName]: newValue };
    const newSpec: SolidGeometrySpec = {
      ...comp.geometrySpec,
      dimensions: updatedDims,
      geometryHash: MassPropertiesCalculator['hashString'](
        `${comp.geometrySpec.geometryHash}:${paramName}:${newValue}`
      )
    };

    comp.geometrySpec = newSpec;
    this.components.set(instanceId, comp);

    // Invalidate cached part properties
    this.calculatedPartProps.delete(instanceId);

    // Recompute new properties
    const newProps = this.getPartMassProperties(instanceId);
    this.recalculationCount++;

    // Record invalidation audit log
    this.invalidationLogs.push({
      invalidationId: `INV-LOG-${this.invalidationLogs.length + 1}`,
      timestamp: new Date().toISOString(),
      reason: `Parametric update on ${instanceId}: ${paramName} changed to ${newValue}`,
      targetInstanceId: instanceId,
      previousRevision: this.revision,
      newRevision: `${this.revision}-MODIFIED`,
      previousMassKg: oldProps.mass,
      newMassKg: newProps.mass
    });

    return newProps;
  }

  public getInvalidationLogs(): InvalidationLogRecord[] {
    return this.invalidationLogs;
  }

  public getRecalculationCount(): number {
    return this.recalculationCount;
  }

  public getAllComponents(): DroneComponentMassSpec[] {
    return Array.from(this.components.values());
  }

  // =========================================================================
  // 6. DETAILED VERIFICATION CHECKS FOR ACCEPTANCE CRITERIA
  // =========================================================================

  public runAllVerificationChecks(): {
    massConservationPassed: boolean;
    cgConsistencyPassed: boolean;
    inertiaConsistencyPassed: boolean;
    symmetryPassed: boolean;
    physicalValidityPassed: boolean;
    analyticalFixturesPassed: boolean;
    unitConversionsPassed: boolean;
    determinismPassed: boolean;
    details: any;
  } {
    // 1. Analytical Fixtures
    const boxResult = MassPropertiesCalculator.calculateAnalyticalBoxFixture(0.5, 0.4, 0.3, 2700);
    const cylResult = MassPropertiesCalculator.calculateAnalyticalCylinderFixture(0.1, 0.6, 7850);
    const sphereResult = MassPropertiesCalculator.calculateAnalyticalSphereFixture(0.2, 1000);
    const analyticalFixturesPassed = boxResult.passed && cylResult.passed && sphereResult.passed;

    // 2. Unit Conversions
    const sampleProps = this.getPartMassProperties('INST-AIRFRAME-001');
    const convertedToEng = MassPropertiesUnitConverter.convertMassProperties(sampleProps, {
      mass: 'g',
      length: 'mm',
      inertia: 'kg·mm²',
      density: 'g/cm³',
      volume: 'mm³'
    });
    const unitConversionsPassed =
      Math.abs(convertedToEng.mass - sampleProps.mass * 1000) < 1e-4 &&
      Math.abs(convertedToEng.volume - sampleProps.volume * 1e9) < 1e-2;

    // 3. Complete Assembly Properties
    const assemblyProps = this.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');

    // 4. Symmetry & Physical Validity
    const symReport = MassPropertiesCalculator.validateInertiaSymmetryAndPhysicalValidity(
      assemblyProps.inertiaTensor
    );
    const symmetryPassed = symReport.isSymmetric;
    const physicalValidityPassed = symReport.isPositiveDefinite && symReport.satisfiesTriangleInequality;

    // 5. Mass Conservation Check: Sum of part masses == Assembly Mass
    const activeComps = Array.from(this.components.values()).filter(c => !c.isSuppressed);
    let sumPartMasses = 0;
    for (const comp of activeComps) {
      sumPartMasses += this.getPartMassProperties(comp.instanceId).mass;
    }
    const massDiff = Math.abs(sumPartMasses - assemblyProps.mass);
    const massConservationPassed = massDiff < 1e-6;

    // 6. CG Consistency Check: Direct Assembly CG vs Subassembly Rollup CG
    const airframeProps = this.evaluateSubassemblyMassProperties('AIRFRAME');
    const propProps = this.evaluateSubassemblyMassProperties('PROPULSION');
    const landingProps = this.evaluateSubassemblyMassProperties('LANDING');
    const battProps = this.evaluateSubassemblyMassProperties('BATTERY');
    const payloadProps = this.evaluateSubassemblyMassProperties('PAYLOAD');
    const avionicsProps = this.evaluateSubassemblyMassProperties('AVIONICS');

    const subRollupComps = [
      { props: airframeProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { props: propProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { props: landingProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { props: battProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { props: payloadProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { props: avionicsProps, transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } }
    ];

    const subassemblyRollupProps = MassPropertiesCalculator.rollupAssemblyMassProperties(
      subRollupComps,
      'ASSEMBLY'
    );

    const cgDiffX = Math.abs(assemblyProps.centerOfMass.x - subassemblyRollupProps.centerOfMass.x);
    const cgDiffY = Math.abs(assemblyProps.centerOfMass.y - subassemblyRollupProps.centerOfMass.y);
    const cgDiffZ = Math.abs(assemblyProps.centerOfMass.z - subassemblyRollupProps.centerOfMass.z);
    const cgConsistencyPassed = cgDiffX < 1e-5 && cgDiffY < 1e-5 && cgDiffZ < 1e-5;

    // 7. Inertia Consistency Check: Direct Assembly Inertia vs Subassembly Rollup Inertia
    let inertiaDiffMax = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(assemblyProps.inertiaTensor[r][c] - subassemblyRollupProps.inertiaTensor[r][c]);
        if (diff > inertiaDiffMax) inertiaDiffMax = diff;
      }
    }
    const inertiaConsistencyPassed = inertiaDiffMax < 1e-5;

    // 8. Determinism Check
    const run1 = this.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const run2 = this.evaluateCompleteAssemblyMassProperties('OPERATIONAL_DRONE');
    const determinismPassed = run1.provenance.outputHash === run2.provenance.outputHash;

    return {
      massConservationPassed,
      cgConsistencyPassed,
      inertiaConsistencyPassed,
      symmetryPassed,
      physicalValidityPassed,
      analyticalFixturesPassed,
      unitConversionsPassed,
      determinismPassed,
      details: {
        sumPartMasses,
        assemblyMass: assemblyProps.mass,
        massDiff,
        assemblyCG: assemblyProps.centerOfMass,
        subassemblyRollupCG: subassemblyRollupProps.centerOfMass,
        cgDiffMax: Math.max(cgDiffX, cgDiffY, cgDiffZ),
        inertiaDiffMax,
        symReport,
        analyticalFixtures: [boxResult, cylResult, sphereResult]
      }
    };
  }
}
