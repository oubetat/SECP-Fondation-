import crypto from 'crypto';
import { AssemblyConstraint } from '../constraints/AssemblyConstraintModel';
import { KinematicState } from './KinematicState';
import { KinematicBody } from './KinematicBody';
import { KinematicJoint, JointCoordinateValue } from './KinematicJointModel';
import { KinematicJointEvaluator, multiplyTransforms } from './KinematicJoint';
import { KinematicDiagnostics } from './KinematicDiagnostics';
import { KinematicValidator } from './KinematicValidator';
import {
  KinematicSolveResult,
  KinematicSolveStatus,
  KinematicJointState,
  KinematicJointResidualInfo,
} from './KinematicSolveResult';
import {
  KinematicConfiguration,
  computeConfigurationHash,
} from './KinematicConfiguration';
import { KinematicMotionCommand, MotionExecutionOptions } from './KinematicMotionCommand';
import {
  KinematicTransactionRecord,
  KinematicTransactionManager,
} from './KinematicTransaction';

export class KinematicAssemblyEngine {
  public static readonly SOLVER_VERSION = 'SECP-KINEMATICS-v1.0.0';

  /**
   * Solves forward kinematics for an assembly state
   */
  public static solveForwardKinematics(
    state: KinematicState,
    coordinatesOverride?: Record<string, JointCoordinateValue>,
    assemblyConstraints: AssemblyConstraint[] = []
  ): KinematicSolveResult {
    const bodies = state.getBodies();
    const joints = state.getJoints();

    const configurationId = `CONFIG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const diagnostics: string[] = [];

    // 1. Initial graph analysis
    const graphAnalysis = KinematicDiagnostics.analyzeKinematicGraph(bodies, joints);

    if (graphAnalysis.hasCycles) {
      // Closed loop detection: mark as UNPROVEN or CONFLICT as specified in guidelines
      return {
        status: 'UNPROVEN',
        configurationId,
        bodyTransforms: {},
        jointStates: {},
        totalDOF: 0,
        constrainedDOF: 0,
        remainingDOF: 0,
        maximumResidual: 1.0,
        residuals: [],
        diagnostics: [`Closed kinematic loop detected: ${graphAnalysis.reason}`],
        configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
        evidenceId: `EVID-KIN-UNPROVEN-${Date.now()}`,
      };
    }

    if (!graphAnalysis.valid) {
      return {
        status: 'CONFLICT',
        configurationId,
        bodyTransforms: {},
        jointStates: {},
        totalDOF: 0,
        constrainedDOF: 0,
        remainingDOF: 0,
        maximumResidual: 1.0,
        residuals: [],
        diagnostics: [`Kinematic graph invalid: ${graphAnalysis.reason}`],
        configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
        evidenceId: `EVID-KIN-CONFLICT-${Date.now()}`,
      };
    }

    // 2. Validate joint definitions & requested coordinates
    const enabledJoints = joints.filter(j => j.enabled && !j.suppressed);
    for (const j of enabledJoints) {
      const defVal = KinematicJointEvaluator.validateJointDefinition(j);
      if (!defVal.valid) {
        return {
          status: 'INVALID',
          configurationId,
          bodyTransforms: {},
          jointStates: {},
          totalDOF: 0,
          constrainedDOF: 0,
          remainingDOF: 0,
          maximumResidual: 1.0,
          residuals: [],
          diagnostics: [`Invalid joint definition for ${j.jointId}: ${defVal.reason}`],
          configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
          evidenceId: `EVID-KIN-INVALID-${Date.now()}`,
        };
      }

      const q = coordinatesOverride && coordinatesOverride[j.jointId] !== undefined
        ? coordinatesOverride[j.jointId]
        : j.position;

      const limitVal = KinematicJointEvaluator.validateJointLimits(j, q);
      if (!limitVal.valid) {
        return {
          status: 'LIMIT_VIOLATION',
          configurationId,
          bodyTransforms: {},
          jointStates: {},
          totalDOF: 0,
          constrainedDOF: 0,
          remainingDOF: 0,
          maximumResidual: 1.0,
          residuals: [],
          diagnostics: [`Joint ${j.jointId} limit violation: ${limitVal.reason || limitVal.violationType}`],
          configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
          evidenceId: `EVID-KIN-LIMIT-${Date.now()}`,
        };
      }
    }

    // 3. Forward Kinematics Tree Propagation
    // BFS queue starting from ground body
    const groundBody = state.getGroundBody();
    if (!groundBody) {
      return {
        status: 'CONFLICT',
        configurationId,
        bodyTransforms: {},
        jointStates: {},
        totalDOF: 0,
        constrainedDOF: 0,
        remainingDOF: 0,
        maximumResidual: 1.0,
        residuals: [],
        diagnostics: ['Ground body not found'],
        configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
        evidenceId: `EVID-KIN-NOGROUND-${Date.now()}`,
      };
    }

    const bodyTransformMap: Record<string, number[][]> = {};
    bodyTransformMap[groundBody.bodyId] = JSON.parse(JSON.stringify(groundBody.worldTransform));

    const visitedBodies = new Set<string>([groundBody.bodyId]);
    const queue: string[] = [groundBody.bodyId];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const parentTransform = bodyTransformMap[parentId];

      // Find children connected through enabled joints
      const outgoingJoints = enabledJoints.filter(
        j => j.parentBodyId === parentId || j.childBodyId === parentId
      );

      for (const j of outgoingJoints) {
        const isParent = j.parentBodyId === parentId;
        const childId = isParent ? j.childBodyId : j.parentBodyId;

        if (!visitedBodies.has(childId)) {
          visitedBodies.add(childId);

          const q = coordinatesOverride && coordinatesOverride[j.jointId] !== undefined
            ? coordinatesOverride[j.jointId]
            : j.position;

          const relT = KinematicJointEvaluator.computeRelativeTransform(j, q);
          const childTransform = multiplyTransforms(parentTransform, relT);

          bodyTransformMap[childId] = childTransform;
          queue.push(childId);
        }
      }
    }

    // Apply calculated transforms to bodies in state
    for (const b of bodies) {
      if (bodyTransformMap[b.bodyId]) {
        b.worldTransform = JSON.parse(JSON.stringify(bodyTransformMap[b.bodyId]));
      }
    }

    // 4. Independent Validation
    const validationReport = KinematicValidator.validateAssemblyKinematics(
      bodies,
      joints,
      assemblyConstraints,
      coordinatesOverride
    );

    const jointStates: Record<string, KinematicJointState> = {};
    const jointResiduals: KinematicJointResidualInfo[] = [];

    for (const j of enabledJoints) {
      const coord = coordinatesOverride && coordinatesOverride[j.jointId] !== undefined
        ? coordinatesOverride[j.jointId]
        : j.position;

      const resInfo = validationReport.jointResiduals.find(r => r.jointId === j.jointId);
      const residual = resInfo ? resInfo.residual : 0;
      const satisfied = resInfo ? resInfo.satisfied : true;

      jointStates[j.jointId] = {
        position: coord,
        velocity: j.velocity,
        acceleration: j.acceleration,
        residual,
        satisfied,
        tolerance: j.tolerance,
      };

      jointResiduals.push({
        jointId: j.jointId,
        residual,
        tolerance: j.tolerance,
        satisfied,
        diagnostic: resInfo?.reason,
      });
    }

    // 5. DOF Accounting
    const dofAnalysis = KinematicDiagnostics.analyzeDegreesOfFreedom(bodies, joints);

    // 6. Configuration & Hash Generation
    const jointCoordsMap: Record<string, JointCoordinateValue> = {};
    for (const j of joints) {
      jointCoordsMap[j.jointId] = coordinatesOverride && coordinatesOverride[j.jointId] !== undefined
        ? coordinatesOverride[j.jointId]
        : j.position;
    }

    const config: KinematicConfiguration = {
      configurationId,
      assemblyId: state.assemblyId,
      jointCoordinates: jointCoordsMap,
      bodyTransforms: bodyTransformMap,
      timestamp: new Date().toISOString(),
      revisionId: state.revisionId,
    };

    const configHash = computeConfigurationHash(config);
    const evidenceId = `EVID-KIN-${configHash.substring(0, 16)}`;

    state.setConfiguration(config);

    return {
      status: validationReport.status,
      configurationId,
      bodyTransforms: bodyTransformMap,
      jointStates,
      totalDOF: dofAnalysis.totalInitialDOF,
      constrainedDOF: dofAnalysis.totalConstrainedDOF,
      remainingDOF: dofAnalysis.totalSystemMotionDOF,
      maximumResidual: validationReport.maximumJointResidual,
      residuals: jointResiduals,
      diagnostics: validationReport.diagnostics,
      configurationHash: configHash,
      evidenceId,
    };
  }

  /**
   * Applies an engineering motion command within an ACID transaction
   */
  public static applyMotionCommand(
    state: KinematicState,
    command: KinematicMotionCommand,
    options: MotionExecutionOptions = {},
    assemblyConstraints: AssemblyConstraint[] = []
  ): { success: boolean; result: KinematicSolveResult; transaction: KinematicTransactionRecord } {
    const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const snapshot = state.snapshot();
    const previousRevisionId = state.revisionId;

    const txRecord: KinematicTransactionRecord = {
      transactionId: txId,
      assemblyId: state.assemblyId,
      command,
      phase: 'BEGIN',
      committed: false,
      timestamp: new Date().toISOString(),
      previousRevisionId,
    };

    // Phase: VALIDATE_COMMAND
    txRecord.phase = 'VALIDATE_COMMAND';
    const joint = state.getJoint(command.jointId);
    if (!joint || !joint.enabled || joint.suppressed) {
      txRecord.phase = 'ROLLBACK';
      txRecord.errorMessage = `Joint ${command.jointId} not found or disabled`;
      state.restore(snapshot);
      KinematicTransactionManager.record(txRecord);

      const failResult: KinematicSolveResult = {
        status: 'INVALID',
        configurationId: `CONFIG-FAIL-${Date.now()}`,
        bodyTransforms: {},
        jointStates: {},
        totalDOF: 0,
        constrainedDOF: 0,
        remainingDOF: 0,
        maximumResidual: 1.0,
        residuals: [],
        diagnostics: [txRecord.errorMessage],
        configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
        evidenceId: `EVID-TX-FAIL-${Date.now()}`,
      };
      return { success: false, result: failResult, transaction: txRecord };
    }

    // Phase: CHECK_LIMITS
    txRecord.phase = 'CHECK_LIMITS';
    let targetPos = command.targetPosition !== undefined ? command.targetPosition : joint.position;

    const limitVal = KinematicJointEvaluator.validateJointLimits(joint, targetPos);
    if (!limitVal.valid) {
      if (options.clampToLimits && joint.limits) {
        if (typeof targetPos === 'number') {
          if (joint.limits.min !== undefined && targetPos < joint.limits.min) targetPos = joint.limits.min;
          if (joint.limits.max !== undefined && targetPos > joint.limits.max) targetPos = joint.limits.max;
        }
      } else {
        txRecord.phase = 'ROLLBACK';
        txRecord.errorMessage = `Limit violation: ${limitVal.reason || limitVal.violationType}`;
        state.restore(snapshot);
        KinematicTransactionManager.record(txRecord);

        const failResult: KinematicSolveResult = {
          status: 'LIMIT_VIOLATION',
          configurationId: `CONFIG-FAIL-${Date.now()}`,
          bodyTransforms: {},
          jointStates: {},
          totalDOF: 0,
          constrainedDOF: 0,
          remainingDOF: 0,
          maximumResidual: 1.0,
          residuals: [],
          diagnostics: [txRecord.errorMessage],
          configurationHash: '0000000000000000000000000000000000000000000000000000000000000000',
          evidenceId: `EVID-TX-FAIL-${Date.now()}`,
        };
        return { success: false, result: failResult, transaction: txRecord };
      }
    }

    // Phase: UPDATE_JOINT & SOLVE_KINEMATICS
    txRecord.phase = 'UPDATE_JOINT';
    joint.position = targetPos;
    if (command.targetVelocity !== undefined) joint.velocity = command.targetVelocity;
    if (command.targetAcceleration !== undefined) joint.acceleration = command.targetAcceleration;

    txRecord.phase = 'SOLVE_KINEMATICS';
    const solveResult = this.solveForwardKinematics(state, undefined, assemblyConstraints);
    txRecord.solveResult = solveResult;

    // Phase: INDEPENDENT_VERIFY & COMMIT/ROLLBACK
    txRecord.phase = 'INDEPENDENT_VERIFY';
    if (solveResult.status === 'CONVERGED' || solveResult.status === 'CONVERGED_WITH_REMAINING_DOF') {
      txRecord.phase = 'COMMIT';
      txRecord.committed = true;
      const nextRevNum = parseInt(state.revisionId.replace(/\D/g, '') || '0', 10) + 1;
      const newRevId = `REV-${nextRevNum}`;
      state.revisionId = newRevId;
      txRecord.newRevisionId = newRevId;

      KinematicTransactionManager.record(txRecord);
      return { success: true, result: solveResult, transaction: txRecord };
    } else {
      txRecord.phase = 'ROLLBACK';
      txRecord.committed = false;
      txRecord.errorMessage = `Kinematic solve failed with status: ${solveResult.status}`;
      state.restore(snapshot);

      KinematicTransactionManager.record(txRecord);
      return { success: false, result: solveResult, transaction: txRecord };
    }
  }
}
