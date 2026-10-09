/**
 * SECP CAD Kernel — Hierarchical Assembly Kinematics & DOF Solver (PATCH-039C)
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Engineering SOT: EngineeringDocument remains the sole engineering SOT.
 * 2. System Mobility Evaluation: Evaluates Grubler-Kutzbach mobility criterion for 3D assemblies:
 *    DOF = 6 * (N - 1) - \sum (6 - f_i)
 *    where N is number of rigid body instances, and f_i is freedom of joint i.
 * 3. Multi-Level Motion Propagation: Drives joint parameters (Revolute angle, Prismatic displacement)
 *    and updates downstream occurrence transforms in SE(3) deterministically.
 * 4. Immutability: Source EngineeringDocuments and child documents are NEVER mutated.
 * 5. Determinism: Identical joint inputs produce identical 4x4 matrix transforms regardless of execution environment.
 */

import {
  EngineeringDocument,
  AssemblyInstance,
  AssemblyMate
} from './CADDocument';
import { IDocumentResolver, InMemoryDocumentResolver } from './DocumentResolver';
import {
  AssemblyTransformMatrix,
  Matrix4x4Data
} from './RecursiveAssemblyEvaluator';

export type KinematicJointType =
  | 'RIGID'       // 0 DOF (6 constrained)
  | 'REVOLUTE'    // 1 DOF (rotational around axis)
  | 'PRISMATIC'   // 1 DOF (translational along axis)
  | 'CYLINDRICAL' // 2 DOF (1 rotation + 1 translation)
  | 'SPHERICAL'   // 3 DOF (3 rotations)
  | 'PLANAR'      // 3 DOF (2 translations + 1 rotation)
  | 'FREE';       // 6 DOF (unconstrained)

export type SystemMobilityStatus =
  | 'FULLY_CONSTRAINED'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'UNBOUND'
  | 'ERROR';

export interface JointDOFDetailed {
  mateId: string;
  mateType: string;
  jointType: KinematicJointType;
  allowedDOFs: number;
  constrainedDOFs: number;
  driverParameter?: string; // e.g. 'ANGLE' | 'OFFSET'
}

export interface SystemDOFEvaluationResult {
  status: SystemMobilityStatus;
  totalInstances: number;
  totalMates: number;
  totalSystemDOFs: number;       // 6 * (N - 1) for rigid bodies (ignoring grounded root)
  constrainedDOFs: number;
  unconstrainedDOFs: number;
  joints: JointDOFDetailed[];
  groundedInstanceId?: string;
  errors?: string[];
}

export interface DrivenJointMotion {
  mateId: string;
  parameterType: 'ANGLE' | 'OFFSET';
  value: number; // Radians for ANGLE, meters/mm for OFFSET
}

export interface HierarchyKinematicTransform {
  occurrencePath: string;
  worldMatrix: Matrix4x4Data;
  localTransform: Matrix4x4Data;
}

export interface KinematicMotionEvaluationResult {
  status: 'SUCCESS' | 'DRIVER_NOT_FOUND' | 'INVALID_PATH' | 'CYCLE_ERROR' | 'EVALUATION_ERROR';
  transforms: Map<string, HierarchyKinematicTransform>; // occurrencePath -> World transform
  errors?: string[];
}

import {
  AssemblyKinematicState,
  KinematicDriverState,
  KinematicOccurrenceState
} from './AssemblyKinematicState';
import { KinematicDriverResolver } from './KinematicDriverResolver';

export class HierarchicalKinematicSolver {

