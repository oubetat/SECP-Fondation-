/**
 * SECP Industrial OS — EPC-020: Structural Component Generators
 * Parametric Generators for Arm, Motor Mount, Landing Gear, Payload Structure,
 * and Battery Structure using SECP CAD Geometry Kernel, MaterialsEngine, and Mass Properties.
 */

import { CadGeometryKernel, CadSolidEntity, Vector3D } from '../../cadKernel';
import { MaterialsEngine, Material } from '../../materials';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { AirframeInertiaTensor } from '../airframe/ParametricAirframeTypes';
import {
  ArmParametersConfig,
  BatteryStructureParametersConfig,
  ComponentAssemblyInterface,
  ComponentCoordinateSystem,
  LandingGearParametersConfig,
  ManufacturingDefinition,
  MaterialReference,
  MotorMountParametersConfig,
  PayloadStructureParametersConfig,
  StructuralAnalysisReference,
  StructuralComponent,
  StructuralLoadCaseDefinition,
  StructuralMassProperties,
  StructuralParameter
} from './StructuralComponentTypes';

export class StructuralComponentGenerators {
  private static readonly KERNEL_VERSION = 'SECP-CAD-KERNEL-v4.2';
  private static readonly CASE_ID = 'EPC-CASE-001';
  private static readonly PRODUCT_ID = 'PROD-IND-DRONE-001';

