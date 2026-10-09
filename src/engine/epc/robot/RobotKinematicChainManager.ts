/**
 * SECP Industrial OS — EPC-043: Robot Kinematic Chain Manager
 * Generic Engineering Kinematic Chain Engine for Industrial Robotic Systems.
 * Integrates:
 * - EPC-037 Industrial Robot Architecture
 * - EPC-038 Parametric Links
 * - EPC-039 Joint Design Engine
 * - EPC-040 Transmission / Gear Model Engine
 * - EPC-041 Assembly Manager
 * - EPC-042 Degrees of Freedom Manager
 *
 * STRICT NO-GO ARCHITECTURAL RULE:
 * Reuses existing SECP core components (Assembly System, Joint System, Transform System,
 * Reference Frames, DOF System, Linear Algebra, Constraint Solver, Evidence Bus, Provenance System).
 * No robot-specific solvers or engines are created.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import {
  KinematicChainModel,
  KinematicLinkDefinition,
  KinematicJointDefinition,
  KinematicFrameDefinition,
  KinematicDOFBinding,
  KinematicChainValidationReport,
  KinematicChainTraceability,
  RobotKinematicEvidencePackage,
  RobotKinematicProvenanceRecord,
  EPC043GateReport
} from './RobotKinematicTypes';

import { RobotAssemblyManager } from './RobotAssemblyManager';
import { RobotDOFManager } from './RobotDOFManager';
import { RobotJointDesignEngine } from './RobotJointDesignEngine';
import { RobotTransmissionEngine } from './RobotTransmissionEngine';
import { RobotKinematicChainValidator } from './RobotKinematicChainValidator';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class RobotKinematicChainManager {
  public readonly chainId = 'CHAIN-ROBOT-6DOF';
  public readonly robotId = 'ROB-6DOF-IND-01';
  public readonly assemblyId = 'ASSY-ROBOT-6DOF';
  public readonly revision = 'REV-A';
  public readonly rootLinkId = 'LINK-BASE-PEDESTAL';
  public readonly endEffectorLinkId = 'LINK-J6-END-EFFECTOR';

  private assemblyManager: RobotAssemblyManager;
  private dofManager: RobotDOFManager;
  private jointDesignEngine: RobotJointDesignEngine;
  private transmissionEngine: RobotTransmissionEngine;

  private links: KinematicLinkDefinition[] = [];
  private joints: KinematicJointDefinition[] = [];
  private frames: KinematicFrameDefinition[] = [];
  private dofBindings: KinematicDOFBinding[] = [];

  constructor(
    assemblyManager?: RobotAssemblyManager,
    dofManager?: RobotDOFManager,
    jointDesignEngine?: RobotJointDesignEngine,
    transmissionEngine?: RobotTransmissionEngine
  ) {
    this.assemblyManager = assemblyManager || new RobotAssemblyManager();
    this.jointDesignEngine = jointDesignEngine || new RobotJointDesignEngine();
    this.transmissionEngine = transmissionEngine || new RobotTransmissionEngine();
    this.dofManager = dofManager || new RobotDOFManager(
      this.assemblyManager,
      this.jointDesignEngine,
      this.transmissionEngine
    );

    this.initializeKinematicChain();
  }

  // =========================================================================
  // 1. INITIALIZATION & ASSEMBLY / JOINT / DOF SYNCHRONIZATION
  // =========================================================================

  private initializeKinematicChain(): void {
    // 1. Build Kinematic Links mapped to Assembly instances and Part definitions
    this.links = [
      {
        linkId: 'LINK-BASE-PEDESTAL',
        partId: 'PART-DEF-BASE-PLATE',
        assemblyInstanceId: 'INST-BASE-PLATE',
        parentLinkId: null,
        childLinkIds: ['LINK-J1-SWIVEL'],
        referenceFrame: 'FRAME-WORLD',
        massProperties: { unitMassKg: 28.5, centerOfMassMm: { x: 0, y: 0, z: 50 } },
        geometryReference: 'OCCT-CAD-PART-BASE-PLATE',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J1-SWIVEL',
        partId: 'PART-DEF-BASE-HOUSING',
        assemblyInstanceId: 'INST-BASE-HOUSING',
        parentLinkId: 'LINK-BASE-PEDESTAL',
        childLinkIds: ['LINK-J2-UPPER-ARM'],
        referenceFrame: 'FRAME-J1-JOINT',
        massProperties: { unitMassKg: 14.2, centerOfMassMm: { x: 0, y: 0, z: 120 } },
        geometryReference: 'OCCT-CAD-PART-BASE-HOUSING',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J2-UPPER-ARM',
        partId: 'PART-DEF-UPPER-ARM',
        assemblyInstanceId: 'INST-UPPER-ARM',
        parentLinkId: 'LINK-J1-SWIVEL',
        childLinkIds: ['LINK-J3-FOREARM'],
        referenceFrame: 'FRAME-J2-JOINT',
        massProperties: { unitMassKg: 18.6, centerOfMassMm: { x: 200, y: 0, z: 0 } },
        geometryReference: 'OCCT-CAD-PART-UPPER-ARM',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J3-FOREARM',
        partId: 'PART-DEF-FOREARM',
        assemblyInstanceId: 'INST-FOREARM',
        parentLinkId: 'LINK-J2-UPPER-ARM',
        childLinkIds: ['LINK-J4-WRIST1'],
        referenceFrame: 'FRAME-J3-JOINT',
        massProperties: { unitMassKg: 12.4, centerOfMassMm: { x: 180, y: 0, z: 0 } },
        geometryReference: 'OCCT-CAD-PART-FOREARM',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J4-WRIST1',
        partId: 'PART-DEF-WRIST-BASE',
        assemblyInstanceId: 'INST-WRIST-BASE',
        parentLinkId: 'LINK-J3-FOREARM',
        childLinkIds: ['LINK-J5-WRIST2'],
        referenceFrame: 'FRAME-J4-JOINT',
        massProperties: { unitMassKg: 6.8, centerOfMassMm: { x: 50, y: 0, z: 0 } },
        geometryReference: 'OCCT-CAD-PART-WRIST-BASE',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J5-WRIST2',
        partId: 'PART-DEF-WRIST-BASE',
        assemblyInstanceId: 'INST-WRIST-BASE',
        parentLinkId: 'LINK-J4-WRIST1',
        childLinkIds: ['LINK-J6-END-EFFECTOR'],
        referenceFrame: 'FRAME-J5-JOINT',
        massProperties: { unitMassKg: 4.2, centerOfMassMm: { x: 30, y: 0, z: 0 } },
        geometryReference: 'OCCT-CAD-PART-WRIST-BASE',
        revision: 'REV-A'
      },
      {
        linkId: 'LINK-J6-END-EFFECTOR',
        partId: 'PART-DEF-END-EFFECTOR',
        assemblyInstanceId: 'INST-END-EFFECTOR',
        parentLinkId: 'LINK-J5-WRIST2',
        childLinkIds: [],
        referenceFrame: 'FRAME-J6-JOINT',
        massProperties: { unitMassKg: 2.1, centerOfMassMm: { x: 15, y: 0, z: 0 } },
        geometryReference: 'OCCT-CAD-PART-END-EFFECTOR',
        revision: 'REV-A'
      }
    ];

    // 2. Build Kinematic Joints mapped to EPC-042 DOFs and joint axes
    const dofDefs = this.dofManager.getDOFDefinitions();
    const dofMap = new Map(dofDefs.map((d) => [d.jointId, d]));

    this.joints = [
      {
        jointId: 'J1_BASE',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-BASE-PEDESTAL',
        childLinkId: 'LINK-J1-SWIVEL',
        axis: { x: 0, y: 0, z: 1 },
        referenceFrame: 'FRAME-BASE',
        dofId: dofMap.get('J1_BASE')?.dofId || 'DOF-J1_BASE-01',
        limits: { minimumPosition: -170, maximumPosition: 170, maxVelocity: 180, maxAcceleration: 360 },
        originTransform: TransformMatrix.translation(0, 0, 250),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      },
      {
        jointId: 'J2_SHOULDER',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-J1-SWIVEL',
        childLinkId: 'LINK-J2-UPPER-ARM',
        axis: { x: 0, y: 1, z: 0 },
        referenceFrame: 'FRAME-J1-SWIVEL',
        dofId: dofMap.get('J2_SHOULDER')?.dofId || 'DOF-J2_SHOULDER-01',
        limits: { minimumPosition: -100, maximumPosition: 135, maxVelocity: 180, maxAcceleration: 360 },
        originTransform: TransformMatrix.translation(0, 0, 200),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      },
      {
        jointId: 'J3_ELBOW',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-J2-UPPER-ARM',
        childLinkId: 'LINK-J3-FOREARM',
        axis: { x: 0, y: 1, z: 0 },
        referenceFrame: 'FRAME-J2-UPPER-ARM',
        dofId: dofMap.get('J3_ELBOW')?.dofId || 'DOF-J3_ELBOW-01',
        limits: { minimumPosition: -210, maximumPosition: 65, maxVelocity: 180, maxAcceleration: 360 },
        originTransform: TransformMatrix.translation(450, 0, 0),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      },
      {
        jointId: 'J4_WRIST1',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-J3-FOREARM',
        childLinkId: 'LINK-J4-WRIST1',
        axis: { x: 1, y: 0, z: 0 },
        referenceFrame: 'FRAME-J3-FOREARM',
        dofId: dofMap.get('J4_WRIST1')?.dofId || 'DOF-J4_WRIST1-01',
        limits: { minimumPosition: -190, maximumPosition: 190, maxVelocity: 360, maxAcceleration: 720 },
        originTransform: TransformMatrix.translation(400, 0, 0),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      },
      {
        jointId: 'J5_WRIST2',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-J4-WRIST1',
        childLinkId: 'LINK-J5-WRIST2',
        axis: { x: 0, y: 1, z: 0 },
        referenceFrame: 'FRAME-J4-WRIST1',
        dofId: dofMap.get('J5_WRIST2')?.dofId || 'DOF-J5_WRIST2-01',
        limits: { minimumPosition: -125, maximumPosition: 125, maxVelocity: 360, maxAcceleration: 720 },
        originTransform: TransformMatrix.translation(120, 0, 0),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      },
      {
        jointId: 'J6_WRIST3',
        jointType: 'REVOLUTE',
        parentLinkId: 'LINK-J5-WRIST2',
        childLinkId: 'LINK-J6-END-EFFECTOR',
        axis: { x: 1, y: 0, z: 0 },
        referenceFrame: 'FRAME-J5-WRIST2',
        dofId: dofMap.get('J6_WRIST3')?.dofId || 'DOF-J6_WRIST3-01',
        limits: { minimumPosition: -360, maximumPosition: 360, maxVelocity: 450, maxAcceleration: 900 },
        originTransform: TransformMatrix.translation(80, 0, 0),
        state: { position: 0, velocity: 0, acceleration: 0 },
        revision: 'REV-A'
      }
    ];

    // 3. Build Kinematic DOF Bindings
    this.syncDOFBindings();

    // 4. Compute Forward Kinematics / Transform Propagation along chain
    this.propagateTransforms();
  }

  private syncDOFBindings(): void {
    this.dofBindings = this.joints.map((joint, idx) => ({
      jointId: joint.jointId,
      dofId: joint.dofId,
      dofType: joint.jointType,
      axis: { ...joint.axis },
      variableName: `q${idx + 1}`,
      state: { ...joint.state }
    }));
  }

  // =========================================================================
  // 2. TRANSFORM MATRIX MATH & FORWARD KINEMATICS PROPAGATION
  // =========================================================================

  /**
   * Compute rotation matrix around an arbitrary 3D unit axis (uX, uY, uZ) by angle in degrees
   */
  public static rotationAroundAxis(axis: Vector3D, angleDeg: number): Matrix4x4 {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len < 1e-12) {
      return TransformMatrix.identity();
    }
    const ux = axis.x / len;
    const uy = axis.y / len;
    const uz = axis.z / len;

    const rad = (angleDeg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const C = 1 - c;

    const r00 = ux * ux * C + c;
    const r01 = ux * uy * C - uz * s;
    const r02 = ux * uz * C + uy * s;

    const r10 = uy * ux * C + uz * s;
    const r11 = uy * uy * C + c;
    const r12 = uy * uz * C - ux * s;

    const r20 = uz * ux * C - uy * s;
    const r21 = uz * uy * C + ux * s;
    const r22 = uz * uz * C + c;

    return [
      [Number(r00.toFixed(8)), Number(r01.toFixed(8)), Number(r02.toFixed(8)), 0],
      [Number(r10.toFixed(8)), Number(r11.toFixed(8)), Number(r12.toFixed(8)), 0],
      [Number(r20.toFixed(8)), Number(r21.toFixed(8)), Number(r22.toFixed(8)), 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Compute 4x4 local relative transform for a joint given its current kinematic state q
   */
  public computeJointLocalTransform(joint: KinematicJointDefinition): Matrix4x4 {
    const q = joint.state.position;
    if (joint.jointType === 'REVOLUTE') {
      const rotMat = RobotKinematicChainManager.rotationAroundAxis(joint.axis, q);
      return TransformMatrix.multiply(joint.originTransform, rotMat);
    } else if (joint.jointType === 'PRISMATIC') {
      const len = Math.sqrt(joint.axis.x * joint.axis.x + joint.axis.y * joint.axis.y + joint.axis.z * joint.axis.z);
      const ux = len > 1e-12 ? joint.axis.x / len : 0;
      const uy = len > 1e-12 ? joint.axis.y / len : 0;
      const uz = len > 1e-12 ? joint.axis.z / len : 0;
      const transMat = TransformMatrix.translation(ux * q, uy * q, uz * q);
      return TransformMatrix.multiply(joint.originTransform, transMat);
    } else {
      // FIXED joint
      return joint.originTransform;
    }
  }

  /**
   * Propagate 3D homogeneous transform matrices along the tree from Root to End Effector
   */
  public propagateTransforms(): void {
    const frameList: KinematicFrameDefinition[] = [];

    // World Frame
    const worldMatrix = TransformMatrix.identity();
    frameList.push({
      frameId: 'FRAME-WORLD',
      frameName: 'World Coordinate Frame',
      parentFrameId: null,
      associatedEntityId: 'WORLD',
      associatedType: 'WORLD',
      localTransform: worldMatrix,
      worldTransform: worldMatrix
    });

    const linkMap = new Map(this.links.map((l) => [l.linkId, l]));
    const jointByChildMap = new Map(this.joints.map((j) => [j.childLinkId, j]));

    const worldTransforms = new Map<string, Matrix4x4>();
    worldTransforms.set(this.rootLinkId, worldMatrix);

    // Root Frame
    const rootLink = linkMap.get(this.rootLinkId);
    if (rootLink) {
      frameList.push({
        frameId: rootLink.referenceFrame,
        frameName: `${rootLink.linkId} Reference Frame`,
        parentFrameId: 'FRAME-WORLD',
        associatedEntityId: rootLink.linkId,
        associatedType: 'LINK',
        localTransform: worldMatrix,
        worldTransform: worldMatrix
      });
    }

    // Traverse tree starting from Root
    const processLink = (parentLinkId: string) => {
      const parentLink = linkMap.get(parentLinkId);
      if (!parentLink) return;

      const parentWorldMat = worldTransforms.get(parentLinkId) || worldMatrix;

      for (const childLinkId of parentLink.childLinkIds) {
        const childLink = linkMap.get(childLinkId);
        const joint = jointByChildMap.get(childLinkId);

        if (childLink && joint) {
          const T_joint_local = this.computeJointLocalTransform(joint);
          const T_child_world = TransformMatrix.multiply(parentWorldMat, T_joint_local);

          worldTransforms.set(childLinkId, T_child_world);

          // Joint Frame
          frameList.push({
            frameId: `FRAME-${joint.jointId}`,
            frameName: `Joint ${joint.jointId} Frame`,
            parentFrameId: parentLink.referenceFrame,
            associatedEntityId: joint.jointId,
            associatedType: 'JOINT',
            localTransform: T_joint_local,
            worldTransform: T_child_world
          });

          // Link Frame
          frameList.push({
            frameId: childLink.referenceFrame,
            frameName: `${childLink.linkId} Reference Frame`,
            parentFrameId: `FRAME-${joint.jointId}`,
            associatedEntityId: childLink.linkId,
            associatedType: 'LINK',
            localTransform: TransformMatrix.identity(),
            worldTransform: T_child_world
          });

          if (childLinkId === this.endEffectorLinkId) {
            frameList.push({
              frameId: 'FRAME-END-EFFECTOR',
              frameName: 'End Effector Tool Flange Frame',
              parentFrameId: childLink.referenceFrame,
              associatedEntityId: childLinkId,
              associatedType: 'END_EFFECTOR',
              localTransform: TransformMatrix.identity(),
              worldTransform: T_child_world
            });
          }

          processLink(childLinkId);
        }
      }
    };

    processLink(this.rootLinkId);
    this.frames = frameList;
  }

  // =========================================================================
  // 3. KINEMATIC STATE UPDATES & LOCALITY PROPAGATION
  // =========================================================================

  /**
   * Set joint kinematic position and re-propagate downstream transforms
   */
  public setJointPosition(jointId: string, position: number): void {
    const joint = this.joints.find((j) => j.jointId === jointId);
    if (!joint) {
      throw new Error(`Joint '${jointId}' not found in kinematic chain`);
    }

    joint.state.position = position;

    // Synchronize with EPC-042 DOF manager
    if (joint.dofId) {
      this.dofManager.setDOFState(joint.dofId, { position });
    }

    this.syncDOFBindings();
    this.propagateTransforms();
  }

  /**
   * Set multiple joint positions in batch
   */
  public setJointPositions(positions: Record<string, number>): void {
    for (const [jointId, pos] of Object.entries(positions)) {
      const joint = this.joints.find((j) => j.jointId === jointId);
      if (joint) {
        joint.state.position = pos;
        if (joint.dofId) {
          this.dofManager.setDOFState(joint.dofId, { position: pos });
        }
      }
    }
    this.syncDOFBindings();
    this.propagateTransforms();
  }

  /**
   * Transmission integration: Set motor speed/angle and propagate through gear ratio to joint
   */
  public setMotorState(jointId: string, motorSpeedRpm: number, motorAngleDeg: number): void {
    const transmissionRatio = 100.0; // Standard 100:1 strain wave / planetary reduction ratio
    const jointAngleDeg = motorAngleDeg / transmissionRatio;
    const jointSpeedDegS = (motorSpeedRpm * 360) / (60 * transmissionRatio);

    const joint = this.joints.find((j) => j.jointId === jointId);
    if (joint) {
      joint.state.position = jointAngleDeg;
      joint.state.velocity = jointSpeedDegS;
    }

    // Sync with EPC-040 Transmission & EPC-042 DOF
    this.dofManager.bindTransmission(jointId, motorSpeedRpm, transmissionRatio, 250, 0.95);
    this.syncDOFBindings();
    this.propagateTransforms();
  }

  // =========================================================================
  // 4. DYNAMIC LINK & JOINT TOPOLOGY OPERATIONS
  // =========================================================================

  public addLink(link: KinematicLinkDefinition): void {
    this.links.push(link);
    if (link.parentLinkId) {
      const parentLink = this.links.find((l) => l.linkId === link.parentLinkId);
      if (parentLink && !parentLink.childLinkIds.includes(link.linkId)) {
        parentLink.childLinkIds.push(link.linkId);
      }
    }
    this.propagateTransforms();
  }

  public removeLink(linkId: string): void {
    this.links = this.links.filter((l) => l.linkId !== linkId);
    this.joints = this.joints.filter((j) => j.parentLinkId !== linkId && j.childLinkId !== linkId);
    for (const l of this.links) {
      l.childLinkIds = l.childLinkIds.filter((cid) => cid !== linkId);
    }
    this.propagateTransforms();
  }

  public addJoint(joint: KinematicJointDefinition): void {
    this.joints.push(joint);
    const parentLink = this.links.find((l) => l.linkId === joint.parentLinkId);
    if (parentLink && !parentLink.childLinkIds.includes(joint.childLinkId)) {
      parentLink.childLinkIds.push(joint.childLinkId);
    }
    this.dofManager.addJoint({
      jointId: joint.jointId,
      jointType: joint.jointType,
      parentLinkId: joint.parentLinkId,
      childLinkId: joint.childLinkId,
      axis: joint.axis,
      origin: { x: 0, y: 0, z: 0 },
      position: joint.state.position,
      orientation: { x: 0, y: 0, z: 0 },
      limits: {
        minimumPosition: joint.limits.minimumPosition,
        maximumPosition: joint.limits.maximumPosition,
        maxVelocity: joint.limits.maxVelocity || 180,
        maxAcceleration: joint.limits.maxAcceleration || 360,
        maxTorque: 300,
        ratedTorque: 200
      },
      maxVelocity: joint.limits.maxVelocity || 180,
      maxAcceleration: joint.limits.maxAcceleration || 360,
      maxTorque: 300,
      ratedTorque: 200,
      material: 'AL-7075-T6',
      mass: 12.0,
      inertia: { Ixx: 0.1, Iyy: 0.1, Izz: 0.1 },
      revision: 'REV-A',
      geometryParams: {
        jointDiameter: 120,
        shaftDiameter: 40,
        housingDiameter: 150,
        housingLength: 180,
        shaftLength: 200,
        bearingSeatDiameter: 80,
        bearingSeatWidth: 20,
        boltCircleDiameter: 130,
        holeCount: 6,
        holeDiameter: 8,
        flangeDiameter: 160,
        flangeThickness: 15,
        bearingClearance: 0.02,
        wallThickness: 8
      }
    });
    this.syncDOFBindings();
    this.propagateTransforms();
  }

  public removeJoint(jointId: string): void {
    const joint = this.joints.find((j) => j.jointId === jointId);
    if (joint) {
      const parentLink = this.links.find((l) => l.linkId === joint.parentLinkId);
      if (parentLink) {
        parentLink.childLinkIds = parentLink.childLinkIds.filter((cid) => cid !== joint.childLinkId);
      }
    }
    this.joints = this.joints.filter((j) => j.jointId !== jointId);
    this.dofManager.removeJoint(jointId);
    this.syncDOFBindings();
    this.propagateTransforms();
  }

  // =========================================================================
  // 5. QUERY & KINEMATIC ANALYSIS METHODS
  // =========================================================================

  private buildModel(status: KinematicStatus): KinematicChainModel {
    return {
      chainId: this.chainId,
      robotId: this.robotId,
      assemblyId: this.assemblyId,
      revision: this.revision,
      rootLinkId: this.rootLinkId,
      endEffectorLinkId: this.endEffectorLinkId,
      endEffectorFrameId: 'FRAME-END-EFFECTOR',
      links: this.links.map((l) => ({ ...l, childLinkIds: [...l.childLinkIds] })),
      joints: this.joints.map((j) => ({ ...j, axis: { ...j.axis }, state: { ...j.state }, limits: { ...j.limits } })),
      frames: this.frames.map((f) => ({ ...f })),
      dofMapping: this.dofBindings.map((d) => ({ ...d })),
      status
    };
  }

  public getModel(): KinematicChainModel {
    const validation = this.validate();
    return this.buildModel(validation.status);
  }

  public getLinks(): KinematicLinkDefinition[] {
    return this.links.map((l) => ({ ...l }));
  }

  public getJoints(): KinematicJointDefinition[] {
    return this.joints.map((j) => ({ ...j }));
  }

  public getFrames(): KinematicFrameDefinition[] {
    return this.frames.map((f) => ({ ...f }));
  }

  public getChainDepth(): number {
    const linkMap = new Map(this.links.map((l) => [l.linkId, l]));
    const getDepth = (linkId: string): number => {
      const link = linkMap.get(linkId);
      if (!link || link.childLinkIds.length === 0) return 1;
      let maxChildDepth = 0;
      for (const childId of link.childLinkIds) {
        const d = getDepth(childId);
        if (d > maxChildDepth) maxChildDepth = d;
      }
      return 1 + maxChildDepth;
    };
    return getDepth(this.rootLinkId);
  }

  public getLinkCount(): number {
    return this.links.length;
  }

  public getJointCount(): number {
    return this.joints.length;
  }

  public getActiveDOFCount(): number {
    return this.joints.filter((j) => j.jointType !== 'FIXED').length;
  }

  public getEndEffectorPose(): { position: Vector3D; orientationEulerDeg: Vector3D } {
    const frame = this.frames.find((f) => f.frameId === 'FRAME-END-EFFECTOR') ||
                  this.frames.find((f) => f.associatedEntityId === this.endEffectorLinkId);

    const mat = frame ? frame.worldTransform : TransformMatrix.identity();
    const position = TransformMatrix.extractTranslation(mat);

    // Extract Euler angles from 3x3 rotation block of 4x4 homogenous matrix
    const sy = Math.sqrt(mat[0][0] * mat[0][0] + mat[1][0] * mat[1][0]);
    const singular = sy < 1e-6;

    let x = 0, y = 0, z = 0;
    if (!singular) {
      x = Math.atan2(mat[2][1], mat[2][2]);
      y = Math.atan2(-mat[2][0], sy);
      z = Math.atan2(mat[1][0], mat[0][0]);
    } else {
      x = Math.atan2(-mat[1][2], mat[1][1]);
      y = Math.atan2(-mat[2][0], sy);
      z = 0;
    }

    const rad2deg = 180 / Math.PI;
    return {
      position,
      orientationEulerDeg: {
        x: Number((x * rad2deg).toFixed(4)),
        y: Number((y * rad2deg).toFixed(4)),
        z: Number((z * rad2deg).toFixed(4))
      }
    };
  }

  public validate(enforceLimits: boolean = true, timestamp?: string): KinematicChainValidationReport {
    const assemblyPartIds = new Set(
      this.assemblyManager.getAllPartDefinitions().map((p) => p.definitionId)
    );
    const assemblyInstanceIds = new Set(
      this.assemblyManager.getAllPartInstances().map((p) => p.instanceId)
    );

    return RobotKinematicChainValidator.validate(this.buildModel('VALID'), {
      assemblyPartIds,
      assemblyInstanceIds,
      enforceLimits,
      timestamp
    });
  }

  // =========================================================================
  // 6. EVIDENCE PACKAGE & GATE REPORT GENERATION
  // =========================================================================

  public generateEvidencePackage(overrideTimestamp?: string): RobotKinematicEvidencePackage {
    const timestamp = overrideTimestamp || new Date().toISOString();
    const validationReport = this.validate(true, timestamp);

    const eePose = this.getEndEffectorPose();
    const provenance: RobotKinematicProvenanceRecord = {
      who: 'SECP Kinematic Chain Engine v4.3',
      what: 'Industrial Robotic Arm Kinematic Chain Representation & Forward Kinematics Verification',
      when: timestamp,
      source: `Assembly:${this.assemblyId}|Robot:${this.robotId}`,
      version: '4.3.0',
      input: {
        robotId: this.robotId,
        assemblyId: this.assemblyId,
        linkCount: this.links.length,
        jointCount: this.joints.length
      },
      process: 'Graph Traversal + Parent-Child Dependency Verification + Homogeneous Transform Compounding',
      output: {
        chainId: this.chainId,
        chainDepth: this.getChainDepth(),
        activeDOF: this.getActiveDOFCount(),
        endEffectorPose: {
          position: eePose.position,
          orientationEulerDeg: eePose.orientationEulerDeg
        }
      }
    };

    const linkList = this.links.map((l) => l.linkId).sort();
    const jointList = this.joints.map((j) => j.jointId).sort();

    const parentChildRelations = this.joints
      .map((j) => ({
        jointId: j.jointId,
        parentLinkId: j.parentLinkId,
        childLinkId: j.childLinkId
      }))
      .sort((a, b) => a.jointId.localeCompare(b.jointId));

    const jointTypes = this.joints
      .map((j) => ({ jointId: j.jointId, type: j.jointType }))
      .sort((a, b) => a.jointId.localeCompare(b.jointId));

    const axes = this.joints
      .map((j) => {
        const lenSq = j.axis.x * j.axis.x + j.axis.y * j.axis.y + j.axis.z * j.axis.z;
        return {
          jointId: j.jointId,
          axis: { ...j.axis },
          valid: lenSq > 1e-12 && isFinite(j.axis.x) && isFinite(j.axis.y) && isFinite(j.axis.z)
        };
      })
      .sort((a, b) => a.jointId.localeCompare(b.jointId));

    const referenceFrames = this.frames
      .map((f) => ({ frameId: f.frameId, parentFrameId: f.parentFrameId }))
      .sort((a, b) => a.frameId.localeCompare(b.frameId));

    const transforms = this.frames
      .map((f) => ({
        frameId: f.frameId,
        translation: TransformMatrix.extractTranslation(f.worldTransform)
      }))
      .sort((a, b) => a.frameId.localeCompare(b.frameId));

    const jointStates = this.joints
      .map((j) => ({ jointId: j.jointId, position: j.state.position, velocity: j.state.velocity }))
      .sort((a, b) => a.jointId.localeCompare(b.jointId));

    const jointLimits = this.joints
      .map((j) => ({
        jointId: j.jointId,
        min: j.limits.minimumPosition,
        max: j.limits.maximumPosition
      }))
      .sort((a, b) => a.jointId.localeCompare(b.jointId));

    const connectivityResult = validationReport.checks.connected ? 'CONNECTED' : 'DISCONNECTED';
    const cycleDetectionResult = validationReport.checks.cycleFree ? 'CYCLE_FREE' : 'CYCLE_DETECTED';
    const assemblyConsistency = validationReport.checks.assemblyConsistent ? 'CONSISTENT' : 'INCONSISTENT';

    const rawEvidence = {
      chainId: this.chainId,
      robotId: this.robotId,
      assemblyId: this.assemblyId,
      revision: this.revision,
      rootLink: this.rootLinkId,
      endEffector: this.endEffectorLinkId,
      linkList,
      jointList,
      parentChildRelations,
      jointTypes,
      dofMapping: this.dofBindings,
      axes,
      referenceFrames,
      transforms,
      jointStates,
      jointLimits,
      chainDepth: this.getChainDepth(),
      connectivityResult,
      cycleDetectionResult,
      assemblyConsistency,
      validationResults: validationReport,
      provenance,
      timestamp,
      verdict: validationReport.valid ? 'PASS' : 'FAIL'
    };

    const evidenceHash = EvidenceIntegrityService.computeHash(rawEvidence);

    return {
      ...rawEvidence,
      evidenceHash
    };
  }

  public getTraceability(): KinematicChainTraceability {
    const pkg = this.generateEvidencePackage('2026-09-03T00:00:00.000Z');
    return {
      robotRequirementId: 'REQ-ROB-6DOF-001',
      robotArchitectureId: 'ARCH-ROBOT-6DOF',
      jointDesignId: 'JNT-DES-6DOF-01',
      assemblyId: this.assemblyId,
      dofDefinitionId: 'DOF-ROBOT-6DOF-CONF',
      kinematicChainId: this.chainId,
      verificationId: 'VERIF-EPC-043',
      evidenceHash: pkg.evidenceHash
    };
  }
}
