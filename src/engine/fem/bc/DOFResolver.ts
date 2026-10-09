/**
 * SECP CAD/CAE Platform - DOF Resolver Engine
 * PATCH-235 — Boundary Condition Engine
 *
 * Maps BC definitions on targeted mesh entities to specific global nodal degrees
 * of freedom. Integrates coordinate system transformations (Global -> Local -> Global)
 * and audits element capability compatibility (e.g., rotational DOFs).
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { DOFField } from '../assembly/DOFManager';
import {
  BoundaryConditionDefinition,
  CoordinateSystem,
  Vector3D,
  PrescribedDOFValue,
  BCDiagnosticIssue
} from './BoundaryConditionTypes';

export interface ResolvedNodeConstraint {
  nodeId: string;
  field: DOFField;
  prescribedValue: number;
  coordinateSystemId: string;
}

export interface ResolvedNodalForce {
  nodeId: string;
  fx: number;
  fy: number;
  fz: number;
}

export class DOFResolver {
  /**
   * Resolves prescribed Dirichlet displacement/fixed support constraints for a set of nodes.
   */
  public static resolvePrescribedConstraints(
    bc: BoundaryConditionDefinition,
    targetNodeIds: string[],
    mesh: FEMMesh
  ): { constraints: ResolvedNodeConstraint[]; issues: BCDiagnosticIssue[] } {
    const constraints: ResolvedNodeConstraint[] = [];
    const issues: BCDiagnosticIssue[] = [];

    // Check node existence in mesh
    const nodeMap = new Map(mesh.nodes.map((n) => [n.id, n]));

    for (const nodeId of targetNodeIds) {
      if (!nodeMap.has(nodeId)) {
        issues.push({
          code: 'INVALID_NODE',
          severity: 'ERROR',
          bcId: bc.id,
          nodeId,
          message: `Node ID ${nodeId} not found in mesh during DOF resolution`
        });
        continue;
      }

      // Determine element types connected to node to verify rotational DOF capability
      const hasRotationalDOF = DOFResolver.nodeSupportsRotationalDOFs(nodeId, mesh);

      if (bc.type === 'FIXED_SUPPORT') {
        const fieldsToFix: DOFField[] = ['UX', 'UY', 'UZ'];
        if (hasRotationalDOF) {
          fieldsToFix.push('ROTX', 'ROTY', 'ROTZ');
        }

        for (const field of fieldsToFix) {
          constraints.push({
            nodeId,
            field,
            prescribedValue: 0.0,
            coordinateSystemId: bc.coordinateSystem.id
          });
        }
      } else if (bc.type === 'PRESCRIBED_DISPLACEMENT' || bc.type === 'ESSENTIAL_DIRICHLET') {
        if (!bc.dofValues || bc.dofValues.length === 0) {
          continue;
        }

        for (const dofVal of bc.dofValues) {
          if (!dofVal.isPrescribed) continue;

          // Rotational check
          const isRotational = dofVal.dof === 'ROTX' || dofVal.dof === 'ROTY' || dofVal.dof === 'ROTZ';
          if (isRotational && !hasRotationalDOF) {
            issues.push({
              code: 'UNSUPPORTED_ROTATIONAL_DOF',
              severity: 'WARNING',
              bcId: bc.id,
              nodeId,
              dof: dofVal.dof,
              message: `Rotational DOF ${dofVal.dof} applied to node ${nodeId} which connects only to 3D solid elements without rotational DOFs.`
            });
            continue;
          }

          // Apply coordinate transformation if local
          let finalVal = dofVal.value;
          if (bc.coordinateSystem.type !== 'GLOBAL') {
            finalVal = DOFResolver.transformPrescribedDisplacement(
              dofVal.dof,
              dofVal.value,
              bc.coordinateSystem
            );
          }

          constraints.push({
            nodeId,
            field: dofVal.dof,
            prescribedValue: finalVal,
            coordinateSystemId: bc.coordinateSystem.id
          });
        }
      }
    }

    return { constraints, issues };
  }

  /**
   * Resolves nodal forces and converts local coordinate vectors to global coordinates.
   */
  public static resolveNodalForces(
    bc: BoundaryConditionDefinition,
    targetNodeIds: string[]
  ): { nodalForces: ResolvedNodalForce[]; issues: BCDiagnosticIssue[] } {
    const nodalForces: ResolvedNodalForce[] = [];
    const issues: BCDiagnosticIssue[] = [];

    if (!bc.forceValue || targetNodeIds.length === 0) {
      return { nodalForces: [], issues: [] };
    }

    // Convert total force to per-node force (or distributed nodal load)
    const count = targetNodeIds.length;
    let fxLocal = (bc.forceValue.fx ?? 0) / count;
    let fyLocal = (bc.forceValue.fy ?? 0) / count;
    let fzLocal = (bc.forceValue.fz ?? 0) / count;

    if (bc.forceValue.magnitude > 0 && (fxLocal === 0 && fyLocal === 0 && fzLocal === 0)) {
      const dir = bc.forceValue.direction;
      const magPerNode = bc.forceValue.magnitude / count;
      fxLocal = dir.x * magPerNode;
      fyLocal = dir.y * magPerNode;
      fzLocal = dir.z * magPerNode;
    }

    // Coordinate system transform
    let fxGlobal = fxLocal;
    let fyGlobal = fyLocal;
    let fzGlobal = fzLocal;

    if (bc.coordinateSystem.type !== 'GLOBAL') {
      const globalVec = DOFResolver.transformVectorToGlobal(
        { x: fxLocal, y: fyLocal, z: fzLocal },
        bc.coordinateSystem
      );
      fxGlobal = globalVec.x;
      fyGlobal = globalVec.y;
      fzGlobal = globalVec.z;
    }

    for (const nodeId of targetNodeIds) {
      nodalForces.push({
        nodeId,
        fx: fxGlobal,
        fy: fyGlobal,
        fz: fzGlobal
      });
    }

    return { nodalForces, issues };
  }

  /**
   * Transforms a 3D vector from local coordinate system to global coordinates.
   */
  public static transformVectorToGlobal(vecLocal: Vector3D, cs: CoordinateSystem): Vector3D {
    // Rotation matrix columns: R = [xAxis, yAxis, zAxis]
    // V_global = R * V_local
    const x = cs.xAxis.x * vecLocal.x + cs.yAxis.x * vecLocal.y + cs.zAxis.x * vecLocal.z;
    const y = cs.xAxis.y * vecLocal.x + cs.yAxis.y * vecLocal.y + cs.zAxis.y * vecLocal.z;
    const z = cs.xAxis.z * vecLocal.x + cs.yAxis.z * vecLocal.y + cs.zAxis.z * vecLocal.z;
    return { x, y, z };
  }

  private static transformPrescribedDisplacement(
    dof: DOFField,
    value: number,
    cs: CoordinateSystem
  ): number {
    // Scale value based on axis alignment with global axis
    let axis: Vector3D = { x: 1, y: 0, z: 0 };
    if (dof === 'UX' || dof === 'ROTX') axis = cs.xAxis;
    if (dof === 'UY' || dof === 'ROTY') axis = cs.yAxis;
    if (dof === 'UZ' || dof === 'ROTZ') axis = cs.zAxis;

    const globalProj = Math.abs(axis.x + axis.y + axis.z);
    return value * (globalProj > 1e-6 ? globalProj : 1.0);
  }

  private static nodeSupportsRotationalDOFs(nodeId: string, mesh: FEMMesh): boolean {
    // Check elements connected to this node
    for (const elem of mesh.elements) {
      if (elem.nodeIds.includes(nodeId)) {
        if (elem.type === 'TRI' || elem.type === 'QUAD') {
          // Structural shell/beam elements support ROTX, ROTY, ROTZ
          return true;
        }
      }
    }
    return false;
  }
}
