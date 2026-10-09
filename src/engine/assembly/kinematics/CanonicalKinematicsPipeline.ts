/**
 * SECP — PROMPT-049 Canonical Kinematics Pipeline
 * 
 * Canonical Assembly Kinematics Pipeline connecting EngineeringDocument
 * directly to the mathematical joint constraint solver, independent verification,
 * evidence ledger, and frontend projection.
 * 
 * Mandatory Path:
 *   Joint Definition
 *         ↓
 *   Canonical Assembly
 *         ↓
 *   Kinematic Constraint
 *         ↓
 *   Kinematics Solver
 *         ↓
 *   Solved Joint State
 *         ↓
 *   Canonical Component Transform
 *         ↓
 *   Assembly Evaluation
 *         ↓
 *   Verification
 *         ↓
 *   Evidence
 *         ↓
 *   EngineeringDocument
 *         ↓
 *   Frontend Projection
 * 
 * Core Mandate:
 * "A TRANSFORM IS NOT KINEMATIC TRUTH."
 * "THE SOLVER MUST SOLVE THE CANONICAL ASSEMBLY — NOT OWN IT."
 */

import { EngineeringDocument, AssemblyInstance } from '../../cad-kernel/document/CADDocument';
import { AssemblyIntentMutator } from '../../cad-kernel/document/AssemblyIntentMutator';
import { DocumentEvaluator } from '../../cad-kernel/document/DocumentEvaluator';
import {
  MechanicalJoint,
  ComponentKinematicState,
  JointSolverDiagnostic,
  AssemblyMobilityReport,
  TransformMatrix4x4,
  JointStateStatus
} from '../joints/MechanicalJointTypes';
import { JointConstraintSolver } from '../joints/JointConstraintSolver';
import { JointKinematicsEngine } from '../joints/JointKinematicsEngine';
import { CoordinateFrameEngine } from '../joints/CoordinateFrameEngine';
import { DOFAnalyzer } from '../joints/DOFAnalyzer';
import { DynamicClearanceEngine } from '../joints/DynamicClearanceEngine';
import { CanonicalKinematicsVerifier, KinematicVerificationResult } from './CanonicalKinematicsVerifier';

export interface KinematicSolution {
  assemblyRevision: number;
  jointStates: Record<string, {
    jointId: string;
    currentPosition: number;
    secondaryPosition?: number;
    tertiaryPosition?: number;
    state: JointStateStatus;
    residual: number;
    limitViolation?: boolean;
  }>;
  componentTransforms: Record<string, {
    instanceId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    matrix: TransformMatrix4x4;
  }>;
  mobilityReport: AssemblyMobilityReport;
  convergenceState: 'CONVERGED' | 'FAILED' | 'DIVERGED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'UNSUPPORTED';
  iterationCount: number;
  maxResidual: number;
  loopClosureErrors: Array<{ loopPath: string[]; residual: number }>;
  collisionOccurred: boolean;
  solutionRevision: number;
  evidenceHash: string;
}

export interface KinematicPipelineOutput {
  updatedDocument: EngineeringDocument;
  solution: KinematicSolution;
  verification: KinematicVerificationResult;
  evidenceHash: string;
  frontendProjection: {
    documentId: string;
    revision: number;
    occurrences: Array<{
      instanceId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      isGrounded: boolean;
      matrixElements: number[];
    }>;
    jointVisuals: Array<{
      jointId: string;
      type: string;
      origin: { x: number; y: number; z: number };
      axis: { x: number; y: number; z: number };
      currentValue: number;
      status: JointStateStatus;
    }>;
  };
}

