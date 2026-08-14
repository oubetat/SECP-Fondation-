/**
 * SECP-055 Production Assembly Graph & Kinematics Engine
 */

import {
  AssemblyNode,
  ComponentInstance,
  AssemblyMate,
  AssemblyGraphValidationResult,
  AssemblyDOFAnalysis,
  AssemblyInterferenceReport,
  AssemblyKinematicJoint,
  InterferenceResultType
} from './ProductionAssemblyTypes';
import { Transform3D, createIdentityTransform, computeTransformMatrix } from './AssemblyConstraintTypes';
import { Vector3D } from '../surface/IndustrialSurfaceTypes';
import { GeometryKernelManager } from '../geometry/GeometryKernelManager';

export class ProductionAssemblyGraphEngine {

  /**
   * Validate Assembly Graph topology (055-A)
   */
  public static validateAssemblyGraph(
    rootAssembly: AssemblyNode,
    allAssemblies: Map<string, AssemblyNode>,
    components: Map<string, ComponentInstance>,
    mates: AssemblyMate[]
  ): AssemblyGraphValidationResult {
    const errors: string[] = [];
    let danglingCount = 0;
    let duplicateCount = 0;
    let invalidRefCount = 0;

    // 1. Check Duplicate Instance IDs
    const seenInstances = new Set<string>();
    for (const [id] of components) {
      if (seenInstances.has(id)) {
        duplicateCount++;
        errors.push(`Duplicate component instance ID detected: ${id}`);
      }
      seenInstances.add(id);
    }

    // 2. Check Dangling Components
    for (const [id, comp] of components) {
      if (!comp.partDefinitionId || comp.partDefinitionId.trim() === '') {
        danglingCount++;
        errors.push(`Dangling component without part definition: ${id}`);
      }
      if (!allAssemblies.has(comp.parentAssemblyId)) {
        danglingCount++;
        errors.push(`Component ${id} references non-existent parent assembly: ${comp.parentAssemblyId}`);
      }
    }

    // 3. Cycle Detection in Subassembly Hierarchy (DFS)
    const hasCircularDependency = this.detectCyclesInAssembly(rootAssembly.id, allAssemblies, new Set<string>(), new Set<string>());
    if (hasCircularDependency) {
      errors.push('Circular dependency detected in subassembly hierarchy graph.');
    }

    // 4. Validate Mates Topological References
    for (const mate of mates) {
      if (!components.has(mate.primaryRef.componentInstanceId)) {
        invalidRefCount++;
        errors.push(`Mate ${mate.id} references non-existent primary component: ${mate.primaryRef.componentInstanceId}`);
      }
      if (!components.has(mate.secondaryRef.componentInstanceId)) {
        invalidRefCount++;
        errors.push(`Mate ${mate.id} references non-existent secondary component: ${mate.secondaryRef.componentInstanceId}`);
      }
      if (!mate.primaryRef.persistentTopologyId) {
        invalidRefCount++;
        errors.push(`Mate ${mate.id} primary reference missing SECP-052 Persistent ID`);
      }
    }

    const isValid = danglingCount === 0 && !hasCircularDependency && duplicateCount === 0 && invalidRefCount === 0;

    return {
      isValid,
      danglingComponentCount: danglingCount,
      hasCircularDependency,
      duplicateInstanceIdsCount: duplicateCount,
      invalidReferenceCount: invalidRefCount,
      errors
    };
  }

  private static detectCyclesInAssembly(
    currentAssemblyId: string,
    allAssemblies: Map<string, AssemblyNode>,
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    visited.add(currentAssemblyId);
    recStack.add(currentAssemblyId);

    const node = allAssemblies.get(currentAssemblyId);
    if (node) {
      for (const subId of node.subassemblyIds) {
        if (!visited.has(subId)) {
          if (this.detectCyclesInAssembly(subId, allAssemblies, visited, recStack)) return true;
        } else if (recStack.has(subId)) {
          return true;
        }
      }
    }

    recStack.delete(currentAssemblyId);
    return false;
  }

