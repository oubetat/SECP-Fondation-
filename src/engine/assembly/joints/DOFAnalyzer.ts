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

    // Graph Decomposition: Multi-Island Connected Components
    // Decomposes assembly into independent kinematic sub-mechanisms/islands
    const compIdMap = new Map<string, ComponentKinematicState>();
    for (const comp of components) {
      compIdMap.set(comp.componentId, comp);
    }

    // Disjoint Set Union (DSU)
    const parent = new Map<string, string>();
    const findRoot = (id: string): string => {
      if (!parent.has(id)) parent.set(id, id);
      const p = parent.get(id)!;
      if (p !== id) {
        const root = findRoot(p);
        parent.set(id, root);
        return root;
      }
      return p;
    };
    const union = (id1: string, id2: string) => {
      const r1 = findRoot(id1);
      const r2 = findRoot(id2);
      if (r1 !== r2) parent.set(r1, r2);
    };

    // Initialize all components
    for (const comp of components) {
      findRoot(comp.componentId);
    }
    // Connect edges via active joints
    for (const joint of activeJoints) {
      union(joint.parentComponentId, joint.childComponentId);
    }

    // Group components and joints by island root
    const islandComponents = new Map<string, ComponentKinematicState[]>();
    for (const comp of components) {
      const root = findRoot(comp.componentId);
      if (!islandComponents.has(root)) islandComponents.set(root, []);
      islandComponents.get(root)!.push(comp);
    }

    const islandJoints = new Map<string, MechanicalJoint[]>();
    for (const joint of activeJoints) {
      const root = findRoot(joint.childComponentId);
      if (!islandJoints.has(root)) islandJoints.set(root, []);
      islandJoints.get(root)!.push(joint);
    }

    // Multi-Island Spatial Kutzbach-Grübler mobility:
    // For each island k:
    //   If island has ground (G_k >= 1): M_k = 6*(N_k - G_k - J_k) + sum(f_i)
    //   If island is free-floating (G_k == 0): M_k = 6*(N_k - J_k) + sum(f_i)
    let spatialMobilityM = 0;
    for (const [root, islandComps] of islandComponents.entries()) {
      const Nk = islandComps.length;
      const jointsK = islandJoints.get(root) || [];
      const Jk = jointsK.length;
      const sumFk = jointsK.reduce((sum, j) => sum + j.dof.totalDegreesOfFreedom, 0);
      const groundedK = islandComps.filter(c => c.isGrounded).length;

      if (groundedK > 0) {
        // Grounded island
        const islandM = Nk > groundedK
          ? 6 * (Nk - groundedK - Jk) + sumFk
          : 0;
        spatialMobilityM += islandM;
      } else {
        // Free-floating ungrounded island: 6 rigid-body DOFs + relative joint freedoms
        const islandM = 6 * (Nk - Jk) + sumFk;
        spatialMobilityM += islandM;
      }
    }

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

    // Track joint pairings to eliminate double-counting
    const jointPairs = new Map<string, MechanicalJoint[]>();
    const singularJointIds: string[] = [];

    for (const joint of activeJoints) {
      const pairKey = [joint.parentComponentId, joint.childComponentId].sort().join(':::');
      if (!jointPairs.has(pairKey)) jointPairs.set(pairKey, []);
      jointPairs.get(pairKey)!.push(joint);

      const compDof = componentDOFs[joint.childComponentId];
      if (compDof) {
        const transAllowed = (joint.dof.txAllowed ? 1 : 0) + (joint.dof.tyAllowed ? 1 : 0) + (joint.dof.tzAllowed ? 1 : 0);
        const rotAllowed = (joint.dof.rxAllowed ? 1 : 0) + (joint.dof.ryAllowed ? 1 : 0) + (joint.dof.rzAllowed ? 1 : 0);

        compDof.translational = Math.min(compDof.translational, transAllowed);
        compDof.rotational = Math.min(compDof.rotational, rotAllowed);
        compDof.total = Math.min(compDof.translational + compDof.rotational, joint.dof.totalDegreesOfFreedom);
        compDof.locked = 6 - compDof.total;
      }
    }

    // Compute exact redundancy without double-counting pairs
    let redundantConstraintsCount = 0;
    for (const [pairKey, pJoints] of jointPairs.entries()) {
      if (pJoints.length > 1) {
        const excess = pJoints.length - 1;
        redundantConstraintsCount += excess;
        for (let i = 1; i < pJoints.length; i++) {
          singularJointIds.push(pJoints[i].id);
        }
        const [pA, pB] = pairKey.split(':::');
        diagnostics.push(`Redundant/Parallel kinematic path detected between '${pA}' and '${pB}' (${excess} redundant constraints).`);
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
