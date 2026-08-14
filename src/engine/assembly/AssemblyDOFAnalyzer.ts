/**
 * PATCH-SECP-045 — Assembly Degrees of Freedom (DOF) Analyzer
 * Analyzes the multi-body kinematic assembly constraint network:
 *  - Calculates total unconstrained system DOF (6 * N_unfixed)
 *  - Evaluates geometric DOF reduction along Tx, Ty, Tz, Rx, Ry, Rz for each component
 *  - Distinguishes between topological constraint-count estimates and true geometric DOF
 *  - Detects redundant, over-constrained, under-constrained, and fully constrained states
 *  - Identifies independent generalized motion coordinates
 */

import { AssemblyComponent, AssemblyConstraint } from './AssemblyConstraintTypes';
import { KinematicJoint, DOFReport } from './KinematicTypes';
import { AssemblyConstraintResolver } from './AssemblyConstraintResolver';

export class AssemblyDOFAnalyzer {
  /**
   * Performs an exhaustive DOF analysis on the assembly
   */
  public static analyze(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[] = [],
    joints: KinematicJoint[] = []
  ): DOFReport {
    const activeComponents = components.filter(c => !c.suppressed);
    const nonFixedComponents = activeComponents.filter(c => !c.fixed);

    // 1. Total Unconstrained System DOF
    const totalDOF = nonFixedComponents.length * 6;

    const componentDofs: DOFReport['componentDofs'] = {};
    const redundantConstraints: string[] = [];
    const unresolvedConstraints: string[] = [];
    const independentCoordinates: string[] = [];

    // Normalize constraints
    const normalized = AssemblyConstraintResolver.normalizeAll(constraints);

    // Initialize per-component DOF trackers
    for (const comp of activeComponents) {
      if (comp.fixed) {
        componentDofs[comp.instanceId] = {
          instanceId: comp.instanceId,
          isFixed: true,
          freeTx: false,
          freeTy: false,
          freeTz: false,
          freeRx: false,
          freeRy: false,
          freeRz: false,
          remainingDof: 0
        };
      } else {
        componentDofs[comp.instanceId] = {
          instanceId: comp.instanceId,
          isFixed: false,
          freeTx: true,
          freeTy: true,
          freeTz: true,
          freeRx: true,
          freeRy: true,
          freeRz: true,
          remainingDof: 6
        };
      }
    }

    let estimatedDofReduction = 0;
    const trackedConstraintUsage = new Map<string, number>();

    // 2. Process normalized constraints
    for (const nc of normalized) {
      if (nc.status === 'UNSUPPORTED' || nc.status === 'INVALID') {
        unresolvedConstraints.push(nc.constraintId);
        continue;
      }

      const sourceDof = componentDofs[nc.sourceComponentId];
      const targetDof = componentDofs[nc.targetComponentId];
      const mobileTarget = (sourceDof && !sourceDof.isFixed) ? sourceDof : (targetDof && !targetDof.isFixed ? targetDof : null);
      if (!mobileTarget) {
        // Both components fixed or target invalid
        continue;
      }
      const target = mobileTarget;

      const beforeDof = target.remainingDof;
      estimatedDofReduction += nc.dofContribution;

      // Apply geometric constraint restrictions
      switch (nc.type) {
        case 'MATE':
          // Removes normal translation + 2 tilt rotations
          target.freeTz = false;
          target.freeRx = false;
          target.freeRy = false;
          break;

        case 'CONCENTRIC':
          // Removes 2 perpendicular translations + 2 out-of-axis rotations
          target.freeTx = false;
          target.freeTy = false;
          target.freeRx = false;
          target.freeRy = false;
          break;

        case 'DISTANCE':
          target.freeTz = false;
          break;

        case 'ANGLE':
        case 'PERPENDICULAR':
          target.freeRx = false;
          break;

        case 'PARALLEL':
        case 'ALIGN':
          target.freeRx = false;
          target.freeRy = false;
          break;

        case 'LOCK':
          target.freeTx = false;
          target.freeTy = false;
          target.freeTz = false;
          target.freeRx = false;
          target.freeRy = false;
          target.freeRz = false;
          break;
      }

      // Re-calculate remaining DOF
      let curDof = 0;
      if (target.freeTx) curDof++;
      if (target.freeTy) curDof++;
      if (target.freeTz) curDof++;
      if (target.freeRx) curDof++;
      if (target.freeRy) curDof++;
      if (target.freeRz) curDof++;
      target.remainingDof = curDof;

      // Check for redundancy: if constraint did not reduce DOF further
      if (curDof === beforeDof && nc.dofContribution > 0) {
        redundantConstraints.push(nc.constraintId);
      }
    }

    // 3. Process Joint Degrees of Freedom
    for (const joint of joints) {
      if (!joint.enabled) continue;
      const childDof = componentDofs[joint.childComponentId];
      if (!childDof || childDof.isFixed) continue;

      switch (joint.type) {
        case 'FIXED':
          childDof.freeTx = false;
          childDof.freeTy = false;
          childDof.freeTz = false;
          childDof.freeRx = false;
          childDof.freeRy = false;
          childDof.freeRz = false;
          childDof.remainingDof = 0;
          break;

        case 'REVOLUTE':
          // 1 Rotational DOF around specified axis
          childDof.freeTx = false;
          childDof.freeTy = false;
          childDof.freeTz = false;
          childDof.freeRx = Math.abs(joint.axis.x) > 0.5;
          childDof.freeRy = Math.abs(joint.axis.y) > 0.5;
          childDof.freeRz = Math.abs(joint.axis.z) > 0.5;
          childDof.remainingDof = 1;
          independentCoordinates.push(`q_${joint.name || joint.id}_angle`);
          break;

        case 'PRISMATIC':
          // 1 Translational DOF along axis
          childDof.freeTx = Math.abs(joint.axis.x) > 0.5;
          childDof.freeTy = Math.abs(joint.axis.y) > 0.5;
          childDof.freeTz = Math.abs(joint.axis.z) > 0.5;
          childDof.freeRx = false;
          childDof.freeRy = false;
          childDof.freeRz = false;
          childDof.remainingDof = 1;
          independentCoordinates.push(`q_${joint.name || joint.id}_dist`);
          break;

        case 'CYLINDRICAL':
          // 2 DOF: 1 rotation + 1 translation along same axis
          childDof.freeTx = Math.abs(joint.axis.x) > 0.5;
          childDof.freeTy = Math.abs(joint.axis.y) > 0.5;
          childDof.freeTz = Math.abs(joint.axis.z) > 0.5;
          childDof.freeRx = Math.abs(joint.axis.x) > 0.5;
          childDof.freeRy = Math.abs(joint.axis.y) > 0.5;
          childDof.freeRz = Math.abs(joint.axis.z) > 0.5;
          childDof.remainingDof = 2;
          independentCoordinates.push(`q_${joint.name || joint.id}_rot`);
          independentCoordinates.push(`q_${joint.name || joint.id}_trans`);
          break;

        case 'SPHERICAL':
          // 3 Rotational DOFs
          childDof.freeTx = false;
          childDof.freeTy = false;
          childDof.freeTz = false;
          childDof.freeRx = true;
          childDof.freeRy = true;
          childDof.freeRz = true;
          childDof.remainingDof = 3;
          independentCoordinates.push(`q_${joint.name || joint.id}_yaw`);
          independentCoordinates.push(`q_${joint.name || joint.id}_pitch`);
          independentCoordinates.push(`q_${joint.name || joint.id}_roll`);
          break;
      }
    }

    // 4. Aggregate system-level Geometric vs Estimated DOF
    let geometricFreeDof = 0;
    for (const compId of Object.keys(componentDofs)) {
      geometricFreeDof += componentDofs[compId].remainingDof;
    }

    const constrainedDOF = Math.max(0, totalDOF - geometricFreeDof);
    const freeDOF = geometricFreeDof;
    const estimatedDofCount = Math.max(0, totalDOF - estimatedDofReduction);

    let status: DOFReport['status'] = 'FULLY_CONSTRAINED';
    if (unresolvedConstraints.length > 0) {
      status = 'INVALID';
    } else if (redundantConstraints.length > 0 && freeDOF === 0) {
      status = 'OVER_CONSTRAINED';
    } else if (freeDOF > 0) {
      status = 'UNDER_CONSTRAINED';
    } else if (freeDOF === 0) {
      status = 'FULLY_CONSTRAINED';
    }

    return {
      totalDOF,
      constrainedDOF,
      freeDOF,
      status,
      redundantConstraints,
      unresolvedConstraints,
      independentCoordinates,
      geometricDofCount: geometricFreeDof,
      estimatedDofCount,
      componentDofs
    };
  }
}