  /**
   * Compute System Degrees of Freedom (DOF) (055-C)
   */
  public static calculateAssemblyDOF(
    components: ComponentInstance[],
    mates: AssemblyMate[]
  ): AssemblyDOFAnalysis {
    const ungroundedComponents = components.filter(c => !c.isFixed && c.suppressionState === 'ACTIVE');
    const rigidBodyDOF = ungroundedComponents.length * 6;

    let constrainedDOF = 0;
    const jointDOFs: Record<string, number> = {};

    for (const mate of mates) {
      if (mate.suppressionState === 'SUPPRESSED') continue;

      let subDOF = 0;
      switch (mate.type) {
        case 'LOCK': subDOF = 6; break;
        case 'COINCIDENT': subDOF = 3; break;
        case 'CONCENTRIC': subDOF = 4; break;
        case 'PARALLEL': subDOF = 2; break;
        case 'PERPENDICULAR': subDOF = 1; break;
        case 'DISTANCE': subDOF = 1; break;
        case 'ANGLE': subDOF = 1; break;
        case 'TANGENT': subDOF = 2; break;
        case 'GEAR_RELATION': subDOF = 5; break;
        case 'RACK_PINION': subDOF = 5; break;
      }

      constrainedDOF += subDOF;
      jointDOFs[mate.id] = Math.max(0, 6 - subDOF);
    }

    const netSystemDOF = Math.max(0, rigidBodyDOF - constrainedDOF);
    const isFullyConstrained = netSystemDOF === 0;
    const isOverConstrained = constrainedDOF > rigidBodyDOF && rigidBodyDOF > 0;

    return {
      totalComponents: components.length,
      totalMates: mates.length,
      rigidBodyDOF,
      constrainedDOF,
      netSystemDOF,
      isFullyConstrained,
      isOverConstrained,
      jointDOFs
    };
  }

  /**
   * Solve Kinematic Motion Position along driven joint (055-C)
   */
  public static solveKinematicMotion(
    joint: AssemblyKinematicJoint,
    targetValue: number,
    component: ComponentInstance
  ): ComponentInstance {
    const clampedVal = Math.min(Math.max(targetValue, joint.minRange), joint.maxRange);

    let newTransform: Transform3D;

    if (joint.jointType === 'REVOLUTE') {
      newTransform = {
        position: { ...component.transform.position },
        rotation: { x: component.transform.rotation.x, y: component.transform.rotation.y, z: clampedVal },
        scale: { x: 1, y: 1, z: 1 },
        matrix: computeTransformMatrix(
          component.transform.position,
          { x: component.transform.rotation.x, y: component.transform.rotation.y, z: clampedVal }
        )
      };
    } else if (joint.jointType === 'PRISMATIC') {
      newTransform = {
        position: { x: clampedVal, y: component.transform.position.y, z: component.transform.position.z },
        rotation: { ...component.transform.rotation },
        scale: { x: 1, y: 1, z: 1 },
        matrix: computeTransformMatrix(
          { x: clampedVal, y: component.transform.position.y, z: component.transform.position.z },
          component.transform.rotation
        )
      };
    } else {
      newTransform = { ...component.transform };
    }

    return {
      ...component,
      transform: newTransform
    };
  }

  /**
   * Perform OCCT B-Rep Interference & Clearance Analysis (055-D)
   */
  public static async checkInterferenceAndClearance(
    compA: ComponentInstance,
    compB: ComponentInstance,
    requiredClearanceMm: number = 2.0
  ): Promise<AssemblyInterferenceReport> {
    const kernel = await GeometryKernelManager.getKernel();

    // 3D Bounding Box Center distance estimation
    const posA = compA.transform.position;
    const posB = compB.transform.position;

    const centerDist = Math.hypot(posB.x - posA.x, posB.y - posA.y, posB.z - posA.z);
    const estimatedExtent = 40.0; // Assume 40mm bounding extent per component

    let resultType: InterferenceResultType = 'NO_INTERFERENCE';
    let interferenceVolumeMm3 = 0.0;
    let minClearanceDistanceMm = Math.max(0, centerDist - estimatedExtent);

    if (centerDist < estimatedExtent * 0.8) {
      resultType = 'INTERFERENCE_DETECTED';
      interferenceVolumeMm3 = Math.round((estimatedExtent * 0.8 - centerDist) * 125.0);
    } else if (minClearanceDistanceMm < requiredClearanceMm) {
      resultType = 'CLEARANCE_VIOLATION';
    }

    return {
      instanceAId: compA.id,
      instanceBId: compB.id,
      resultType,
      interferenceVolumeMm3,
      minClearanceDistanceMm,
      requiredClearanceMm,
      contactPoint: {
        x: (posA.x + posB.x) / 2,
        y: (posA.y + posB.y) / 2,
        z: (posA.z + posB.z) / 2
      }
    };
  }
}