export class CanonicalKinematicsPipeline {
  /**
   * Primary entry point for solving Canonical Assembly Kinematics.
   * Reads EngineeringDocument, computes kinematics, verifies constraints,
   * generates evidence, updates document via pure intent mutator, and projects state.
   */
  public static solvePipeline(
    document: EngineeringDocument,
    options: {
      tolerance?: number;
      maxIterations?: number;
      checkCollisions?: boolean;
      drivenJoints?: Array<{ jointId: string; position: number; secondaryPosition?: number; tertiaryPosition?: number }>;
    } = {}
  ): KinematicPipelineOutput {
    if (!document || document.type !== 'ASSEMBLY' || !document.assembly) {
      throw new Error('[SECP_KINEMATICS_ERROR] Valid ASSEMBLY EngineeringDocument required.');
    }

    const tolerance = options.tolerance ?? document.assembly.kinematicConfiguration?.tolerance ?? 1e-6;
    const maxIterations = options.maxIterations ?? document.assembly.kinematicConfiguration?.maxIterations ?? 50;
    const checkCollisions = options.checkCollisions ?? document.assembly.kinematicConfiguration?.collisionDetectionEnabled ?? false;

    // Step 1: Joint Definition & Motion Override Synchronization
    let workingJoints: MechanicalJoint[] = (document.assembly.joints || []).map(j => ({
      ...j,
      id: j.id || j.jointId || '',
      jointId: j.jointId || j.id || '',
      type: j.type || j.jointType || 'FIXED',
      jointType: j.jointType || j.type || 'FIXED',
      parentComponentId: j.parentComponentId || j.componentA || '',
      childComponentId: j.childComponentId || j.componentB || '',
      componentA: j.componentA || j.parentComponentId || '',
      componentB: j.componentB || j.childComponentId || ''
    }));

    if (options.drivenJoints) {
      for (const dj of options.drivenJoints) {
        const jIdx = workingJoints.findIndex(j => j.id === dj.jointId || j.jointId === dj.jointId);
        if (jIdx !== -1) {
          workingJoints[jIdx] = {
            ...workingJoints[jIdx],
            currentPosition: dj.position,
            motionParameter: dj.position,
            currentPositionSecondary: dj.secondaryPosition !== undefined ? dj.secondaryPosition : workingJoints[jIdx].currentPositionSecondary,
            currentPositionTertiary: dj.tertiaryPosition !== undefined ? dj.tertiaryPosition : workingJoints[jIdx].currentPositionTertiary
          };
        }
      }
    }

    // Step 2: Canonical Assembly Instance to Kinematic Component Mapping
    const instances: AssemblyInstance[] = document.assembly.instances || [];
    const components: ComponentKinematicState[] = instances.map(inst => {
      const isGrounded = !!inst.isGrounded || !!inst.grounded;
      const posX = inst.position?.x ?? 0;
      const posY = inst.position?.y ?? 0;
      const posZ = inst.position?.z ?? 0;
      const rotX = (inst.rotation?.x ?? 0) * Math.PI / 180;
      const rotY = (inst.rotation?.y ?? 0) * Math.PI / 180;
      const rotZ = (inst.rotation?.z ?? 0) * Math.PI / 180;

      const rotMat3 = CoordinateFrameEngine.eulerToRotationMatrix(rotX, rotY, rotZ);
      const worldTransform = CoordinateFrameEngine.makeTransform(rotMat3, { x: posX, y: posY, z: posZ });

      return {
        componentId: inst.instanceId,
        name: inst.instanceId,
        isGrounded,
        massKg: 1.0,
        worldTransform,
        worldOrigin: { x: posX, y: posY, z: posZ },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: isGrounded ? 0 : 3,
        rotationalDOF: isGrounded ? 0 : 3,
        remainingDOF: isGrounded ? 0 : 6,
        status: 'SOLVED'
      };
    });

    // Step 3: Reference Geometry & Topology Validation
    for (const joint of workingJoints) {
      const parentExists = components.some(c => c.componentId === joint.parentComponentId);
      const childExists = components.some(c => c.componentId === joint.childComponentId);
      if (!parentExists || !childExists) {
        joint.state = 'INVALID_GEOMETRY';
        joint.solverState = 'INVALID_GEOMETRY';
      }
    }

    // Step 4: Mobility & DOF Analysis
    const mobilityReport = DOFAnalyzer.analyzeAssemblyMobility(components, workingJoints);

    // Step 5: Kinematics Solver Execution (Iterative Newton-Raphson & Coupling)
    // Update joint transform propagation based on driver values
    for (const joint of workingJoints) {
      if (joint.isSuppressed || joint.state === 'INVALID_GEOMETRY') continue;

      const parentComp = components.find(c => c.componentId === joint.parentComponentId);
      const childComp = components.find(c => c.componentId === joint.childComponentId);

      if (parentComp && childComp && !childComp.isGrounded) {
        // Calculate relative kinematic transform produced by joint
        const relMat = JointKinematicsEngine.computeJointRelativeTransform(joint);
        
        // Propagate child world transform: T_child = T_parent * T_rel
        const newChildTransform = CoordinateFrameEngine.multiplyTransforms(parentComp.worldTransform, relMat);
        childComp.worldTransform = newChildTransform;
        childComp.worldOrigin = {
          x: newChildTransform.elements[3],
          y: newChildTransform.elements[7],
          z: newChildTransform.elements[11]
        };
      }
    }

    // Solve assembly constraints for fine alignment & loop closures
    const solveResult = JointConstraintSolver.solveAssembly(components, workingJoints, tolerance, maxIterations);

    // Check Limit Violations & Joint Residuals
    let hasLimitViolation = false;
    const jointStates: KinematicSolution['jointStates'] = {};
    for (const joint of workingJoints) {
      let limitViolated = false;
      if (joint.primaryLimit && joint.primaryLimit.enabled) {
        if (joint.currentPosition < joint.primaryLimit.minimum || joint.currentPosition > joint.primaryLimit.maximum) {
          limitViolated = true;
          hasLimitViolation = true;
          joint.state = 'LIMIT_REACHED';
          joint.limitStatus = joint.currentPosition < joint.primaryLimit.minimum ? 'MIN_LIMIT_EXCEEDED' : 'MAX_LIMIT_EXCEEDED';
        }
      }

      const diag = solveResult.diagnostics.find(d => d.jointId === joint.id);
      const res = diag?.maxResidual ?? 0;

      jointStates[joint.id] = {
        jointId: joint.id,
        currentPosition: joint.currentPosition,
        secondaryPosition: joint.currentPositionSecondary,
        tertiaryPosition: joint.currentPositionTertiary,
        state: joint.state,
        residual: res,
        limitViolation: limitViolated
      };
    }

    // Step 6: Loop Closure & Collision Evaluation
    const loopClosureErrors: Array<{ loopPath: string[]; residual: number }> = [];
    // Evaluate loop closures if mechanism contains cycles
    const loopResidual = JointKinematicsEngine.evaluateKinematicLoopClosure(components, workingJoints);
    if (loopResidual > tolerance * 10) {
      loopClosureErrors.push({ loopPath: workingJoints.map(j => j.id), residual: loopResidual });
    }

    let collisionOccurred = false;
    if (checkCollisions) {
      const clearanceRec = DynamicClearanceEngine.evaluateDynamicClearance(components, 0, 0);
      collisionOccurred = clearanceRec.collisionDetected;
    }

    // Determine Overall Convergence State
    let convergenceState: KinematicSolution['convergenceState'] = 'CONVERGED';
    if (!solveResult.converged) {
      convergenceState = 'DIVERGED';
    } else if (solveResult.maxResidual > tolerance) {
      convergenceState = 'FAILED';
    } else if (hasLimitViolation) {
      convergenceState = 'FAILED';
    } else if (mobilityReport.spatialMobilityM > 0) {
      convergenceState = 'UNDER_CONSTRAINED';
    } else if (mobilityReport.spatialMobilityM < 0) {
      convergenceState = 'OVER_CONSTRAINED';
    }

    // Map Solved Component Transforms
    const componentTransforms: KinematicSolution['componentTransforms'] = {};
    const batchTransforms: Array<{ instanceId: string; position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } }> = [];

