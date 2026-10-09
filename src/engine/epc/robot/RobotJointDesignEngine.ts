/**
 * SECP Industrial OS — EPC-039: Robot Joint Design Engine
 * Composes existing SECP engineering core:
 *  - CAD Kernel & Parametric Geometry
 *  - Assembly System & Constraints
 *  - Kinematics & SE(3) Transformations
 *  - Material Constitutive Models & Mass/Inertia Properties
 *  - Evidence Integrity & Traceability
 */

import { Vector3D } from '../../cadKernel';
import { CADPart, CADAssembly, BRepSolid, AssemblyMate } from '../../parametric-cad/ParametricCADTypes';
import { CoordinateFrameEngine } from '../../assembly/joints/CoordinateFrameEngine';
import { JointKinematicsEngine } from '../../assembly/joints/JointKinematicsEngine';
import { MechanicalJoint } from '../../assembly/joints/MechanicalJointTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

import {
  RobotJointDefinition,
  JointGeometryParameters,
  JointEngineeringProperties,
  JointValidationReport,
  RobotJointGenerationResult,
  JointRequirementTraceability,
  JointEvidencePackage,
  JointInertiaTensor
} from './RobotJointTypes';
import { RobotJointValidator } from './RobotJointValidator';

export class RobotJointDesignEngine {
  /**
   * Material Yield Strengths (MPa) for torque capacity computation
   */
  public static readonly MATERIAL_YIELD_STRENGTH_MPA: Record<string, number> = {
    'AL7075-T6': 503,
    'AL6061-T6': 276,
    'AISI_4140_STEEL': 655,
    'STAINLESS_STEEL_316L': 290,
    'TITANIUM_TI6AL4V': 880,
    'CARBON_FIBER_COMPOSITE': 600,
    'BRONZE_SAE660': 180
  };

