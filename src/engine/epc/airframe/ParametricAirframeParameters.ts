/**
 * SECP Industrial OS — EPC-019: Parametric Airframe Parameters & Dependency Graph
 * Defines strict engineering parameters, engineering design limits, and dependency propagation DAG.
 */

import {
  AirframeParameter,
  DesignLimitDefinition,
  ParameterDependencyGraph,
  ParameterDependencyNode,
  ParametricAirframeConfig
} from './ParametricAirframeTypes';

export class ParametricAirframeParameters {
  public static readonly DEFAULT_CONFIG: ParametricAirframeConfig = Object.freeze({
    bodyLength: 240.0, // mm
    bodyWidth: 240.0, // mm
    bodyHeight: 55.0, // mm
    bodyPlateThickness: 2.5, // mm

    armCount: 4,
    armLength: 320.0, // mm
    armWidth: 30.0, // mm
    armThickness: 3.0, // mm (wall/plate thickness)
    armOffsetZ: 0.0, // mm

    motorMountDiameter: 45.0, // mm
    motorMountThickness: 4.0, // mm
    motorMountOffset: 15.0, // mm

    payloadMountLength: 180.0, // mm
    payloadMountWidth: 120.0, // mm
    payloadMountHeight: 30.0, // mm
    payloadClearance: 15.0, // mm

    batteryMountLength: 200.0, // mm
    batteryMountWidth: 95.0, // mm
    batteryMountHeight: 25.0, // mm
    batteryClearance: 10.0, // mm

    landingGearMountSpacing: 160.0, // mm
    landingGearMountDiameter: 16.0, // mm

    structuralClearance: 5.0, // mm
    fastenerDiameter: 3.0, // mm (M3 hardware)
    bodyMaterialId: 'mat-carbon-fiber',
    armMaterialId: 'mat-carbon-fiber',
    mountMaterialId: 'mat-alu-6061'
  });

  /**
   * Engineering Design Limits conforming to aerospace structural guidelines.
   */
  public static readonly DESIGN_LIMITS: readonly DesignLimitDefinition[] = Object.freeze([
    {
      limitId: 'LIM-ARM-001',
      parameterName: 'ArmThickness',
      constraintType: 'STRUCTURAL',
      value: 1.5,
      unit: 'mm',
      description: 'Minimum arm composite wall thickness to prevent local buckling under peak thrust load.',
      source: 'DRONE-REQ-008 (Airframe Rigidity & Strength)'
    },
    {
      limitId: 'LIM-ARM-002',
      parameterName: 'ArmLength',
      constraintType: 'GEOMETRIC',
      value: 650.0,
      unit: 'mm',
      description: 'Maximum allowable arm cantilever length for structural deflection threshold < 2.0 mm.',
      source: 'DRONE-REQ-008 (Aeroelastic Deflection Limit)'
    },
    {
      limitId: 'LIM-ARM-003',
      parameterName: 'ArmThicknessRatio',
      constraintType: 'GEOMETRIC',
      value: 1.0,
      unit: 'ratio',
      description: 'Arm thickness must strictly be strictly less than Arm width (ArmThickness < ArmWidth).',
      source: 'CAD-RULE-ARM-CROSS-SECTION'
    },
    {
      limitId: 'LIM-CLR-001',
      parameterName: 'StructuralClearance',
      constraintType: 'CLEARANCE',
      value: 1.5,
      unit: 'mm',
      description: 'Minimum clearance between moving parts, wiring conduits, and composite bulkheads.',
      source: 'DRONE-REQ-005 (Mechanical Integration Clearance)'
    },
    {
      limitId: 'LIM-MMT-001',
      parameterName: 'MotorMountThickness',
      constraintType: 'STRUCTURAL',
      value: 2.0,
      unit: 'mm',
      description: 'Minimum motor mount plate thickness to withstand motor torque reaction forces.',
      source: 'DRONE-REQ-008 (Motor Fastening Torque Retention)'
    },
    {
      limitId: 'LIM-MMT-002',
      parameterName: 'MotorMountDiameter',
      constraintType: 'MANUFACTURING',
      value: 20.0,
      unit: 'mm',
      description: 'Minimum motor mount bolt circle diameter for industrial brushless motors.',
      source: 'DRONE-REQ-018 (Motor Mount Standard Interface)'
    },
    {
      limitId: 'LIM-BAT-001',
      parameterName: 'BatteryClearance',
      constraintType: 'CLEARANCE',
      value: 3.0,
      unit: 'mm',
      description: 'Minimum clearance around battery pack to prevent abrasion and accommodate thermal expansion.',
      source: 'DRONE-REQ-006 (Battery Enclosure Safety)'
    },
    {
      limitId: 'LIM-PAY-001',
      parameterName: 'PayloadClearance',
      constraintType: 'CLEARANCE',
      value: 5.0,
      unit: 'mm',
      description: 'Minimum vertical clearance for gimbal pitch/roll rotation envelope.',
      source: 'DRONE-REQ-007 (Payload Gimbal Articulation Envelope)'
    }
  ]);