  public static solveKinematicState(
    rootDoc: EngineeringDocument,
    requestedDrivers: Partial<KinematicDriverState>[],
    resolver?: IDocumentResolver
  ): AssemblyKinematicState {
    const activeResolver = resolver || new InMemoryDocumentResolver();
    const diagnostics: string[] = [];

    // 1. Evaluate Degrees of Freedom
    const dofResult = this.evaluateSystemDOF(rootDoc, activeResolver);
    if (dofResult.errors) {
      diagnostics.push(...dofResult.errors);
    }

    // 2. Resolve Drivers with limits and validation
    const resolvedDrivers: KinematicDriverState[] = [];
    const allMates = this.collectAllMatesRecursively(rootDoc, activeResolver);

    for (const req of requestedDrivers) {
      const mate = allMates.get(req.mateId || '');
      if (!mate) {
        resolvedDrivers.push({
          mateId: req.mateId || 'UNKNOWN',
          parameterName: req.parameterName || 'UNKNOWN',
          value: req.value || 0,
          status: 'INVALID_MATE',
          message: `Mate ${req.mateId} not found in assembly hierarchy`
        });
        continue;
      }

      const resolved = KinematicDriverResolver.resolve(
        mate,
        req.parameterName as 'ANGLE' | 'OFFSET',
        req.value !== undefined ? req.value : 0
      );
      resolvedDrivers.push(resolved);
    }

    // 3. Map active drivers for motion evaluation
    const drivenMotions: DrivenJointMotion[] = resolvedDrivers
      .filter(d => d.status === 'ACTIVE')
      .map(d => ({
        mateId: d.mateId,
        parameterType: d.parameterName as 'ANGLE' | 'OFFSET',
        value: d.value
      }));

    // 4. Compute World Transforms
    const motionResult = this.applyJointMotion(rootDoc, drivenMotions, activeResolver);
    if (motionResult.errors) {
      diagnostics.push(...motionResult.errors);
    }

    // 5. Build Occurrence States
    const occurrences: KinematicOccurrenceState[] = [];
    const groundedId = dofResult.groundedInstanceId;

    for (const [path, transform] of motionResult.transforms) {
      const pathParts = path.split('/');
      const lastInstId = pathParts[pathParts.length - 1];
      
      occurrences.push({
        instanceId: lastInstId,
        occurrencePath: pathParts,
        worldTransform: transform.worldMatrix,
        isGrounded: lastInstId === groundedId
      });
    }

    return {
      assemblyDocumentId: rootDoc.documentId,
      revision: rootDoc.revision,
      solved: motionResult.status === 'SUCCESS',
      degreesOfFreedom: this.computeTotalDOF(rootDoc, activeResolver),
      constrainedDegreesOfFreedom: dofResult.constrainedDOFs,
      occurrences,
      drivers: resolvedDrivers,
      diagnostics
    };
  }

  private static collectAllMatesRecursively(
    doc: EngineeringDocument,
    resolver: IDocumentResolver,
    visited = new Set<string>(),
    acc = new Map<string, AssemblyMate>()
  ): Map<string, AssemblyMate> {
    if (!doc || visited.has(doc.documentId)) return acc;
    visited.add(doc.documentId);

    const mates = doc.assembly?.constraints || [];
    for (const m of mates) {
      if (m.id) acc.set(m.id, m);
    }

    const instances = doc.assembly?.instances || [];
    for (const inst of instances) {
      if (inst.documentId) {
        const child = resolver.resolve(inst.documentId);
        if (child) {
          this.collectAllMatesRecursively(child, resolver, visited, acc);
        }
      }
    }

    return acc;
  }

