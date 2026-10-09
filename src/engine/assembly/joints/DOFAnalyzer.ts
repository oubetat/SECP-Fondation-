/**
 * PATCH-SECP-227 — Degrees of Freedom (DOF) & Mobility Analyzer
 * 
 * Computes spatial 3D Kutzbach-Grübler mobility criteria:
 *   M = 6*(N - 1 - J) + \sum_{i=1}^J f_i
 * Where:
 *   N = number of bodies (ground + moving components)
 *   J = number of mechanical joints
 *   f_i = degrees of freedom permitted by joint i
 * 
 * Performs component-level translational and rotational freedom breakdown,
 * detects over-constrained systems, redundancies, and kinematic singularities.
 */

import {
  MechanicalJoint,
  AssemblyMobilityReport,
  ComponentKinematicState
} from './MechanicalJointTypes';

export class DOFAnalyzer {
  public static analyzeAssemblyMobility(
    components: ComponentKinematicState[],
    joints: MechanicalJoint[]
  ): AssemblyMobilityReport {
    return this.analyzeMobility(components, joints);
  }

  /**
   * Run complete Kutzbach-Grübler Mobility & DOF Analysis for the assembly
   */
  public static analyzeMobility(
    components: ComponentKinematicState[],
    joints: MechanicalJoint[]
  ): AssemblyMobilityReport {
    const totalComponents = components.length;
    const groundedComponents = components.filter(c => c.isGrounded).length;
    const movingComponents = totalComponents - groundedComponents;
    
    const activeJoints = joints.filter(j => !j.isSuppressed);
    const totalJoints = activeJoints.length;

    // Sum of permitted degrees of freedom across all active joints
    let sumAllowedJointDOFs = 0;
    for (const joint of activeJoints) {
      sumAllowedJointDOFs += joint.dof.totalDegreesOfFreedom;
    }

    // Spatial Kutzbach-Grübler formula:
    // If N = total components (including ground) and J = active joints:
    // M = 6 * (N - 1 - J) + sum(f_i)
    // or equivalently: M = 6*(N - 1) - sum(c_i) where c_i = 6 - f_i is the number of constraints
    const spatialMobilityM = totalComponents > 1 
      ? 6 * (totalComponents - 1 - totalJoints) + sumAllowedJointDOFs
      : 0;

    // Component-level DOF allocation
    const componentDOFs: AssemblyMobilityReport['componentDOFs'] = {};
    const diagnostics: string[] = [];

    // Initialize all components
    for (const comp of components) {
      if (comp.isGrounded) {
        componentDOFs[comp.componentId] = {
          translational: 0,
          rotational: 0,
          total: 0,
          locked: 6
        };
      } else {
        componentDOFs[comp.componentId] = {
          translational: 3,
          rotational: 3,
          total: 6,
          locked: 0
        };
      }
    }

    // Process joint constraints on child components
    const jointCountsByChild: Record<string, number> = {};
    let redundantConstraintsCount = 0;
    const singularJointIds: string[] = [];

    for (const joint of activeJoints) {
      const childId = joint.childComponentId;
      jointCountsByChild[childId] = (jointCountsByChild[childId] || 0) + 1;

      const compDof = componentDOFs[childId];
      if (compDof) {
        const jointDOFs = joint.dof.totalDegreesOfFreedom;
        const lockedDOFs = joint.dof.lockedDegreesOfFreedom;

        // Apply joint constraints
        const transAllowed = (joint.dof.txAllowed ? 1 : 0) + (joint.dof.tyAllowed ? 1 : 0) + (joint.dof.tzAllowed ? 1 : 0);
        const rotAllowed = (joint.dof.rxAllowed ? 1 : 0) + (joint.dof.ryAllowed ? 1 : 0) + (joint.dof.rzAllowed ? 1 : 0);

        if (joint.dof.isCoupled) {
          // Coupled joint reduces 1 coordinate
          compDof.translational = Math.min(compDof.translational, 1);
          compDof.rotational = Math.min(compDof.rotational, 1);
          compDof.total = 1;
          compDof.locked = 5;
        } else {
          compDof.translational = Math.min(compDof.translational, transAllowed);
          compDof.rotational = Math.min(compDof.rotational, rotAllowed);
          compDof.total = compDof.translational + compDof.rotational;
          compDof.locked = 6 - compDof.total;
        }
      }

      // Check for collinear/duplicate joint issues (singularities)
      const siblingJoints = activeJoints.filter(
        j => j.id !== joint.id &&
        ((j.parentComponentId === joint.parentComponentId && j.childComponentId === joint.childComponentId) ||
         (j.parentComponentId === joint.childComponentId && j.childComponentId === joint.parentComponentId))
      );

      if (siblingJoints.length > 0) {
        redundantConstraintsCount += siblingJoints.length;
        singularJointIds.push(joint.id);
        diagnostics.push(`Redundant/Parallel kinematic path detected between '${joint.parentComponentId}' and '${joint.childComponentId}'.`);
      }
    }

    // Mechanism classification
    let systemClassification: AssemblyMobilityReport['systemClassification'] = 'DETERMINATE_MECHANISM';

    if (spatialMobilityM === 0) {
      systemClassification = 'STATIC_STRUCTURE';
      diagnostics.push('System has 0 mobility: Forms a fully constrained rigid structural assembly.');
    } else if (spatialMobilityM > 0) {
      if (spatialMobilityM === 1) {
        systemClassification = 'DETERMINATE_MECHANISM';
        diagnostics.push('System has 1 mobility (M=1): Single-actuator determinate kinematic mechanism.');
      } else {
        systemClassification = 'UNDER_CONSTRAINED_MECHANISM';
        diagnostics.push(`System has ${spatialMobilityM} degrees of freedom (M=${spatialMobilityM}): Under-constrained mechanism requiring ${spatialMobilityM} independent actuators.`);
      }
    } else {
      systemClassification = 'OVER_CONSTRAINED_STRUCTURE';
      diagnostics.push(`System has negative mobility (M=${spatialMobilityM}): Over-constrained structure with redundant constraints.`);
    }

    return {
      totalComponents,
      groundedComponents,
      movingComponents,
      totalJoints,
      activeJoints: activeJoints.length,
      spatialMobilityM,
      systemClassification,
      componentDOFs,
      redundantConstraintsCount,
      singularitiesDetected: singularJointIds.length > 0,
      singularJointIds,
      diagnostics
    };
  }
}