  /**
   * Generates the canonical parameter set from a configuration object.
   */
  public static createParameters(config: Partial<ParametricAirframeConfig> = {}, revision = '1.0'): Record<string, AirframeParameter<any>> {
    const cfg: ParametricAirframeConfig = { ...this.DEFAULT_CONFIG, ...config };

    return {
      BodyLength: {
        parameterId: 'PARAM-AIR-001',
        name: 'BodyLength',
        value: cfg.bodyLength,
        unit: 'mm',
        minimum: 100.0,
        maximum: 600.0,
        default: this.DEFAULT_CONFIG.bodyLength,
        description: 'Length of central body composite deck along the longitudinal X-axis.',
        source: 'DRONE-REQ-005',
        revision
      },
      BodyWidth: {
        parameterId: 'PARAM-AIR-002',
        name: 'BodyWidth',
        value: cfg.bodyWidth,
        unit: 'mm',
        minimum: 100.0,
        maximum: 600.0,
        default: this.DEFAULT_CONFIG.bodyWidth,
        description: 'Width of central body composite deck along the lateral Y-axis.',
        source: 'DRONE-REQ-005',
        revision
      },
      BodyHeight: {
        parameterId: 'PARAM-AIR-003',
        name: 'BodyHeight',
        value: cfg.bodyHeight,
        unit: 'mm',
        minimum: 20.0,
        maximum: 200.0,
        default: this.DEFAULT_CONFIG.bodyHeight,
        description: 'Internal vertical height separation between upper and lower deck plates along Z-axis.',
        source: 'DRONE-REQ-005',
        revision
      },
      BodyPlateThickness: {
        parameterId: 'PARAM-AIR-004',
        name: 'BodyPlateThickness',
        value: cfg.bodyPlateThickness,
        unit: 'mm',
        minimum: 1.0,
        maximum: 10.0,
        default: this.DEFAULT_CONFIG.bodyPlateThickness,
        description: 'Nominal plate thickness of CNC carbon fiber fuselage upper/lower decks.',
        source: 'DRONE-REQ-008',
        revision
      },
      ArmCount: {
        parameterId: 'PARAM-AIR-005',
        name: 'ArmCount',
        value: cfg.armCount,
        unit: 'count',
        minimum: 3,
        maximum: 12,
        default: this.DEFAULT_CONFIG.armCount,
        description: 'Total number of radial airframe arms (e.g., 4 for Quad, 6 for Hexa, 8 for Octo).',
        source: 'DRONE-REQ-001',
        revision
      },
      ArmLength: {
        parameterId: 'PARAM-AIR-006',
        name: 'ArmLength',
        value: cfg.armLength,
        unit: 'mm',
        minimum: 100.0,
        maximum: 650.0,
        default: this.DEFAULT_CONFIG.armLength,
        description: 'Radial cantilever length of each arm from body interface to motor mount center.',
        source: 'DRONE-REQ-018',
        revision
      },
      ArmWidth: {
        parameterId: 'PARAM-AIR-007',
        name: 'ArmWidth',
        value: cfg.armWidth,
        unit: 'mm',
        minimum: 10.0,
        maximum: 80.0,
        default: this.DEFAULT_CONFIG.armWidth,
        description: 'Transverse outer width/diameter of arm structural beam.',
        source: 'DRONE-REQ-008',
        revision
      },
      ArmThickness: {
        parameterId: 'PARAM-AIR-008',
        name: 'ArmThickness',
        value: cfg.armThickness,
        unit: 'mm',
        minimum: 1.5,
        maximum: 40.0,
        default: this.DEFAULT_CONFIG.armThickness,
        description: 'Wall thickness of tubular arm or composite arm profile.',
        source: 'DRONE-REQ-008',
        revision
      },
      MotorMountDiameter: {
        parameterId: 'PARAM-AIR-009',
        name: 'MotorMountDiameter',
        value: cfg.motorMountDiameter,
        unit: 'mm',
        minimum: 20.0,
        maximum: 120.0,
        default: this.DEFAULT_CONFIG.motorMountDiameter,
        description: 'Outer diameter of CNC aluminum motor mounting disc.',
        source: 'DRONE-REQ-018',
        revision
      },
      MotorMountThickness: {
        parameterId: 'PARAM-AIR-010',
        name: 'MotorMountThickness',
        value: cfg.motorMountThickness,
        unit: 'mm',
        minimum: 2.0,
        maximum: 15.0,
        default: this.DEFAULT_CONFIG.motorMountThickness,
        description: 'Plate thickness of aluminum motor mounting flange.',
        source: 'DRONE-REQ-008',
        revision
      },
      MotorMountOffset: {
        parameterId: 'PARAM-AIR-011',
        name: 'MotorMountOffset',
        value: cfg.motorMountOffset,
        unit: 'mm',
        minimum: 0.0,
        maximum: 50.0,
        default: this.DEFAULT_CONFIG.motorMountOffset,
        description: 'Radial overhang offset of motor mount beyond the arm beam end.',
        source: 'DRONE-REQ-018',
        revision
      },
      PayloadMountLength: {
        parameterId: 'PARAM-AIR-012',
        name: 'PayloadMountLength',
        value: cfg.payloadMountLength,
        unit: 'mm',
        minimum: 50.0,
        maximum: 400.0,
        default: this.DEFAULT_CONFIG.payloadMountLength,
        description: 'Length of payload damping rail / quick-release bracket.',
        source: 'DRONE-REQ-007',
        revision
      },
      PayloadMountWidth: {
        parameterId: 'PARAM-AIR-013',
        name: 'PayloadMountWidth',
        value: cfg.payloadMountWidth,
        unit: 'mm',
        minimum: 40.0,
        maximum: 300.0,
        default: this.DEFAULT_CONFIG.payloadMountWidth,
        description: 'Width spacing between dual payload rail mounting hardpoints.',
        source: 'DRONE-REQ-007',
        revision
      },
      PayloadMountHeight: {
        parameterId: 'PARAM-AIR-014',
        name: 'PayloadMountHeight',
        value: cfg.payloadMountHeight,
        unit: 'mm',
        minimum: 10.0,
        maximum: 100.0,
        default: this.DEFAULT_CONFIG.payloadMountHeight,
        description: 'Height profile of payload vibration isolation mechanism.',
        source: 'DRONE-REQ-007',
        revision
      },
      BatteryMountLength: {
        parameterId: 'PARAM-AIR-015',
        name: 'BatteryMountLength',
        value: cfg.batteryMountLength,
        unit: 'mm',
        minimum: 80.0,
        maximum: 400.0,
        default: this.DEFAULT_CONFIG.batteryMountLength,
        description: 'Length of battery sliding tray retaining composite sled.',
        source: 'DRONE-REQ-006',
        revision
      },
      BatteryMountWidth: {
        parameterId: 'PARAM-AIR-016',
        name: 'BatteryMountWidth',
        value: cfg.batteryMountWidth,
        unit: 'mm',
        minimum: 40.0,
        maximum: 200.0,
        default: this.DEFAULT_CONFIG.batteryMountWidth,
        description: 'Width of battery retention cradle.',
        source: 'DRONE-REQ-006',
        revision
      },
      BatteryMountHeight: {
        parameterId: 'PARAM-AIR-017',
        name: 'BatteryMountHeight',
        value: cfg.batteryMountHeight,
        unit: 'mm',
        minimum: 10.0,
        maximum: 100.0,
        default: this.DEFAULT_CONFIG.batteryMountHeight,
        description: 'Height clearance of battery latch retention mechanism.',
        source: 'DRONE-REQ-006',
        revision
      },
      LandingGearMountPosition: {
        parameterId: 'PARAM-AIR-018',
        name: 'LandingGearMountPosition',
        value: cfg.landingGearMountSpacing,
        unit: 'mm',
        minimum: 50.0,
        maximum: 400.0,
        default: this.DEFAULT_CONFIG.landingGearMountSpacing,
        description: 'Spacing radius of 4x landing gear structural mounting sockets.',
        source: 'DRONE-REQ-020',
        revision
      },
      StructuralClearance: {
        parameterId: 'PARAM-AIR-019',
        name: 'StructuralClearance',
        value: cfg.structuralClearance,
        unit: 'mm',
        minimum: 1.5,
        maximum: 30.0,
        default: this.DEFAULT_CONFIG.structuralClearance,
        description: 'Minimum global mechanical clearance envelope.',
        source: 'DRONE-REQ-005',
        revision
      },
      FastenerDiameter: {
        parameterId: 'PARAM-AIR-020',
        name: 'FastenerDiameter',
        value: cfg.fastenerDiameter,
        unit: 'mm',
        minimum: 2.0,
        maximum: 8.0,
        default: this.DEFAULT_CONFIG.fastenerDiameter,
        description: 'Standard structural fastener thread diameter (M2, M3, M4, etc.).',
        source: 'DRONE-REQ-008',
        revision
      },
      MaterialReference: {
        parameterId: 'PARAM-AIR-021',
        name: 'MaterialReference',
        value: cfg.bodyMaterialId,
        unit: 'material_id',
        default: this.DEFAULT_CONFIG.bodyMaterialId,
        description: 'Primary structural material identifier referencing SECP MaterialsEngine.',
        source: 'DRONE-REQ-008',
        revision
      }
    };
  }