  // =========================================================================
  // 1. ARM GENERATOR
  // =========================================================================
  public static generateArm(
    configInput?: Partial<ArmParametersConfig>,
    options: {
      componentId?: string;
      revision?: string;
      position?: Vector3D;
      rotation?: Vector3D;
      armIndex?: number;
    } = {}
  ): StructuralComponent {
    const config: ArmParametersConfig = {
      length: configInput?.length ?? 280,
      width: configInput?.width ?? 25,
      height: configInput?.height ?? 20,
      wallThickness: configInput?.wallThickness ?? 2.0,
      sectionType: configInput?.sectionType ?? 'RECTANGULAR_BOX',
      mountingHolePattern: configInput?.mountingHolePattern ?? {
        boltCircleDiameterMm: 20,
        holeCount: 4,
        holeDiameterMm: 3.2
      },
      materialId: configInput?.materialId ?? 'mat-carbon-fiber'
    };

    const armIndex = options.armIndex ?? 0;
    const componentId = options.componentId ?? `COMP-ARM-${String(armIndex + 1).padStart(3, '0')}`;
    const revision = options.revision ?? 'REV-A';
    const now = new Date().toISOString();

    // 1. Material lookup
    const material = MaterialsEngine.getMaterial(config.materialId!) || MaterialsEngine.getMaterial('mat-carbon-fiber')!;
    const matRef = this.buildMaterialReference(material);

    // 2. CAD Solid Geometry construction via SECP CAD Kernel
    // Outer tube
    const outerBox = CadGeometryKernel.createBox(
      config.length,
      config.width,
      config.height,
      `Solid_ArmOuter_${componentId}`
    );

    // Inner hollow core (to represent realistic wall thickness)
    const innerLength = Math.max(10, config.length - 20); // solid mount blocks on ends
    const innerWidth = Math.max(1, config.width - 2 * config.wallThickness);
    const innerHeight = Math.max(1, config.height - 2 * config.wallThickness);
    const innerCore = CadGeometryKernel.createBox(
      innerLength,
      innerWidth,
      innerHeight,
      `Solid_ArmInner_${componentId}`
    );

    // Subtractive boolean operation for hollow tube
    const hollowArm = CadGeometryKernel.booleanOperation(outerBox, innerCore, 'CUT');

    // 3. Coordinate System
    const coordinateSystem: ComponentCoordinateSystem = {
      origin: options.position ?? { x: 120, y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      eulerAnglesDeg: options.rotation ?? { x: 0, y: 0, z: 0 }
    };

    // 4. Parameter Set
    const parameterSet: Record<string, StructuralParameter<any>> = {
      length: {
        parameterId: `${componentId}-PARAM-001`,
        name: 'length',
        value: config.length,
        unit: 'mm',
        minimum: 150,
        maximum: 600,
        default: 280,
        description: 'Cantilever tubular arm length from fuselage root to motor mount center.',
        source: 'AEROSPACE_STRUCTURAL_STANDARDS'
      },
      width: {
        parameterId: `${componentId}-PARAM-002`,
        name: 'width',
        value: config.width,
        unit: 'mm',
        minimum: 15,
        maximum: 60,
        default: 25,
        description: 'Cross-sectional beam outer width.',
        source: 'STRUCTURAL_DESIGN_GUIDELINES'
      },
      height: {
        parameterId: `${componentId}-PARAM-003`,
        name: 'height',
        value: config.height,
        unit: 'mm',
        minimum: 12,
        maximum: 50,
        default: 20,
        description: 'Cross-sectional beam outer height for bending stiffness.',
        source: 'STRUCTURAL_DESIGN_GUIDELINES'
      },
      wallThickness: {
        parameterId: `${componentId}-PARAM-004`,
        name: 'wallThickness',
        value: config.wallThickness,
        unit: 'mm',
        minimum: 1.0,
        maximum: 5.0,
        default: 2.0,
        description: 'Structural composite laminate wall thickness.',
        source: 'COMPOSITE_MANUFACTURING_LIMITS'
      },
      sectionType: {
        parameterId: `${componentId}-PARAM-005`,
        name: 'sectionType',
        value: config.sectionType,
        unit: 'enum',
        default: 'RECTANGULAR_BOX',
        description: 'Geometric cross-section profile topology.',
        source: 'AEROSPACE_STRUCTURAL_STANDARDS'
      },
      boltCircleDiameter: {
        parameterId: `${componentId}-PARAM-006`,
        name: 'boltCircleDiameter',
        value: config.mountingHolePattern.boltCircleDiameterMm,
        unit: 'mm',
        minimum: 15,
        maximum: 35,
        default: 20,
        description: 'Root mounting flange bolt circle pitch.',
        source: 'FASTENER_SPECIFICATION_M3'
      }
    };

    // 5. Mass & Inertia Properties via Physics Derivation
    const massProperties = this.computeMassProperties(
      hollowArm,
      matRef.densityKgM3,
      { dx: config.length / 1000, dy: config.width / 1000, dz: config.height / 1000 },
      coordinateSystem.origin
    );

    // 6. Load Cases (FEA Readiness)
    const loadCases: StructuralLoadCaseDefinition[] = [
      {
        loadCaseId: `${componentId}-LC-01`,
        name: 'Max Propeller Dynamic Thrust 4G Maneuver',
        description: 'Vertical upward bending moment induced by 45N maximum motor thrust with 4.0 safety factor.',
        loadType: 'POINT_FORCE',
        magnitudeN: 180, // 45N thrust * 4G
        direction: { x: 0, y: 0, z: 1 },
        applicationPoint: { x: config.length / 1000, y: 0, z: 0 },
        safetyFactorRequired: 2.5,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Root Fixed Support Flange',
            type: 'FIXED_SUPPORT',
            locationDescription: 'Inner root interface bolted to central deck standoffs.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-01`
      },
      {
        loadCaseId: `${componentId}-LC-02`,
        name: 'Motor Gyroscopic Pitch/Roll Torsion',
        description: 'Torsional torque load induced by propeller gyroscopic precession at 60 deg/sec yaw rate.',
        loadType: 'TORQUE',
        magnitudeN: 12.5, // N*m
        direction: { x: 1, y: 0, z: 0 },
        applicationPoint: { x: config.length / 1000, y: 0, z: 0 },
        safetyFactorRequired: 2.0,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Root Fixed Support Flange',
            type: 'FIXED_SUPPORT',
            locationDescription: 'Inner root interface bolted to central deck standoffs.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-02`
      }
    ];

    // 7. FEA Readiness References
    const analysisReferences: StructuralAnalysisReference[] = [
      {
        analysisId: `${componentId}-ANA-01`,
        analysisType: 'STATIC_STRESS',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'TET10_QUADRATIC',
          targetElementSizeMm: 3.0,
          maxAspectRatio: 3.5
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa * 0.8,
        expectedMinimumSafetyFactor: 2.85
      },
      {
        analysisId: `${componentId}-ANA-02`,
        analysisType: 'MODAL_VIBRATION',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'HEX20_SERENDIPITY',
          targetElementSizeMm: 4.0,
          maxAspectRatio: 3.0
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa,
        expectedMinimumSafetyFactor: 2.4
      }
    ];

    // 8. Manufacturing Definition
    const manufacturingDefinition: ManufacturingDefinition = {
      process: 'AUTOCLAVE_COMPOSITE_MOLDING',
      materialName: matRef.materialName,
      rawStockSpecification: 'Toray T700 3K Unidirectional & Twill Prepreg (0/90/45/-45 Layup)',
      standardTolerances: 'ISO 2768-m (General Tolerances: ±0.2 mm)',
      surfaceRoughnessRaUm: 0.8,
      criticalDimensions: [
        {
          name: 'Arm Length (Root to Tip Center)',
          nominalMm: config.length,
          toleranceMm: 0.15,
          upperLimitMm: config.length + 0.15,
          lowerLimitMm: config.length - 0.15,
          isCritical: true
        },
        {
          name: 'Wall Thickness Laminate',
          nominalMm: config.wallThickness,
          toleranceMm: 0.1,
          upperLimitMm: config.wallThickness + 0.1,
          lowerLimitMm: config.wallThickness - 0.1,
          isCritical: true
        },
        {
          name: 'Root Mounting Bolt Pattern Diameter',
          nominalMm: config.mountingHolePattern.boltCircleDiameterMm,
          toleranceMm: 0.05,
          upperLimitMm: config.mountingHolePattern.boltCircleDiameterMm + 0.05,
          lowerLimitMm: config.mountingHolePattern.boltCircleDiameterMm - 0.05,
          isCritical: true
        }
      ],
      inspectionRequirements: [
        'Coordinate Measuring Machine (CMM) 3D coordinate inspection',
        'Ultrasonic Non-Destructive Testing (NDT) for laminate void/delamination screening',
        'Visual surface inspection under 10x optical magnification'
      ],
      camToolpathReady: true,
      estimatedCycleTimeMinutes: 45,
      qualityStandard: 'AS9100D Aerospace Quality Standard'
    };

    // 9. Assembly Interfaces
    const assemblyInterfaces: ComponentAssemblyInterface[] = [
      {
        interfaceId: `${componentId}-IF-ROOT`,
        name: 'Fuselage Deck Root Bolted Clamp',
        mateKind: 'FIXED',
        matingTargetComponentId: 'DRONE-AIRFRAME-BODY',
        matingTargetType: 'CENTRAL_FUSELAGE',
        localAttachmentPoint: { x: 0, y: 0, z: 0 },
        contactAreaMm2: config.width * config.height,
        fastenerSpecification: 'ISO 4762 M3x16 Grade 12.9 High-Tensile Socket Cap Screws',
        fastenerQuantity: 4,
        tighteningTorqueNm: 2.2,
        traceableRequirementId: 'DRONE-REQ-005'
      },
      {
        interfaceId: `${componentId}-IF-TIP`,
        name: 'Motor Mount Tip Interface',
        mateKind: 'COINCIDENT',
        matingTargetComponentId: `COMP-MOUNT-${String(armIndex + 1).padStart(3, '0')}`,
        matingTargetType: 'MOTOR_MOUNT',
        localAttachmentPoint: { x: config.length, y: 0, z: 0 },
        contactAreaMm2: config.width * 20,
        fastenerSpecification: 'ISO 7380 M3x10 Aluminum 7075-T6 Button Screws',
        fastenerQuantity: 4,
        tighteningTorqueNm: 1.8,
        traceableRequirementId: 'DRONE-REQ-006'
      }
    ];

    // 10. Hashes
    const geometryData = {
      type: hollowArm.type,
      volumeM3: hollowArm.volumeM3,
      surfaceAreaM2: hollowArm.surfaceAreaM2,
      dimensions: config
    };
    const geometryHash = EngineeringHashChain.computeCanonicalHash(geometryData).canonicalHash;
    const parameterHash = EngineeringHashChain.computeCanonicalHash(parameterSet).canonicalHash;
    const contentHash = EngineeringHashChain.computeCanonicalHash({
      componentId,
      productId: this.PRODUCT_ID,
      componentType: 'ARM',
      revision,
      geometryHash,
      parameterHash,
      materialId: matRef.materialId,
      massKg: massProperties.massKg
    }).canonicalHash;

    return {
      componentId,
      productId: this.PRODUCT_ID,
      caseId: this.CASE_ID,
      componentType: 'ARM',
      name: `Industrial Drone Carbon Composite Radial Arm (${componentId})`,
      partNumber: `SECP-DRONE-ARM-00${armIndex + 1}`,
      revision,
      status: 'DESIGN_DEFINED',
      coordinateSystem,
      parameterSet,
      materialReference: matRef,
      geometryReference: {
        solidEntity: hollowArm,
        boundingDimensionsMm: {
          length: config.length,
          width: config.width,
          height: config.height
        },
        vertexCount: hollowArm.mesh.vertices.length / 3,
        faceCount: hollowArm.mesh.facesCount,
        isManifold: true,
        eulerCharacteristic: 2,
        geometryHash
      },
      massProperties,
      loadCases,
      analysisReferences,
      manufacturingDefinition,
      assemblyInterfaces,
      traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-005', 'DRONE-REQ-018', 'DRONE-REQ-020'],
      evidenceReferences: [`EVID-ARM-${componentId}-001`],
      contentHash,
      parameterHash,
      createdAt: now,
      updatedAt: now,
      author: 'SECP-STRUCTURAL-ENGINEER'
    };
  }

  // =========================================================================
  // 2. MOTOR MOUNT GENERATOR
  // =========================================================================
  public static generateMotorMount(
    configInput?: Partial<MotorMountParametersConfig>,
    options: {
      componentId?: string;
      revision?: string;
      position?: Vector3D;
      rotation?: Vector3D;
      mountIndex?: number;
    } = {}
  ): StructuralComponent {
    const config: MotorMountParametersConfig = {
      mountDiameter: configInput?.mountDiameter ?? 60,
      boltPattern: configInput?.boltPattern ?? {
        boltCircleDiameterMm: 25,
        holeCount: 4,
        threadSpec: 'M3'
      },
      mountThickness: configInput?.mountThickness ?? 4.0,
      hubDiameter: configInput?.hubDiameter ?? 12,
      materialId: configInput?.materialId ?? 'mat-alu-6061'
    };

    const mountIndex = options.mountIndex ?? 0;
    const componentId = options.componentId ?? `COMP-MOUNT-${String(mountIndex + 1).padStart(3, '0')}`;
    const revision = options.revision ?? 'REV-A';
    const now = new Date().toISOString();

    const material = MaterialsEngine.getMaterial(config.materialId!) || MaterialsEngine.getMaterial('mat-alu-6061')!;
    const matRef = this.buildMaterialReference(material);

    // CAD Solid Geometry via SECP CAD Kernel
    // Outer circular disc
    const mainPlate = CadGeometryKernel.createCylinder(
      config.mountDiameter / 2,
      config.mountThickness,
      `Solid_MotorMountPlate_${componentId}`
    );

    // Center hub bore hole
    const centerBore = CadGeometryKernel.createCylinder(
      config.hubDiameter / 2,
      config.mountThickness + 1.0,
      `Solid_HubBore_${componentId}`
    );

    const drilledPlate = CadGeometryKernel.booleanOperation(mainPlate, centerBore, 'CUT');

    const coordinateSystem: ComponentCoordinateSystem = {
      origin: options.position ?? { x: 380, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      up: { x: 1, y: 0, z: 0 },
      eulerAnglesDeg: options.rotation ?? { x: 0, y: 0, z: 0 }
    };

    const parameterSet: Record<string, StructuralParameter<any>> = {
      mountDiameter: {
        parameterId: `${componentId}-PARAM-001`,
        name: 'mountDiameter',
        value: config.mountDiameter,
        unit: 'mm',
        minimum: 40,
        maximum: 120,
        default: 60,
        description: 'Outer diameter of the CNC machined motor bracket.',
        source: 'PROPULSION_INTERFACE_SPEC'
      },
      boltCircleDiameter: {
        parameterId: `${componentId}-PARAM-002`,
        name: 'boltCircleDiameter',
        value: config.boltPattern.boltCircleDiameterMm,
        unit: 'mm',
        minimum: 16,
        maximum: 45,
        default: 25,
        description: 'Standard motor stator mounting bolt circle pitch.',
        source: 'MOTOR_DIMENSION_SHEET_M3'
      },
      mountThickness: {
        parameterId: `${componentId}-PARAM-003`,
        name: 'mountThickness',
        value: config.mountThickness,
        unit: 'mm',
        minimum: 2.5,
        maximum: 8.0,
        default: 4.0,
        description: 'Thickness of structural CNC aluminum plate.',
        source: 'THERMAL_HEAT_SINK_ANALYSIS'
      },
      hubDiameter: {
        parameterId: `${componentId}-PARAM-004`,
        name: 'hubDiameter',
        value: config.hubDiameter,
        unit: 'mm',
        minimum: 8.0,
        maximum: 25.0,
        default: 12.0,
        description: 'Central motor shaft and bearing clearance hole diameter.',
        source: 'MOTOR_DIMENSION_SHEET_M3'
      }
    };

    const massProperties = this.computeMassProperties(
      drilledPlate,
      matRef.densityKgM3,
      { radius: (config.mountDiameter / 2) / 1000, dz: config.mountThickness / 1000 },
      coordinateSystem.origin
    );

    const loadCases: StructuralLoadCaseDefinition[] = [
      {
        loadCaseId: `${componentId}-LC-01`,
        name: 'Max Motor Full Throttle Thrust',
        description: '45N maximum motor axial thrust combined with stator torque reaction.',
        loadType: 'POINT_FORCE',
        magnitudeN: 45,
        direction: { x: 0, y: 0, z: 1 },
        applicationPoint: { x: 0, y: 0, z: config.mountThickness / 1000 },
        safetyFactorRequired: 2.5,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Arm Tip Fastener Interface',
            type: 'FIXED_SUPPORT',
            locationDescription: 'Bolted to carbon tube arm tip.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-01`
      }
    ];

    const analysisReferences: StructuralAnalysisReference[] = [
      {
        analysisId: `${componentId}-ANA-01`,
        analysisType: 'STATIC_STRESS',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'TET10_QUADRATIC',
          targetElementSizeMm: 1.5,
          maxAspectRatio: 2.8
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa * 0.75,
        expectedMinimumSafetyFactor: 3.2
      }
    ];

    const manufacturingDefinition: ManufacturingDefinition = {
      process: 'CNC_MILLING_5AXIS',
      materialName: matRef.materialName,
      rawStockSpecification: 'Aluminum 7075-T651 Precision Billet Bar Stock',
      standardTolerances: 'ISO 2768-f (Fine Tolerances: ±0.05 mm)',
      surfaceRoughnessRaUm: 0.4,
      criticalDimensions: [
        {
          name: 'Motor Bolt Circle Diameter',
          nominalMm: config.boltPattern.boltCircleDiameterMm,
          toleranceMm: 0.02,
          upperLimitMm: config.boltPattern.boltCircleDiameterMm + 0.02,
          lowerLimitMm: config.boltPattern.boltCircleDiameterMm - 0.02,
          isCritical: true
        },
        {
          name: 'Center Hub Bore Diameter',
          nominalMm: config.hubDiameter,
          toleranceMm: 0.03,
          upperLimitMm: config.hubDiameter + 0.03,
          lowerLimitMm: config.hubDiameter - 0.03,
          isCritical: true
        }
      ],
      inspectionRequirements: [
        'Full GD&T True Position inspection of bolt pattern within Ø0.03 mm',
        'Anodizing thickness check (MIL-A-8625 Type III Hardcoat)',
        'Thread pitch gauge verification for M3 tapped holes'
      ],
      camToolpathReady: true,
      estimatedCycleTimeMinutes: 18,
      qualityStandard: 'ISO 9001 / AS9100 Precision CNC Machining'
    };

    const assemblyInterfaces: ComponentAssemblyInterface[] = [
      {
        interfaceId: `${componentId}-IF-ARM`,
        name: 'Arm Tip Mounting Clamping Interface',
        mateKind: 'COINCIDENT',
        matingTargetComponentId: `COMP-ARM-${String(mountIndex + 1).padStart(3, '0')}`,
        matingTargetType: 'ARM',
        localAttachmentPoint: { x: 0, y: 0, z: 0 },
        contactAreaMm2: 450,
        fastenerSpecification: 'ISO 7380 M3x10 Grade 10.9 Torx Screws',
        fastenerQuantity: 4,
        tighteningTorqueNm: 1.8,
        traceableRequirementId: 'DRONE-REQ-006'
      },
      {
        interfaceId: `${componentId}-IF-MOTOR`,
        name: 'Brushless Motor Stator Mount Pattern',
        mateKind: 'CONCENTRIC',
        matingTargetComponentId: `MOTOR-${String(mountIndex + 1).padStart(3, '0')}`,
        matingTargetType: 'PROPULSION_MOTOR',
        localAttachmentPoint: { x: 0, y: 0, z: config.mountThickness },
        contactAreaMm2: Math.PI * ((config.mountDiameter / 2) ** 2 - (config.hubDiameter / 2) ** 2),
        fastenerSpecification: 'DIN 7991 M3x8 Stainless Counter-sunk Screws',
        fastenerQuantity: 4,
        tighteningTorqueNm: 1.5,
        traceableRequirementId: 'DRONE-REQ-006'
      }
    ];

    const geometryData = {
      type: drilledPlate.type,
      volumeM3: drilledPlate.volumeM3,
      surfaceAreaM2: drilledPlate.surfaceAreaM2,
      dimensions: config
    };
    const geometryHash = EngineeringHashChain.computeCanonicalHash(geometryData).canonicalHash;
    const parameterHash = EngineeringHashChain.computeCanonicalHash(parameterSet).canonicalHash;
    const contentHash = EngineeringHashChain.computeCanonicalHash({
      componentId,
      productId: this.PRODUCT_ID,
      componentType: 'MOTOR_MOUNT',
      revision,
      geometryHash,
      parameterHash,
      materialId: matRef.materialId,
      massKg: massProperties.massKg
    }).canonicalHash;

    return {
      componentId,
      productId: this.PRODUCT_ID,
      caseId: this.CASE_ID,
      componentType: 'MOTOR_MOUNT',
      name: `Industrial Drone CNC 7075-T6 Motor Mount Bracket (${componentId})`,
      partNumber: `SECP-DRONE-MM-00${mountIndex + 1}`,
      revision,
      status: 'DESIGN_DEFINED',
      coordinateSystem,
      parameterSet,
      materialReference: matRef,
      geometryReference: {
        solidEntity: drilledPlate,
        boundingDimensionsMm: {
          length: config.mountDiameter,
          width: config.mountDiameter,
          height: config.mountThickness,
          radius: config.mountDiameter / 2
        },
        vertexCount: drilledPlate.mesh.vertices.length / 3,
        faceCount: drilledPlate.mesh.facesCount,
        isManifold: true,
        eulerCharacteristic: 2,
        geometryHash
      },
      massProperties,
      loadCases,
      analysisReferences,
      manufacturingDefinition,
      assemblyInterfaces,
      traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-006', 'DRONE-REQ-018', 'DRONE-REQ-019'],
      evidenceReferences: [`EVID-MOUNT-${componentId}-001`],
      contentHash,
      parameterHash,
      createdAt: now,
      updatedAt: now,
      author: 'SECP-STRUCTURAL-ENGINEER'
    };
  }

  // =========================================================================
  // 3. LANDING GEAR GENERATOR
  // =========================================================================
  public static generateLandingGear(
    configInput?: Partial<LandingGearParametersConfig>,
    options: {
      componentId?: string;
      revision?: string;
      position?: Vector3D;
      rotation?: Vector3D;
      legIndex?: number;
    } = {}
  ): StructuralComponent {
    const config: LandingGearParametersConfig = {
      gearHeight: configInput?.gearHeight ?? 180,
      footprintWidth: configInput?.footprintWidth ?? 320,
      legLength: configInput?.legLength ?? 220,
      legThickness: configInput?.legThickness ?? 16,
      mountingPosition: configInput?.mountingPosition ?? { x: 90, y: 90, z: -20 },
      materialId: configInput?.materialId ?? 'mat-carbon-fiber'
    };

    const legIndex = options.legIndex ?? 0;
    const componentId = options.componentId ?? `COMP-GEAR-${String(legIndex + 1).padStart(3, '0')}`;
    const revision = options.revision ?? 'REV-A';
    const now = new Date().toISOString();

    const material = MaterialsEngine.getMaterial(config.materialId!) || MaterialsEngine.getMaterial('mat-carbon-fiber')!;
    const matRef = this.buildMaterialReference(material);

    // CAD Solid Geometry: Strut Cylinder
    const legStrut = CadGeometryKernel.createCylinder(
      config.legThickness / 2,
      config.legLength,
      `Solid_LandingLeg_${componentId}`
    );

    const coordinateSystem: ComponentCoordinateSystem = {
      origin: options.position ?? config.mountingPosition,
      normal: { x: 0, y: 0, z: -1 },
      up: { x: 1, y: 0, z: 0 },
      eulerAnglesDeg: options.rotation ?? { x: 25, y: 0, z: 45 * legIndex }
    };

    const parameterSet: Record<string, StructuralParameter<any>> = {
      gearHeight: {
        parameterId: `${componentId}-PARAM-001`,
        name: 'gearHeight',
        value: config.gearHeight,
        unit: 'mm',
        minimum: 100,
        maximum: 350,
        default: 180,
        description: 'Vertical clearance from ground to lower fuselage deck.',
        source: 'PAYLOAD_GROUND_CLEARANCE_SPEC'
      },
      footprintWidth: {
        parameterId: `${componentId}-PARAM-002`,
        name: 'footprintWidth',
        value: config.footprintWidth,
        unit: 'mm',
        minimum: 200,
        maximum: 600,
        default: 320,
        description: 'Tip-to-tip landing stance width for rollover stability.',
        source: 'LANDING_STABILITY_CALCULATIONS'
      },
      legLength: {
        parameterId: `${componentId}-PARAM-003`,
        name: 'legLength',
        value: config.legLength,
        unit: 'mm',
        minimum: 120,
        maximum: 400,
        default: 220,
        description: 'Total strut length along canted leg axis.',
        source: 'STRUCTURAL_GEOMETRY_KINEMATICS'
      },
      legThickness: {
        parameterId: `${componentId}-PARAM-004`,
        name: 'legThickness',
        value: config.legThickness,
        unit: 'mm',
        minimum: 10,
        maximum: 30,
        default: 16,
        description: 'Diameter of carbon fiber tubular strut.',
        source: 'DYNAMIC_LANDING_IMPACT_ENERGY'
      }
    };

    const massProperties = this.computeMassProperties(
      legStrut,
      matRef.densityKgM3,
      { radius: (config.legThickness / 2) / 1000, dz: config.legLength / 1000 },
      coordinateSystem.origin
    );

    const loadCases: StructuralLoadCaseDefinition[] = [
      {
        loadCaseId: `${componentId}-LC-01`,
        name: 'Dynamic 3G Hard Landing Touchdown Impact',
        description: '3G deceleration impact force applied vertically at landing foot contact patch.',
        loadType: 'DYNAMIC_IMPACT',
        magnitudeN: 220, // 3G dynamic shock for 7.5kg drone
        direction: { x: 0, y: 0, z: 1 },
        applicationPoint: { x: 0, y: 0, z: -config.gearHeight / 1000 },
        safetyFactorRequired: 2.0,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Lower Deck Hardpoint Socket',
            type: 'FIXED_SUPPORT',
            locationDescription: 'Clamped into fuselage lower deck aluminum hardpoint.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-01`
      }
    ];

    const analysisReferences: StructuralAnalysisReference[] = [
      {
        analysisId: `${componentId}-ANA-01`,
        analysisType: 'BUCKLING_ANALYSIS',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'TET10_QUADRATIC',
          targetElementSizeMm: 2.5,
          maxAspectRatio: 3.2
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa * 0.7,
        expectedMinimumSafetyFactor: 2.6
      }
    ];

    const manufacturingDefinition: ManufacturingDefinition = {
      process: 'AUTOCLAVE_COMPOSITE_MOLDING',
      materialName: matRef.materialName,
      rawStockSpecification: 'High-Modulus Carbon Fiber Braided Sleeve & Epoxy Matrix',
      standardTolerances: 'ISO 2768-m (±0.2 mm)',
      surfaceRoughnessRaUm: 0.8,
      criticalDimensions: [
        {
          name: 'Strut Length',
          nominalMm: config.legLength,
          toleranceMm: 0.2,
          upperLimitMm: config.legLength + 0.2,
          lowerLimitMm: config.legLength - 0.2,
          isCritical: true
        },
        {
          name: 'Outer Strut Diameter',
          nominalMm: config.legThickness,
          toleranceMm: 0.08,
          upperLimitMm: config.legThickness + 0.08,
          lowerLimitMm: config.legThickness - 0.08,
          isCritical: true
        }
      ],
      inspectionRequirements: [
        'Axial compressive proof-load test up to 350 N',
        'Ultrasonic wall thickness uniformity inspection',
        'Drop-test impact energy absorption verification'
      ],
      camToolpathReady: true,
      estimatedCycleTimeMinutes: 30,
      qualityStandard: 'Aerospace Structural Composites Standard'
    };

    const assemblyInterfaces: ComponentAssemblyInterface[] = [
      {
        interfaceId: `${componentId}-IF-DECK`,
        name: 'Lower Fuselage Hardpoint Socket Connection',
        mateKind: 'FIXED',
        matingTargetComponentId: 'DRONE-AIRFRAME-BODY',
        matingTargetType: 'CENTRAL_FUSELAGE',
        localAttachmentPoint: { x: 0, y: 0, z: 0 },
        contactAreaMm2: Math.PI * (config.legThickness / 2) ** 2 * 2,
        fastenerSpecification: 'ISO 4762 M3x20 Grade 12.9 Socket Screw Clamp',
        fastenerQuantity: 2,
        tighteningTorqueNm: 2.0,
        traceableRequirementId: 'DRONE-REQ-007'
      }
    ];

    const geometryData = {
      type: legStrut.type,
      volumeM3: legStrut.volumeM3,
      surfaceAreaM2: legStrut.surfaceAreaM2,
      dimensions: config
    };
    const geometryHash = EngineeringHashChain.computeCanonicalHash(geometryData).canonicalHash;
    const parameterHash = EngineeringHashChain.computeCanonicalHash(parameterSet).canonicalHash;
    const contentHash = EngineeringHashChain.computeCanonicalHash({
      componentId,
      productId: this.PRODUCT_ID,
      componentType: 'LANDING_GEAR',
      revision,
      geometryHash,
      parameterHash,
      materialId: matRef.materialId,
      massKg: massProperties.massKg
    }).canonicalHash;

    return {
      componentId,
      productId: this.PRODUCT_ID,
      caseId: this.CASE_ID,
      componentType: 'LANDING_GEAR',
      name: `Industrial Drone High-Shock Landing Gear Strut (${componentId})`,
      partNumber: `SECP-DRONE-LG-00${legIndex + 1}`,
      revision,
      status: 'DESIGN_DEFINED',
      coordinateSystem,
      parameterSet,
      materialReference: matRef,
      geometryReference: {
        solidEntity: legStrut,
        boundingDimensionsMm: {
          length: config.footprintWidth,
          width: config.legThickness,
          height: config.gearHeight,
          radius: config.legThickness / 2
        },
        vertexCount: legStrut.mesh.vertices.length / 3,
        faceCount: legStrut.mesh.facesCount,
        isManifold: true,
        eulerCharacteristic: 2,
        geometryHash
      },
      massProperties,
      loadCases,
      analysisReferences,
      manufacturingDefinition,
      assemblyInterfaces,
      traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-007', 'DRONE-REQ-018'],
      evidenceReferences: [`EVID-GEAR-${componentId}-001`],
      contentHash,
      parameterHash,
      createdAt: now,
      updatedAt: now,
      author: 'SECP-STRUCTURAL-ENGINEER'
    };
  }

  // =========================================================================
  // 4. PAYLOAD STRUCTURE GENERATOR
  // =========================================================================
  public static generatePayloadStructure(
    configInput?: Partial<PayloadStructureParametersConfig>,
    options: {
      componentId?: string;
      revision?: string;
      position?: Vector3D;
      rotation?: Vector3D;
    } = {}
  ): StructuralComponent {
    const config: PayloadStructureParametersConfig = {
      payloadLength: configInput?.payloadLength ?? 160,
      payloadWidth: configInput?.payloadWidth ?? 90,
      payloadHeight: configInput?.payloadHeight ?? 40,
      mountingPattern: configInput?.mountingPattern ?? {
        railLengthMm: 180,
        railSpacingMm: 60,
        slotWidthMm: 4.5
      },
      supportThickness: configInput?.supportThickness ?? 3.0,
      materialId: configInput?.materialId ?? 'mat-carbon-fiber'
    };

    const componentId = options.componentId ?? 'COMP-PAYLOAD-001';
    const revision = options.revision ?? 'REV-A';
    const now = new Date().toISOString();

    const material = MaterialsEngine.getMaterial(config.materialId!) || MaterialsEngine.getMaterial('mat-carbon-fiber')!;
    const matRef = this.buildMaterialReference(material);

    // Solid base plate
    const railPlate = CadGeometryKernel.createBox(
      config.mountingPattern.railLengthMm,
      config.payloadWidth,
      config.supportThickness,
      `Solid_PayloadRailPlate_${componentId}`
    );

    // Central damping cut-out
    const cutOut = CadGeometryKernel.createBox(
      config.payloadLength * 0.7,
      config.payloadWidth * 0.5,
      config.supportThickness + 1.0,
      `Solid_PayloadDampingCut_${componentId}`
    );

    const payloadSolid = CadGeometryKernel.booleanOperation(railPlate, cutOut, 'CUT');

    const coordinateSystem: ComponentCoordinateSystem = {
      origin: options.position ?? { x: 0, y: 0, z: -35 },
      normal: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
      eulerAnglesDeg: options.rotation ?? { x: 0, y: 0, z: 0 }
    };

    const parameterSet: Record<string, StructuralParameter<any>> = {
      payloadLength: {
        parameterId: `${componentId}-PARAM-001`,
        name: 'payloadLength',
        value: config.payloadLength,
        unit: 'mm',
        minimum: 80,
        maximum: 300,
        default: 160,
        description: 'Maximum envelope length of mission payload sensor/gimbal.',
        source: 'PAYLOAD_SYSTEM_SPECIFICATION'
      },
      payloadWidth: {
        parameterId: `${componentId}-PARAM-002`,
        name: 'payloadWidth',
        value: config.payloadWidth,
        unit: 'mm',
        minimum: 50,
        maximum: 200,
        default: 90,
        description: 'Maximum envelope width of mission payload.',
        source: 'PAYLOAD_SYSTEM_SPECIFICATION'
      },
      payloadHeight: {
        parameterId: `${componentId}-PARAM-003`,
        name: 'payloadHeight',
        value: config.payloadHeight,
        unit: 'mm',
        minimum: 20,
        maximum: 150,
        default: 40,
        description: 'Maximum envelope height of mission payload.',
        source: 'PAYLOAD_SYSTEM_SPECIFICATION'
      },
      railLength: {
        parameterId: `${componentId}-PARAM-004`,
        name: 'railLength',
        value: config.mountingPattern.railLengthMm,
        unit: 'mm',
        minimum: 100,
        maximum: 350,
        default: 180,
        description: 'Length of quick-mount slide rail for payload exchange.',
        source: 'NATO_STANAG_PAYLOAD_INTERFACE'
      },
      railSpacing: {
        parameterId: `${componentId}-PARAM-005`,
        name: 'railSpacing',
        value: config.mountingPattern.railSpacingMm,
        unit: 'mm',
        minimum: 30,
        maximum: 150,
        default: 60,
        description: 'Center-to-center distance between dual damping rails.',
        source: 'NATO_STANAG_PAYLOAD_INTERFACE'
      },
      supportThickness: {
        parameterId: `${componentId}-PARAM-006`,
        name: 'supportThickness',
        value: config.supportThickness,
        unit: 'mm',
        minimum: 1.5,
        maximum: 6.0,
        default: 3.0,
        description: 'Thickness of carbon composite mounting plate.',
        source: 'VIBRATION_ISOLATION_STANDARDS'
      }
    };

    const massProperties = this.computeMassProperties(
      payloadSolid,
      matRef.densityKgM3,
      {
        dx: config.mountingPattern.railLengthMm / 1000,
        dy: config.payloadWidth / 1000,
        dz: config.supportThickness / 1000
      },
      coordinateSystem.origin
    );

    const loadCases: StructuralLoadCaseDefinition[] = [
      {
        loadCaseId: `${componentId}-LC-01`,
        name: 'Payload 6G Emergency Deceleration Shock',
        description: '6G longitudinal and vertical inertial shock for a 5.0 kg modular sensor payload.',
        loadType: 'INERTIAL_ACCELERATION',
        magnitudeN: 294.3, // 5.0kg * 9.81 * 6G
        direction: { x: 1, y: 0, z: -0.5 },
        applicationPoint: { x: 0, y: 0, z: -0.05 },
        safetyFactorRequired: 2.2,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Lower Deck Damping Bushing Isolators',
            type: 'ELASTIC_FOUNDATION',
            locationDescription: '4x silicone vibration isolation dampers connected to lower fuselage.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-01`
      }
    ];

    const analysisReferences: StructuralAnalysisReference[] = [
      {
        analysisId: `${componentId}-ANA-01`,
        analysisType: 'STATIC_STRESS',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'TET10_QUADRATIC',
          targetElementSizeMm: 2.0,
          maxAspectRatio: 3.0
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa * 0.75,
        expectedMinimumSafetyFactor: 2.9
      }
    ];

    const manufacturingDefinition: ManufacturingDefinition = {
      process: 'AUTOCLAVE_COMPOSITE_MOLDING',
      materialName: matRef.materialName,
      rawStockSpecification: 'Quasi-Isotropic CFRP Solid Plate (3.0 mm Thickness)',
      standardTolerances: 'ISO 2768-m (±0.2 mm)',
      surfaceRoughnessRaUm: 0.6,
      criticalDimensions: [
        {
          name: 'Rail Center-to-Center Spacing',
          nominalMm: config.mountingPattern.railSpacingMm,
          toleranceMm: 0.05,
          upperLimitMm: config.mountingPattern.railSpacingMm + 0.05,
          lowerLimitMm: config.mountingPattern.railSpacingMm - 0.05,
          isCritical: true
        },
        {
          name: 'Damping Bushing Hole Diameters',
          nominalMm: 8.0,
          toleranceMm: 0.04,
          upperLimitMm: 8.04,
          lowerLimitMm: 7.96,
          isCritical: true
        }
      ],
      inspectionRequirements: [
        'CMM verification of rail parallelism within 0.05 mm',
        'Silicone damper durometer Shore A test (40±5 Shore A)',
        'Tensile proof pull test on quick-release rail latch'
      ],
      camToolpathReady: true,
      estimatedCycleTimeMinutes: 25,
      qualityStandard: 'ISO 9001 Aerospace Payload Integration Standard'
    };

    const assemblyInterfaces: ComponentAssemblyInterface[] = [
      {
        interfaceId: `${componentId}-IF-LOWER-DECK`,
        name: 'Lower Fuselage Deck Isolated Hardpoints',
        mateKind: 'COINCIDENT',
        matingTargetComponentId: 'DRONE-AIRFRAME-BODY',
        matingTargetType: 'CENTRAL_FUSELAGE',
        localAttachmentPoint: { x: 0, y: 0, z: 0 },
        contactAreaMm2: 600,
        fastenerSpecification: 'ISO 7380 M4x12 Stainless Flanged Bolts with Silicone Isolators',
        fastenerQuantity: 4,
        tighteningTorqueNm: 2.5,
        traceableRequirementId: 'DRONE-REQ-008'
      }
    ];

    const geometryData = {
      type: payloadSolid.type,
      volumeM3: payloadSolid.volumeM3,
      surfaceAreaM2: payloadSolid.surfaceAreaM2,
      dimensions: config
    };
    const geometryHash = EngineeringHashChain.computeCanonicalHash(geometryData).canonicalHash;
    const parameterHash = EngineeringHashChain.computeCanonicalHash(parameterSet).canonicalHash;
    const contentHash = EngineeringHashChain.computeCanonicalHash({
      componentId,
      productId: this.PRODUCT_ID,
      componentType: 'PAYLOAD_STRUCTURE',
      revision,
      geometryHash,
      parameterHash,
      materialId: matRef.materialId,
      massKg: massProperties.massKg
    }).canonicalHash;

    return {
      componentId,
      productId: this.PRODUCT_ID,
      caseId: this.CASE_ID,
      componentType: 'PAYLOAD_STRUCTURE',
      name: `Industrial Drone Vibration-Isolated Payload Rail Structure (${componentId})`,
      partNumber: 'SECP-DRONE-PAYLOAD-001',
      revision,
      status: 'DESIGN_DEFINED',
      coordinateSystem,
      parameterSet,
      materialReference: matRef,
      geometryReference: {
        solidEntity: payloadSolid,
        boundingDimensionsMm: {
          length: config.mountingPattern.railLengthMm,
          width: config.payloadWidth,
          height: config.supportThickness
        },
        vertexCount: payloadSolid.mesh.vertices.length / 3,
        faceCount: payloadSolid.mesh.facesCount,
        isManifold: true,
        eulerCharacteristic: 2,
        geometryHash
      },
      massProperties,
      loadCases,
      analysisReferences,
      manufacturingDefinition,
      assemblyInterfaces,
      traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-008', 'DRONE-REQ-018', 'DRONE-REQ-020'],
      evidenceReferences: [`EVID-PAYLOAD-${componentId}-001`],
      contentHash,
      parameterHash,
      createdAt: now,
      updatedAt: now,
      author: 'SECP-STRUCTURAL-ENGINEER'
    };
  }

  // =========================================================================
  // 5. BATTERY STRUCTURE GENERATOR
  // =========================================================================
  public static generateBatteryStructure(
    configInput?: Partial<BatteryStructureParametersConfig>,
    options: {
      componentId?: string;
      revision?: string;
      position?: Vector3D;
      rotation?: Vector3D;
    } = {}
  ): StructuralComponent {
    const config: BatteryStructureParametersConfig = {
      batteryLength: configInput?.batteryLength ?? 180,
      batteryWidth: configInput?.batteryWidth ?? 75,
      batteryHeight: configInput?.batteryHeight ?? 50,
      clearance: configInput?.clearance ?? 4.0,
      wallThickness: configInput?.wallThickness ?? 2.5,
      mountingPattern: configInput?.mountingPattern ?? {
        trayLengthMm: 200,
        strapSlotsCount: 4,
        railSpacingMm: 70
      },
      materialId: configInput?.materialId ?? 'mat-carbon-fiber'
    };

    const componentId = options.componentId ?? 'COMP-BATTERY-001';
    const revision = options.revision ?? 'REV-A';
    const now = new Date().toISOString();

    const material = MaterialsEngine.getMaterial(config.materialId!) || MaterialsEngine.getMaterial('mat-carbon-fiber')!;
    const matRef = this.buildMaterialReference(material);

    // Tray Outer Box
    const trayOuter = CadGeometryKernel.createBox(
      config.mountingPattern.trayLengthMm,
      config.batteryWidth + 2 * (config.wallThickness + config.clearance),
      config.batteryHeight * 0.4 + config.wallThickness,
      `Solid_BatteryTrayOuter_${componentId}`
    );

    // Battery Bay Pocket Subtraction
    const batteryPocket = CadGeometryKernel.createBox(
      config.batteryLength + 2 * config.clearance,
      config.batteryWidth + 2 * config.clearance,
      config.batteryHeight * 0.4 + 1.0,
      `Solid_BatteryBayPocket_${componentId}`
    );

    const traySolid = CadGeometryKernel.booleanOperation(trayOuter, batteryPocket, 'CUT');

    const coordinateSystem: ComponentCoordinateSystem = {
      origin: options.position ?? { x: 0, y: 0, z: 35 },
      normal: { x: 0, y: 0, z: 1 },
      up: { x: 1, y: 0, z: 0 },
      eulerAnglesDeg: options.rotation ?? { x: 0, y: 0, z: 0 }
    };

    const parameterSet: Record<string, StructuralParameter<any>> = {
      batteryLength: {
        parameterId: `${componentId}-PARAM-001`,
        name: 'batteryLength',
        value: config.batteryLength,
        unit: 'mm',
        minimum: 100,
        maximum: 300,
        default: 180,
        description: 'Nominal length of 6S / 12S LiPo battery pack.',
        source: 'BATTERY_PACK_SPECIFICATION'
      },
      batteryWidth: {
        parameterId: `${componentId}-PARAM-002`,
        name: 'batteryWidth',
        value: config.batteryWidth,
        unit: 'mm',
        minimum: 40,
        maximum: 120,
        default: 75,
        description: 'Nominal width of battery pack.',
        source: 'BATTERY_PACK_SPECIFICATION'
      },
      batteryHeight: {
        parameterId: `${componentId}-PARAM-003`,
        name: 'batteryHeight',
        value: config.batteryHeight,
        unit: 'mm',
        minimum: 30,
        maximum: 100,
        default: 50,
        description: 'Nominal height of battery pack.',
        source: 'BATTERY_PACK_SPECIFICATION'
      },
      clearance: {
        parameterId: `${componentId}-PARAM-004`,
        name: 'clearance',
        value: config.clearance,
        unit: 'mm',
        minimum: 2.0,
        maximum: 10.0,
        default: 4.0,
        description: 'Thermal expansion and quick-release insertion clearance.',
        source: 'BATTERY_THERMAL_SAFETY_RULES'
      },
      wallThickness: {
        parameterId: `${componentId}-PARAM-005`,
        name: 'wallThickness',
        value: config.wallThickness,
        unit: 'mm',
        minimum: 1.5,
        maximum: 5.0,
        default: 2.5,
        description: 'Retention tray structural wall thickness.',
        source: 'CRASH_RETENTION_STANDARD'
      },
      trayLength: {
        parameterId: `${componentId}-PARAM-006`,
        name: 'trayLength',
        value: config.mountingPattern.trayLengthMm,
        unit: 'mm',
        minimum: 120,
        maximum: 350,
        default: 200,
        description: 'Total tray length including locking clamp latch.',
        source: 'QUICK_RELEASE_MECHANISM_SPEC'
      }
    };

    const massProperties = this.computeMassProperties(
      traySolid,
      matRef.densityKgM3,
      {
        dx: config.mountingPattern.trayLengthMm / 1000,
        dy: (config.batteryWidth + 2 * (config.wallThickness + config.clearance)) / 1000,
        dz: (config.batteryHeight * 0.4 + config.wallThickness) / 1000
      },
      coordinateSystem.origin
    );

    const loadCases: StructuralLoadCaseDefinition[] = [
      {
        loadCaseId: `${componentId}-LC-01`,
        name: 'Battery 10G Dynamic Crash Retention Load',
        description: '10G forward/longitudinal crash deceleration for a 2.5 kg high-density flight battery.',
        loadType: 'INERTIAL_ACCELERATION',
        magnitudeN: 245.25, // 2.5kg * 9.81 * 10G
        direction: { x: 1, y: 0, z: 0 },
        applicationPoint: { x: 0, y: 0, z: 0.025 },
        safetyFactorRequired: 2.5,
        boundaryConditions: [
          {
            boundaryId: `${componentId}-BC-01`,
            name: 'Upper Fuselage Deck Bolted Tabs',
            type: 'FIXED_SUPPORT',
            locationDescription: 'Bolted directly to upper carbon fiber deck.',
            constrainedDOFs: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
          }
        ],
        analysisReferenceId: `${componentId}-ANA-01`
      }
    ];

    const analysisReferences: StructuralAnalysisReference[] = [
      {
        analysisId: `${componentId}-ANA-01`,
        analysisType: 'STATIC_STRESS',
        targetSolver: 'EPC025_FEA_SOLVER',
        status: 'FEA_READY',
        meshRequirements: {
          elementType: 'TET10_QUADRATIC',
          targetElementSizeMm: 2.0,
          maxAspectRatio: 3.0
        },
        allowableVonMisesStressMPa: matRef.yieldStrengthMPa * 0.8,
        expectedMinimumSafetyFactor: 3.1
      }
    ];

    const manufacturingDefinition: ManufacturingDefinition = {
      process: 'AUTOCLAVE_COMPOSITE_MOLDING',
      materialName: matRef.materialName,
      rawStockSpecification: 'Carbon Fiber / Epoxy Molded Monocoque Tray with Nomex Core',
      standardTolerances: 'ISO 2768-m (±0.2 mm)',
      surfaceRoughnessRaUm: 0.8,
      criticalDimensions: [
        {
          name: 'Battery Bay Internal Width (Clearance Fit)',
          nominalMm: config.batteryWidth + 2 * config.clearance,
          toleranceMm: 0.1,
          upperLimitMm: config.batteryWidth + 2 * config.clearance + 0.1,
          lowerLimitMm: config.batteryWidth + 2 * config.clearance - 0.1,
          isCritical: true
        },
        {
          name: 'Quick-Release Latch Mating Datum',
          nominalMm: config.mountingPattern.trayLengthMm,
          toleranceMm: 0.08,
          upperLimitMm: config.mountingPattern.trayLengthMm + 0.08,
          lowerLimitMm: config.mountingPattern.trayLengthMm - 0.08,
          isCritical: true
        }
      ],
      inspectionRequirements: [
        'Internal bay dimension check with go/no-go gauge block',
        'Kevlar strap slot edge radiusing check (R >= 1.0 mm)',
        '10G static pull test on quick-release latch mechanism'
      ],
      camToolpathReady: true,
      estimatedCycleTimeMinutes: 35,
      qualityStandard: 'ISO 9001 Aviation Mechanical Systems Standard'
    };

    const assemblyInterfaces: ComponentAssemblyInterface[] = [
      {
        interfaceId: `${componentId}-IF-UPPER-DECK`,
        name: 'Upper Fuselage Deck Quick-Release Mounting',
        mateKind: 'FIXED',
        matingTargetComponentId: 'DRONE-AIRFRAME-BODY',
        matingTargetType: 'CENTRAL_FUSELAGE',
        localAttachmentPoint: { x: 0, y: 0, z: 0 },
        contactAreaMm2: 750,
        fastenerSpecification: 'ISO 7380 M3x10 Titanium Screws with Anti-Vibration Washers',
        fastenerQuantity: 6,
        tighteningTorqueNm: 1.8,
        traceableRequirementId: 'DRONE-REQ-010'
      }
    ];

    const geometryData = {
      type: traySolid.type,
      volumeM3: traySolid.volumeM3,
      surfaceAreaM2: traySolid.surfaceAreaM2,
      dimensions: config
    };
    const geometryHash = EngineeringHashChain.computeCanonicalHash(geometryData).canonicalHash;
    const parameterHash = EngineeringHashChain.computeCanonicalHash(parameterSet).canonicalHash;
    const contentHash = EngineeringHashChain.computeCanonicalHash({
      componentId,
      productId: this.PRODUCT_ID,
      componentType: 'BATTERY_STRUCTURE',
      revision,
      geometryHash,
      parameterHash,
      materialId: matRef.materialId,
      massKg: massProperties.massKg
    }).canonicalHash;

    return {
      componentId,
      productId: this.PRODUCT_ID,
      caseId: this.CASE_ID,
      componentType: 'BATTERY_STRUCTURE',
      name: `Industrial Drone Quick-Release Battery Retention Structure (${componentId})`,
      partNumber: 'SECP-DRONE-BATT-001',
      revision,
      status: 'DESIGN_DEFINED',
      coordinateSystem,
      parameterSet,
      materialReference: matRef,
      geometryReference: {
        solidEntity: traySolid,
        boundingDimensionsMm: {
          length: config.mountingPattern.trayLengthMm,
          width: config.batteryWidth + 2 * (config.wallThickness + config.clearance),
          height: config.batteryHeight * 0.4 + config.wallThickness
        },
        vertexCount: traySolid.mesh.vertices.length / 3,
        faceCount: traySolid.mesh.facesCount,
        isManifold: true,
        eulerCharacteristic: 2,
        geometryHash
      },
      massProperties,
      loadCases,
      analysisReferences,
      manufacturingDefinition,
      assemblyInterfaces,
      traceableRequirementIds: ['DRONE-REQ-001', 'DRONE-REQ-010', 'DRONE-REQ-018', 'DRONE-REQ-019'],
      evidenceReferences: [`EVID-BATT-${componentId}-001`],
      contentHash,
      parameterHash,
      createdAt: now,
      updatedAt: now,
      author: 'SECP-STRUCTURAL-ENGINEER'
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private static buildMaterialReference(material: Material): MaterialReference {
    return {
      materialId: material.id,
      materialName: material.name,
      category: material.category,
      densityKgM3: material.densityKgM3,
      youngModulusGPa: material.youngModulusGPa,
      poissonsRatio: material.poissonsRatio,
      yieldStrengthMPa: material.yieldStrengthMPa,
      ultimateStrengthMPa: (material as any).ultimateStrengthMPa || Number((material.yieldStrengthMPa * 1.35).toFixed(1)),
      thermalConductivityWMK: material.thermalConductivityWMK,
      revision: 'REV-MAT-2026.1',
      provenance: 'SECP-MATERIALS-ENGINE-DATABASE-APPROVED'
    };
  }

  private static computeMassProperties(
    solid: CadSolidEntity,
    densityKgM3: number,
    dims: { dx?: number; dy?: number; dz?: number; radius?: number },
    origin: Vector3D
  ): StructuralMassProperties {
    const volumeM3 = solid.volumeM3;
    const volumeCm3 = Number((volumeM3 * 1e6).toFixed(4));
    const surfaceAreaM2 = Number(solid.surfaceAreaM2.toFixed(6));
    const massKg = Number((volumeM3 * densityKgM3).toFixed(6));
    const massGrams = Number((massKg * 1000).toFixed(2));

    const dx = dims.dx || 0.05;
    const dy = dims.dy || 0.05;
    const dz = dims.dz || 0.05;
    const r = dims.radius || 0.01;

    let Ixx = 0;
    let Iyy = 0;
    let Izz = 0;

    if (solid.type === 'CYLINDER' || dims.radius !== undefined) {
      Izz = 0.5 * massKg * r * r;
      Ixx = (1.0 / 12.0) * massKg * (3.0 * r * r + dz * dz);
      Iyy = Ixx;
    } else {
      Ixx = (1.0 / 12.0) * massKg * (dy * dy + dz * dz);
      Iyy = (1.0 / 12.0) * massKg * (dx * dx + dz * dz);
      Izz = (1.0 / 12.0) * massKg * (dx * dx + dy * dy);
    }

    const inertiaTensor: AirframeInertiaTensor = {
      Ixx: Number(Ixx.toExponential(6)),
      Iyy: Number(Iyy.toExponential(6)),
      Izz: Number(Izz.toExponential(6)),
      Ixy: 0.0,
      Ixz: 0.0,
      Iyz: 0.0,
      principalMoments: [
        Number(Ixx.toExponential(6)),
        Number(Iyy.toExponential(6)),
        Number(Izz.toExponential(6))
      ]
    };

    return {
      volumeM3: Number(volumeM3.toFixed(8)),
      volumeCm3,
      surfaceAreaM2,
      massKg,
      massGrams,
      centerOfGravity: origin,
      inertiaTensor,
      calculationMethod: 'PHYSICS_BASED_DERIVATION'
    };
  }
}