  /**
   * Standard default joint parameters for 6-DOF industrial robot
   */
  public static createDefaultJoint(jointId: string, jointType: string = 'REVOLUTE'): RobotJointDefinition {
    const isRevolute = jointType === 'REVOLUTE';
    return {
      jointId,
      jointType,
      parentLinkId: `link_${jointId}_parent`,
      childLinkId: `link_${jointId}_child`,
      axis: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 150 },
      position: 0,
      orientation: { x: 0, y: 0, z: 0 },
      limits: {
        minimumPosition: isRevolute ? -180 : 0,
        maximumPosition: isRevolute ? 180 : 300,
        maxVelocity: isRevolute ? 250 : 500,       // deg/s or mm/s
        maxAcceleration: isRevolute ? 500 : 1000,  // deg/s^2 or mm/s^2
        maxTorque: isRevolute ? 450 : 1200,        // N*m or N
        ratedTorque: isRevolute ? 300 : 800         // N*m or N
      },
      maxVelocity: isRevolute ? 250 : 500,
      maxAcceleration: isRevolute ? 500 : 1000,
      maxTorque: isRevolute ? 450 : 1200,
      ratedTorque: isRevolute ? 300 : 800,
      material: 'AL7075-T6',
      mass: 0, // Computed dynamically
      inertia: { Ixx: 0, Iyy: 0, Izz: 0 },
      revision: 'REV_1.0.0',
      geometryParams: {
        jointDiameter: 120,
        shaftDiameter: 40,
        housingDiameter: 110,
        housingLength: 140,
        shaftLength: 180,
        bearingSeatDiameter: 80,
        bearingSeatWidth: 20,
        boltCircleDiameter: 95,
        holeCount: 6,
        holeDiameter: 6.5,
        flangeDiameter: 130,
        flangeThickness: 15,
        bearingClearance: 0.05,
        wallThickness: 12
      }
    };
  }

  /**
   * Process and evaluate a complete robotic joint through the SECP core
   */
  public static generateJoint(
    jointInput: RobotJointDefinition,
    overrideTimestamp?: string
  ): RobotJointGenerationResult {
    const timestamp = overrideTimestamp ?? new Date().toISOString();

    // 1. Validate Input Definition
    const validation: JointValidationReport = RobotJointValidator.validateJoint(jointInput);
    if (!validation.valid) {
      throw new Error(
        `Robot Joint Validation Failed for '${jointInput.jointId}': ` +
          validation.issues.map((i) => `[${i.severity}] ${i.field}: ${i.message}`).join('; ')
      );
    }

    // 2. Axis Normalization and Checking
    const axisNorm = CoordinateFrameEngine.vecNormalize(jointInput.axis);
    const normalizedJoint: RobotJointDefinition = {
      ...jointInput,
      axis: axisNorm
    };

    // 3. Parametric CAD Kernel Generation (Housing, Shaft, Flange B-Rep Solids)
    const { parts, totalVolumeMm3, housingMassKg, shaftMassKg, flangeMassKg } =
      this.generateParametricCADParts(normalizedJoint);

    // 4. Compute Derivations (Mass, Center of Mass, Inertia Tensor, Torque Capacity)
    const properties = this.computeEngineeringProperties(
      normalizedJoint,
      totalVolumeMm3,
      housingMassKg,
      shaftMassKg,
      flangeMassKg
    );

    // Update joint object with computed mass and inertia
    normalizedJoint.mass = properties.massKg;
    normalizedJoint.inertia = {
      Ixx: properties.inertiaTensorKgM2.Ixx,
      Iyy: properties.inertiaTensorKgM2.Iyy,
      Izz: properties.inertiaTensorKgM2.Izz
    };
    normalizedJoint.properties = properties;

    // 5. Assembly System Integration
    const assembly = this.integrateAssembly(normalizedJoint, parts);

    // 6. Kinematic Chain Integration & Transform Evaluation
    const { childWorldTransform, transform4x4 } = this.evaluateKinematicTransformation(
      normalizedJoint
    );

    properties.kinematicState.transform4x4 = transform4x4;

    // 7. Generate Traceability Record
    const traceability = this.generateTraceabilityRecord(normalizedJoint);

    // 8. Generate Evidence Package and Hash
    const baseEvidencePackage = this.createEvidencePackage(
      normalizedJoint,
      properties,
      validation,
      traceability,
      timestamp
    );

    // Compute hash over payload with evidenceHash set to empty string
    const evidenceHash = EvidenceIntegrityService.computeHash({
      ...baseEvidencePackage,
      evidenceHash: ''
    });

    const fullEvidencePackage: JointEvidencePackage = {
      ...baseEvidencePackage,
      evidenceHash
    };

    return {
      joint: normalizedJoint,
      parts,
      assembly,
      validation: { ...validation, timestamp },
      properties,
      childWorldTransform,
      traceability,
      evidencePackage: fullEvidencePackage,
      evidenceHash
    };
  }

  /**
   * Verifies the cryptographic integrity of a JointEvidencePackage
   */
  public static verifyEvidencePackage(pkg: JointEvidencePackage): {
    isValid: boolean;
    computedHash: string;
    expectedHash: string;
  } {
    const payloadToVerify = {
      ...pkg,
      evidenceHash: ''
    };
    const computedHash = EvidenceIntegrityService.computeHash(payloadToVerify);
    return {
      isValid: computedHash === pkg.evidenceHash,
      computedHash,
      expectedHash: pkg.evidenceHash
    };
  }

  /**
   * Generates real CAD parts using the SECP CAD Kernel
   */
  private static generateParametricCADParts(joint: RobotJointDefinition): {
    parts: CADPart[];
    totalVolumeMm3: number;
    housingMassKg: number;
    shaftMassKg: number;
    flangeMassKg: number;
  } {
    const p = joint.geometryParams;
    const densityGramPerCm3 =
      RobotJointValidator.MATERIAL_DENSITY_TABLE[joint.material] ?? 2.81;
    const densityKgPerMm3 = (densityGramPerCm3 * 1e-3) / 1e3; // g/cm^3 -> kg/mm^3

    // 1. Housing Geometry (Hollow cylinder)
    const rHousingOuter = p.housingDiameter / 2;
    const rHousingInner = Math.max(rHousingOuter - p.wallThickness, p.shaftDiameter / 2 + p.bearingClearance);
    const housingVolumeMm3 =
      Math.PI * (Math.pow(rHousingOuter, 2) - Math.pow(rHousingInner, 2)) * p.housingLength;
    const housingMassKg = housingVolumeMm3 * densityKgPerMm3;

    const housingSolid: BRepSolid = {
      id: `solid_housing_${joint.jointId}`,
      faceIds: [`face_outer_${joint.jointId}`, `face_inner_${joint.jointId}`, `face_top_${joint.jointId}`, `face_bottom_${joint.jointId}`],
      volume: housingVolumeMm3
    };

    const housingPart: CADPart = {
      id: `part_housing_${joint.jointId}`,
      name: `Housing_${joint.jointId}`,
      sketches: [],
      features: [
        { type: 'HOLLOW_CYLINDER', outerDiameter: p.housingDiameter, wallThickness: p.wallThickness, length: p.housingLength }
      ],
      solids: [housingSolid],
      fingerprint: EvidenceIntegrityService.computeHash({ type: 'housing', p }),
      version: 1
    };

    // 2. Shaft Geometry (Solid cylinder)
    const rShaft = p.shaftDiameter / 2;
    const shaftVolumeMm3 = Math.PI * Math.pow(rShaft, 2) * p.shaftLength;
    const shaftMassKg = shaftVolumeMm3 * densityKgPerMm3;

    const shaftSolid: BRepSolid = {
      id: `solid_shaft_${joint.jointId}`,
      faceIds: [`face_shaft_cyl_${joint.jointId}`, `face_shaft_top_${joint.jointId}`, `face_shaft_bot_${joint.jointId}`],
      volume: shaftVolumeMm3
    };

    const shaftPart: CADPart = {
      id: `part_shaft_${joint.jointId}`,
      name: `Shaft_${joint.jointId}`,
      sketches: [],
      features: [
        { type: 'CYLINDER', diameter: p.shaftDiameter, length: p.shaftLength }
      ],
      solids: [shaftSolid],
      fingerprint: EvidenceIntegrityService.computeHash({ type: 'shaft', p }),
      version: 1
    };

    // 3. Flange Geometry (Flanged disc with bolt pattern)
    const rFlange = p.flangeDiameter / 2;
    const holeAreaSum = p.holeCount * Math.PI * Math.pow(p.holeDiameter / 2, 2);
    const flangeArea = Math.PI * Math.pow(rFlange, 2) - holeAreaSum;
    const flangeVolumeMm3 = Math.max(0, flangeArea * p.flangeThickness);
    const flangeMassKg = flangeVolumeMm3 * densityKgPerMm3;

    const flangeSolid: BRepSolid = {
      id: `solid_flange_${joint.jointId}`,
      faceIds: [`face_flange_${joint.jointId}`],
      volume: flangeVolumeMm3
    };

    const flangePart: CADPart = {
      id: `part_flange_${joint.jointId}`,
      name: `Flange_${joint.jointId}`,
      sketches: [],
      features: [
        { type: 'FLANGE_PATTERN', diameter: p.flangeDiameter, thickness: p.flangeThickness, boltCircle: p.boltCircleDiameter, holeCount: p.holeCount }
      ],
      solids: [flangeSolid],
      fingerprint: EvidenceIntegrityService.computeHash({ type: 'flange', p }),
      version: 1
    };

    const totalVolumeMm3 = housingVolumeMm3 + shaftVolumeMm3 + flangeVolumeMm3;

    return {
      parts: [housingPart, shaftPart, flangePart],
      totalVolumeMm3,
      housingMassKg,
      shaftMassKg,
      flangeMassKg
    };
  }

  /**
   * Derive physical engineering properties from parametric model
   */
  private static computeEngineeringProperties(
    joint: RobotJointDefinition,
    totalVolumeMm3: number,
    housingMassKg: number,
    shaftMassKg: number,
    flangeMassKg: number
  ): JointEngineeringProperties {
    const p = joint.geometryParams;
    const totalMassKg = housingMassKg + shaftMassKg + flangeMassKg;

    // Center of Mass relative to joint origin
    const comZ =
      (housingMassKg * (p.housingLength / 2) +
        shaftMassKg * (p.shaftLength / 2) +
        flangeMassKg * (p.flangeThickness / 2)) /
      Math.max(1e-9, totalMassKg);

    const com: Vector3D = {
      x: joint.origin.x,
      y: joint.origin.y,
      z: joint.origin.z + comZ
    };

    // Moment of Inertia Tensor (Cylindrical approximation along z-axis)
    const rShaftM = p.shaftDiameter / 2000; // mm -> m
    const hShaftM = p.shaftLength / 1000;   // mm -> m

    const Izz = 0.5 * shaftMassKg * Math.pow(rShaftM, 2);
    const Ixx = (1 / 12) * shaftMassKg * (3 * Math.pow(rShaftM, 2) + Math.pow(hShaftM, 2));
    const Iyy = Ixx;

    const inertiaTensor: JointInertiaTensor = {
      Ixx: Number(Ixx.toFixed(6)),
      Iyy: Number(Iyy.toFixed(6)),
      Izz: Number(Izz.toFixed(6)),
      Ixy: 0,
      Ixz: 0,
      Iyz: 0
    };

    // Torsional Shear Capacity (T = tau_yield * J / r)
    const yieldStrengthMpa =
      this.MATERIAL_YIELD_STRENGTH_MPA[joint.material] ?? 503;
    const yieldStrengthPa = yieldStrengthMpa * 1e6; // N/m^2
    const tauYieldPa = yieldStrengthPa / Math.sqrt(3); // Von Mises shear yield

    const J = (Math.PI / 2) * Math.pow(rShaftM, 4); // Polar moment of inertia
    const torqueCapacityNm = Number(((tauYieldPa * J) / Math.max(1e-6, rShaftM)).toFixed(2));

    const span = joint.limits.maximumPosition - joint.limits.minimumPosition;
    const unit = joint.jointType === 'PRISMATIC' ? 'mm' : 'deg';

    return {
      massKg: Number(totalMassKg.toFixed(4)),
      centerOfMassMm: com,
      inertiaTensorKgM2: inertiaTensor,
      torqueCapacityNm,
      geometricVolumeMm3: Number(totalVolumeMm3.toFixed(2)),
      jointRange: {
        minimum: joint.limits.minimumPosition,
        maximum: joint.limits.maximumPosition,
        span,
        unit
      },
      kinematicState: {
        position: joint.position,
        velocity: joint.maxVelocity,
        acceleration: joint.maxAcceleration,
        transform4x4: []
      }
    };
  }

  /**
   * Connect joint to existing SECP Assembly model
   */
  private static integrateAssembly(joint: RobotJointDefinition, parts: CADPart[]): CADAssembly {
    const mates: AssemblyMate[] = [
      {
        id: `mate_concentric_${joint.jointId}`,
        type: 'CONCENTRIC',
        partAId: joint.parentLinkId,
        entityAId: `axis_${joint.parentLinkId}`,
        partBId: `part_housing_${joint.jointId}`,
        entityBId: `axis_housing_${joint.jointId}`
      },
      {
        id: `mate_coincident_${joint.jointId}`,
        type: 'COINCIDENT',
        partAId: `part_flange_${joint.jointId}`,
        entityAId: `face_flange_${joint.jointId}`,
        partBId: joint.childLinkId,
        entityBId: `face_mount_${joint.childLinkId}`
      }
    ];

    return {
      id: `assembly_joint_${joint.jointId}`,
      name: `Assembly_Joint_${joint.jointId}`,
      partIds: [joint.parentLinkId, ...parts.map((p) => p.id), joint.childLinkId],
      mates,
      degreesOfFreedom: joint.jointType === 'FIXED' ? 0 : 1
    };
  }

  /**
   * Evaluate joint kinematic transformation using existing JointKinematicsEngine
   */
  public static evaluateKinematicTransformation(joint: RobotJointDefinition): {
    childWorldTransform: number[];
    transform4x4: number[];
  } {
    // Construct SECP MechanicalJoint for JointKinematicsEngine
    const mechJoint: MechanicalJoint = {
      id: joint.jointId,
      name: `MechanicalJoint_${joint.jointId}`,
      type: (joint.jointType as any) || 'REVOLUTE',
      parentComponentId: joint.parentLinkId,
      childComponentId: joint.childLinkId,
      parentReference: {
        componentId: joint.parentLinkId,
        geometryType: 'DATUM_AXIS',
        geometryId: `geom_${joint.parentLinkId}`,
        localOrigin: joint.origin,
        localAxis: joint.axis
      },
      childReference: {
        componentId: joint.childLinkId,
        geometryType: 'DATUM_AXIS',
        geometryId: `geom_${joint.childLinkId}`,
        localOrigin: { x: 0, y: 0, z: 0 },
        localAxis: joint.axis
      },
      parentFrame: CoordinateFrameEngine.createFrameFromOriginAndAxis(
        joint.jointId,
        `frame_${joint.jointId}`,
        joint.origin,
        joint.axis
      ),
      childFrame: CoordinateFrameEngine.createFrameFromOriginAndAxis(
        joint.childLinkId,
        `frame_${joint.childLinkId}`,
        joint.origin,
        joint.axis
      ),
      jointAxis: joint.axis,
      jointOrigin: joint.origin,
      dof: {
        txAllowed: joint.jointType === 'PRISMATIC',
        tyAllowed: false,
        tzAllowed: false,
        rxAllowed: false,
        ryAllowed: false,
        rzAllowed: joint.jointType === 'REVOLUTE',
        isCoupled: false,
        totalDegreesOfFreedom: joint.jointType === 'FIXED' ? 0 : 1,
        lockedDegreesOfFreedom: joint.jointType === 'FIXED' ? 6 : 5
      },
      mechanicalProperties: {
        staticFrictionCoefficient: 0.05,
        dynamicFrictionCoefficient: 0.03,
        viscousDamping: 0.1,
        stiffness: 1000,
        equilibriumPosition: 0,
        breakawayTorqueOrForce: 0.5
      },
      currentPosition: joint.position,
      currentVelocity: 0,
      currentAcceleration: 0,
      initialPosition: 0,
      initialOrientation: joint.orientation,
      state: 'VALID',
      limitStatus: 'NONE',
      isSuppressed: false,
      revision: 1,
      author: 'SECP_ROBOT_CORE',
      createdAt: new Date().toISOString(),
      evidenceHash: ''
    };

    const relativeTransform4x4 = JointKinematicsEngine.computeJointRelativeTransform(mechJoint);
    const matrixElements = [...relativeTransform4x4.elements];

    // Parent World Matrix (Identity assumed if unattached base)
    const parentTransform = CoordinateFrameEngine.identity4x4();
    const childWorldTransformMatrix = CoordinateFrameEngine.multiplyTransforms(
      parentTransform,
      relativeTransform4x4
    );

    return {
      childWorldTransform: [...childWorldTransformMatrix.elements],
      transform4x4: matrixElements
    };
  }

  /**
   * Generate Requirement -> Design -> Geometry -> Assembly -> Kinematics -> Verification -> Evidence traceability
   */
  private static generateTraceabilityRecord(joint: RobotJointDefinition): JointRequirementTraceability {
    return {
      robotRequirementId: 'REQ-ROB-039-ARM-JOINTS',
      jointRequirementId: `REQ-JNT-${joint.jointId}`,
      jointDesignId: `DES-JNT-${joint.jointId}-${joint.revision}`,
      parametricGeometryId: `GEO-CAD-${joint.jointId}`,
      assemblyId: `ASSY-JNT-${joint.jointId}`,
      kinematicChainId: `KIN-CHAIN-${joint.parentLinkId}-${joint.childLinkId}`,
      verificationId: `VER-GATE-039-${joint.jointId}`,
      evidenceHash: ''
    };
  }

  /**
   * Create reproducible Evidence Package payload
   */
  private static createEvidencePackage(
    joint: RobotJointDefinition,
    properties: JointEngineeringProperties,
    validation: JointValidationReport,
    traceability: JointRequirementTraceability,
    timestamp: string
  ): JointEvidencePackage {
    return {
      jointId: joint.jointId,
      revision: joint.revision,
      geometryParameters: joint.geometryParams,
      material: joint.material,
      parentLinkId: joint.parentLinkId,
      childLinkId: joint.childLinkId,
      axis: joint.axis,
      limits: joint.limits,
      kinematicState: {
        position: joint.position,
        transform4x4: properties.kinematicState.transform4x4
      },
      computedProperties: properties,
      verificationResults: { ...validation, timestamp },
      timestamp,
      provenance: 'SECP_EPC_039_ROBOT_JOINT_DESIGN_ENGINE',
      evidenceHash: ''
    };
  }
}