  /**
   * Evaluates degrees of freedom and system mobility for a hierarchical assembly.
   */
  public static evaluateSystemDOF(
    rootDoc: EngineeringDocument,
    resolver?: IDocumentResolver
  ): SystemDOFEvaluationResult {
    const activeResolver = resolver || new InMemoryDocumentResolver();

    if (rootDoc.type !== 'ASSEMBLY' || !rootDoc.assembly) {
      return {
        status: 'UNBOUND',
        totalInstances: 0,
        totalMates: 0,
        totalSystemDOFs: 0,
        constrainedDOFs: 0,
        unconstrainedDOFs: 0,
        joints: [],
        errors: ['Document is not an ASSEMBLY']
      };
    }

    const instances = rootDoc.assembly.instances || [];
    const mates = rootDoc.assembly.constraints || [];

    // Filter out suppressed instances
    const activeInstances = instances.filter(i => !i.suppressed && !(i as any).isSuppressed);
    const numInstances = activeInstances.length;

    if (numInstances === 0) {
      return {
        status: 'FULLY_CONSTRAINED',
        totalInstances: 0,
        totalMates: 0,
        totalSystemDOFs: 0,
        constrainedDOFs: 0,
        unconstrainedDOFs: 0,
        joints: []
      };
    }

    // Identify grounded instance
    const grounded = activeInstances.find(i => i.grounded || (i as any).isGrounded) || activeInstances[0];

    // System DOFs for ungrounded bodies (6 DOFs per moving body)
    const movingBodies = Math.max(0, numInstances - (grounded ? 1 : 0));
    const totalSystemDOFs = movingBodies * 6;

    let constrainedDOFs = 0;
    const joints: JointDOFDetailed[] = [];
    const errors: string[] = [];

    for (const mate of mates) {
      if (mate.suppressed || (mate as any).isSuppressed) continue;

      const jointInfo = this.classifyMateJoint(mate);
      joints.push(jointInfo);
      constrainedDOFs += jointInfo.constrainedDOFs;
    }

    const unconstrainedDOFs = totalSystemDOFs - constrainedDOFs;

    let status: SystemMobilityStatus = 'FULLY_CONSTRAINED';
    if (unconstrainedDOFs > 0) {
      status = 'UNDER_CONSTRAINED';
    } else if (unconstrainedDOFs < 0) {
      status = 'OVER_CONSTRAINED';
    }

    return {
      status,
      totalInstances: numInstances,
      totalMates: mates.length,
      totalSystemDOFs,
      constrainedDOFs,
      unconstrainedDOFs,
      joints,
      groundedInstanceId: grounded ? (grounded.id || (grounded as any).instanceId) : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Applies joint drivers (e.g. angle rotation or linear offset) and computes updated
   * world transforms for all occurrence paths in the assembly hierarchy.
   *
   * Crucially: DOES NOT MUTATE rootDoc or any child documents.
   */
  public static applyJointMotion(
    rootDoc: EngineeringDocument,
    drivenMotions: DrivenJointMotion[],
    resolver?: IDocumentResolver
  ): KinematicMotionEvaluationResult {
    const activeResolver = resolver || new InMemoryDocumentResolver();
    const transforms = new Map<string, HierarchyKinematicTransform>();

    if (rootDoc.type !== 'ASSEMBLY' || !rootDoc.assembly) {
      return {
        status: 'INVALID_PATH',
        transforms,
        errors: ['Root document is not an assembly']
      };
    }

    // Map driven motions by mateId
    const motionMap = new Map<string, DrivenJointMotion>();
    for (const m of drivenMotions) {
      motionMap.set(m.mateId, m);
    }

    // Recursively traverse assembly occurrences and apply joint driver offsets
    const visitedDocs = new Set<string>();
    visitedDocs.add(rootDoc.documentId);

    const processErr = this.traverseAndComputeMotionTransforms(
      rootDoc,
      '',
      AssemblyTransformMatrix.identity(),
      motionMap,
      activeResolver,
      visitedDocs,
      transforms
    );

    if (processErr) {
      return {
        status: processErr.status as any,
        transforms,
        errors: [processErr.message]
      };
    }

    return {
      status: 'SUCCESS',
      transforms
    };
  }

  /**
   * Helper to classify a mate into a kinematic joint with constrained/allowed DOFs.
   */
  public static classifyMateJoint(mate: AssemblyMate): JointDOFDetailed {
    const type = (mate.type || '').toUpperCase();

    switch (type) {
      case 'FASTENED':
      case 'FIXED':
      case 'RIGID':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'RIGID',
          allowedDOFs: 0,
          constrainedDOFs: 6
        };

      case 'REVOLUTE':
      case 'PIN':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'REVOLUTE',
          allowedDOFs: 1,
          constrainedDOFs: 5,
          driverParameter: 'ANGLE'
        };

      case 'SLIDER':
      case 'PRISMATIC':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'PRISMATIC',
          allowedDOFs: 1,
          constrainedDOFs: 5,
          driverParameter: 'OFFSET'
        };

      case 'CYLINDRICAL':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'CYLINDRICAL',
          allowedDOFs: 2,
          constrainedDOFs: 4,
          driverParameter: 'ANGLE'
        };