  /**
   * Constructs the inspectable Parameter Dependency Graph.
   */
  public static buildDependencyGraph(): ParameterDependencyGraph {
    const nodes: ParameterDependencyNode[] = [
      {
        parameterId: 'PARAM-AIR-001',
        parameterName: 'BodyLength',
        dependsOn: [],
        impacts: ['ArmAttachmentPosition', 'PayloadMountLength', 'BatteryMountLength', 'BodyDeckVolume'],
        formulaDescription: 'Central fuselage longitudinal span defining deck area and hardpoint placement.'
      },
      {
        parameterId: 'PARAM-AIR-002',
        parameterName: 'BodyWidth',
        dependsOn: [],
        impacts: ['ArmAttachmentPosition', 'PayloadMountWidth', 'BatteryMountWidth', 'BodyDeckVolume'],
        formulaDescription: 'Central fuselage lateral span governing arm knuckle radius and internal bay width.'
      },
      {
        parameterId: 'PARAM-AIR-003',
        parameterName: 'BodyHeight',
        dependsOn: [],
        impacts: ['InternalAvionicsVolume', 'PayloadClearance', 'BatteryClearance'],
        formulaDescription: 'Vertical deck spacing governing internal payload/battery bay height envelope.'
      },
      {
        parameterId: 'PARAM-AIR-004',
        parameterName: 'BodyPlateThickness',
        dependsOn: [],
        impacts: ['BodyStructuralStiffness', 'CentralFuselageMass'],
        formulaDescription: 'Nominal carbon fiber deck plate thickness.'
      },
      {
        parameterId: 'PARAM-AIR-005',
        parameterName: 'ArmCount',
        dependsOn: [],
        impacts: ['ArmAngularDistribution', 'TotalThrustGeneration', 'MotorPositions', 'TotalAirframeMass'],
        formulaDescription: 'Discrete arm count determining radial symmetry angles: theta_i = (2*PI*i)/ArmCount + PI/4.'
      },
      {
        parameterId: 'PARAM-AIR-006',
        parameterName: 'ArmLength',
        dependsOn: ['BodyLength', 'BodyWidth'],
        impacts: ['MotorPosition', 'PropellerClearance', 'ArmDeflection', 'ArmMass', 'AirframeInertia'],
        formulaDescription: 'Arm span setting motor radius R_motor = R_body_attach + ArmLength + MotorMountOffset.'
      },
      {
        parameterId: 'PARAM-AIR-007',
        parameterName: 'ArmWidth',
        dependsOn: [],
        impacts: ['ArmStructuralStiffness', 'ArmMass', 'FastenerDiameter'],
        formulaDescription: 'Arm cross-sectional width governing bending stiffness I_yy.'
      },
      {
        parameterId: 'PARAM-AIR-008',
        parameterName: 'ArmThickness',
        dependsOn: ['ArmWidth'],
        impacts: ['ArmSectionModulus', 'ArmMass', 'BucklingSafetyMargin'],
        formulaDescription: 'Arm wall thickness constrained by ArmThickness < ArmWidth.'
      },
      {
        parameterId: 'PARAM-AIR-009',
        parameterName: 'MotorMountDiameter',
        dependsOn: [],
        impacts: ['MotorMountArea', 'MotorStatorClearance', 'MotorMountMass'],
        formulaDescription: 'Motor bracket bolt pattern circle diameter.'
      },
      {
        parameterId: 'PARAM-AIR-010',
        parameterName: 'MotorMountThickness',
        dependsOn: ['MotorMountDiameter'],
        impacts: ['MotorMountDeflection', 'MotorMountMass'],
        formulaDescription: 'CNC aluminum plate thickness resisting motor pitch/roll dynamic torque.'
      },
      {
        parameterId: 'PARAM-AIR-011',
        parameterName: 'MotorMountOffset',
        dependsOn: ['ArmLength'],
        impacts: ['MotorPosition', 'TipVorticesClearance'],
        formulaDescription: 'Radial offset of motor centerline relative to arm tip.'
      },
      {
        parameterId: 'PARAM-AIR-012',
        parameterName: 'PayloadMountLength',
        dependsOn: ['BodyLength'],
        impacts: ['PayloadInterfaceArea', 'GimbalMountStability'],
        formulaDescription: 'Payload rail length constrained by BodyLength.'
      },
      {
        parameterId: 'PARAM-AIR-013',
        parameterName: 'PayloadMountWidth',
        dependsOn: ['BodyWidth'],
        impacts: ['PayloadInterfaceWidth'],
        formulaDescription: 'Payload rail width constrained by BodyWidth.'
      },
      {
        parameterId: 'PARAM-AIR-014',
        parameterName: 'PayloadMountHeight',
        dependsOn: [],
        impacts: ['PayloadRailMass', 'GimbalDropHeight'],
        formulaDescription: 'Payload damping rail height profile.'
      },
      {
        parameterId: 'PARAM-AIR-015',
        parameterName: 'BatteryMountLength',
        dependsOn: ['BodyLength'],
        impacts: ['BatteryTrayArea', 'BatteryRetentionCapacity'],
        formulaDescription: 'Battery tray length constrained by BodyLength.'
      },
      {
        parameterId: 'PARAM-AIR-016',
        parameterName: 'BatteryMountWidth',
        dependsOn: ['BodyWidth'],
        impacts: ['BatteryTrayWidth'],
        formulaDescription: 'Battery sled tray width profile.'
      },
      {
        parameterId: 'PARAM-AIR-017',
        parameterName: 'BatteryMountHeight',
        dependsOn: [],
        impacts: ['BatteryTrayHeight'],
        formulaDescription: 'Battery tray side flange retention height.'
      },
      {
        parameterId: 'PARAM-AIR-018',
        parameterName: 'LandingGearMountPosition',
        dependsOn: ['BodyLength', 'BodyWidth'],
        impacts: ['LandingStabilityFootprint', 'DropLoadTransfer'],
        formulaDescription: 'Hardpoint radius R_lg = min(BodyLength, BodyWidth) * 0.35.'
      },
      {
        parameterId: 'PARAM-AIR-019',
        parameterName: 'StructuralClearance',
        dependsOn: [],
        impacts: ['InternalPackagingEnvelope', 'WireRoutingSafety'],
        formulaDescription: 'Minimum global safety clearance envelope.'
      },
      {
        parameterId: 'PARAM-AIR-020',
        parameterName: 'FastenerDiameter',
        dependsOn: ['ArmWidth'],
        impacts: ['FastenerShearStrength', 'ClampForce'],
        formulaDescription: 'Standard fastener thread diameter for structural joints.'
      },
      {
        parameterId: 'PARAM-AIR-021',
        parameterName: 'MaterialReference',
        dependsOn: [],
        impacts: ['TotalAirframeMass', 'CenterOfGravity', 'InertiaTensor', 'StructuralRigidity'],
        formulaDescription: 'Material selection in MaterialsEngine providing density and elastic modulus.'
      }
    ];

    const evaluationOrder = [
      'BodyLength',
      'BodyWidth',
      'BodyHeight',
      'BodyPlateThickness',
      'ArmCount',
      'ArmWidth',
      'ArmThickness',
      'ArmLength',
      'MotorMountDiameter',
      'MotorMountThickness',
      'MotorMountOffset',
      'PayloadMountLength',
      'PayloadMountWidth',
      'PayloadMountHeight',
      'BatteryMountLength',
      'BatteryMountWidth',
      'BatteryMountHeight',
      'LandingGearMountPosition',
      'StructuralClearance',
      'FastenerDiameter',
      'MaterialReference'
    ];

    return {
      graphId: 'DEP-GRAPH-AIRFRAME-001',
      nodes,
      evaluationOrder,
      hasCycles: false
    };
  }
}