    for (const comp of components) {
      const pos = { ...comp.worldOrigin };
      const rotMat3 = CoordinateFrameEngine.getRotationMatrix(comp.worldTransform);
      const rot = CoordinateFrameEngine.rotationMatrixToEuler(rotMat3);
      const rotDeg = {
        x: rot.x * 180 / Math.PI,
        y: rot.y * 180 / Math.PI,
        z: rot.z * 180 / Math.PI
      };

      componentTransforms[comp.componentId] = {
        instanceId: comp.componentId,
        position: pos,
        rotation: rotDeg,
        matrix: comp.worldTransform
      };

      batchTransforms.push({
        instanceId: comp.componentId,
        position: pos,
        rotation: rotDeg
      });
    }

    // Step 7: Independent Verification Engine
    const verification = CanonicalKinematicsVerifier.verifySolution(
      document,
      workingJoints,
      components,
      tolerance
    );

    // Step 8: Forensic Evidence Record Generation
    const evidencePayload = {
      documentId: document.documentId,
      convergenceState,
      mobilityM: mobilityReport.spatialMobilityM,
      maxResidual: solveResult.maxResidual,
      iterations: solveResult.iterations,
      verificationVerdict: verification.verdict,
      jointCount: workingJoints.length,
      componentCount: components.length
    };

    const evidenceHash = CanonicalKinematicsVerifier.computeKinematicEvidenceHash(evidencePayload);

    const solution: KinematicSolution = {
      assemblyRevision: document.revision,
      jointStates,
      componentTransforms,
      mobilityReport,
      convergenceState,
      iterationCount: solveResult.iterations,
      maxResidual: solveResult.maxResidual,
      loopClosureErrors,
      collisionOccurred,
      solutionRevision: (typeof document.revision === 'number' ? document.revision + 1 : 1),
      evidenceHash
    };

    // Step 9: Mutate EngineeringDocument Canonical State via Intent Mutator
    const applySolutionAction = {
      type: 'APPLY_KINEMATIC_SOLUTION' as const,
      transforms: batchTransforms,
      jointStates: Object.values(jointStates).map(js => ({
        jointId: js.jointId,
        currentPosition: js.currentPosition,
        state: js.state,
        residual: js.residual
      })),
      evidenceHash
    };

    let updatedDoc = AssemblyIntentMutator.apply(document, applySolutionAction);

    // Re-evaluate document with DocumentEvaluator to regenerate assembly geometry & lineage
    const evalRes = DocumentEvaluator.evaluate(updatedDoc, { generateMesh: true });
    if (evalRes && evalRes.document) {
      updatedDoc = evalRes.document;
    }

    // Step 10: Frontend Projection Construction
    const frontendProjection = {
      documentId: updatedDoc.documentId,
      revision: updatedDoc.revision,
      occurrences: components.map(c => ({
        instanceId: c.componentId,
        position: { ...c.worldOrigin },
        rotation: componentTransforms[c.componentId].rotation,
        isGrounded: c.isGrounded,
        matrixElements: [...c.worldTransform.elements]
      })),
      jointVisuals: workingJoints.map(j => ({
        jointId: j.id,
        type: j.type,
        origin: { ...j.jointOrigin },
        axis: { ...j.jointAxis },
        currentValue: j.currentPosition,
        status: j.state
      }))
    };

    return {
      updatedDocument: updatedDoc,
      solution,
      verification,
      evidenceHash,
      frontendProjection
    };
  }
}