      case 'BALL':
      case 'SPHERICAL':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'SPHERICAL',
          allowedDOFs: 3,
          constrainedDOFs: 3
        };

      case 'PLANAR':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'PLANAR',
          allowedDOFs: 3,
          constrainedDOFs: 3
        };

      case 'CONCENTRIC':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'CYLINDRICAL',
          allowedDOFs: 2,
          constrainedDOFs: 4,
          driverParameter: 'ANGLE'
        };

      case 'DISTANCE':
      case 'COINCIDENT':
      case 'PARALLEL':
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'FREE',
          allowedDOFs: 5,
          constrainedDOFs: 1
        };

      default:
        return {
          mateId: mate.id,
          mateType: mate.type,
          jointType: 'RIGID',
          allowedDOFs: 0,
          constrainedDOFs: 6
        };
    }
  }

  private static traverseAndComputeMotionTransforms(
    doc: EngineeringDocument,
    parentPath: string,
    parentWorldMatrix: Matrix4x4Data,
    motionMap: Map<string, DrivenJointMotion>,
    resolver: IDocumentResolver,
    visitedDocs: Set<string>,
    outTransforms: Map<string, HierarchyKinematicTransform>
  ): { status: string; message: string } | null {
    if (!doc.assembly) return null;

    const instances = doc.assembly.instances || [];
    const mates = doc.assembly.constraints || [];

    for (const inst of instances) {
      if (inst.suppressed || (inst as any).isSuppressed) continue;

      const instId = inst.id || (inst as any).instanceId;
      const currentPath = parentPath ? `${parentPath}/${instId}` : instId;

      // Extract local transform position & rotation
      let pos = (inst as any).position || inst.transform?.translation || { x: 0, y: 0, z: 0 };
      let rot = (inst as any).rotation || inst.transform?.rotation || { x: 0, y: 0, z: 0 };

      let localMatrix = AssemblyTransformMatrix.fromTranslationAndRotation(pos, rot);

      // Check if any mate attached to this instance is driven
      const instMates = mates.filter(m =>
        !m.suppressed && !(m as any).isSuppressed &&
        (m.entity1?.occurrencePath.endsWith(instId) || m.entity2?.occurrencePath.endsWith(instId))
      );

      for (const m of instMates) {
        const motion = motionMap.get(m.id);
        if (motion) {
          // Determine if we should apply this motion to this instance.
          // In a simple hierarchy, we apply to entity2 (the "child" of the mate)
          const isEntity2 = m.entity2?.occurrencePath.endsWith(instId);
          if (isEntity2) {
            const jointInfo = this.classifyMateJoint(m);
            localMatrix = this.applyDriverToMatrix(localMatrix, jointInfo, motion, m);
          }
        }
      }

      // Compose world matrix
      const worldMatrix = AssemblyTransformMatrix.multiply(parentWorldMatrix, localMatrix);

      outTransforms.set(currentPath, {
        occurrencePath: currentPath,
        worldMatrix,
        localTransform: localMatrix
      });

      // Recurse down sub-assemblies
      if (inst.documentId) {
        const childDoc = resolver.resolve(inst.documentId);
        if (!childDoc) {
          return { status: 'INVALID_PATH', message: `Missing child document: ${inst.documentId}` };
        }

        if (visitedDocs.has(childDoc.documentId)) {
          return { status: 'CYCLE_ERROR', message: `Cyclic sub-assembly reference detected: ${childDoc.documentId}` };
        }

        const nextVisited = new Set(visitedDocs);
        nextVisited.add(childDoc.documentId);

        const childErr = this.traverseAndComputeMotionTransforms(
          childDoc,
          currentPath,
          worldMatrix,
          motionMap,
          resolver,
          nextVisited,
          outTransforms
        );

        if (childErr) return childErr;
      }
    }

    return null;
  }

  private static applyDriverToMatrix(
    baseMatrix: Matrix4x4Data,
    joint: JointDOFDetailed,
    motion: DrivenJointMotion,
    mate?: AssemblyMate
  ): Matrix4x4Data {
    if (joint.jointType === 'REVOLUTE' || joint.jointType === 'CYLINDRICAL') {
      if (motion.parameterType === 'ANGLE') {
        const angleDeg = (motion.value * 180) / Math.PI;
        
        // Use axis from mate parameters if available (Real Axis Kinematics)
        const axis = (mate?.parameters as any)?.axis || { x: 0, y: 0, z: 1 };
        
        // Create rotation matrix around arbitrary axis
        // For simplicity in this proof, we check common machine axes
        let rotation: { x: number; y: number; z: number };
        if (Math.abs(axis.x) > 0.9) rotation = { x: angleDeg, y: 0, z: 0 };
        else if (Math.abs(axis.y) > 0.9) rotation = { x: 0, y: angleDeg, z: 0 };
        else rotation = { x: 0, y: 0, z: angleDeg };

        const rotMat = AssemblyTransformMatrix.fromTranslationAndRotation({ x: 0, y: 0, z: 0 }, rotation);
        return AssemblyTransformMatrix.multiply(baseMatrix, rotMat);
      }
    } else if (joint.jointType === 'PRISMATIC') {
      if (motion.parameterType === 'OFFSET') {
        const axis = (mate?.parameters as any)?.axis || { x: 0, y: 0, z: 1 };
        const translation = {
          x: axis.x * motion.value,
          y: axis.y * motion.value,
          z: axis.z * motion.value
        };
        const transMat = AssemblyTransformMatrix.fromTranslationAndRotation(translation, { x: 0, y: 0, z: 0 });
        return AssemblyTransformMatrix.multiply(baseMatrix, transMat);
      }
    }

    return baseMatrix;
  }

  private static computeTotalDOF(
    doc: EngineeringDocument,
    resolver: IDocumentResolver,
    visited = new Set<string>()
  ): number {
    if (!doc || visited.has(doc.documentId)) return 0;
    visited.add(doc.documentId);

    let total = 0;
    const mates = doc.assembly?.constraints || [];
    for (const m of mates) {
      if (m.type === 'REVOLUTE' || m.type === 'PRISMATIC') total += 1;
      if (m.type === 'CYLINDRICAL') total += 2;
    }

    const instances = doc.assembly?.instances || [];
    for (const inst of instances) {
      if (inst.documentId) {
        const child = resolver.resolve(inst.documentId);
        if (child) total += this.computeTotalDOF(child, resolver, visited);
      }
    }
    return total;
  }

  private static countConstrainedInstances(doc: EngineeringDocument, resolver: IDocumentResolver): number {
    const instances = new Set<string>();
    const mates = doc.assembly?.constraints || [];
    for (const m of mates) {
      if (m.entity1?.occurrencePath) instances.add(m.entity1.occurrencePath);
      if (m.entity2?.occurrencePath) instances.add(m.entity2.occurrencePath);
    }
    return instances.size;
  }
}
