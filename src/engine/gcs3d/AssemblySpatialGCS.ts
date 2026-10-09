/**
 * SECP CAD Kernel — Production 3D GCS Assembly Constraint Solver
 * Phase 15 (PATCH-173)
 *
 * Solves 3D assembly mates, coaxial joints, planar aligns, and rigid component attachments
 * with rigid-body kinematics transformation and 6-DOF occurrence tracking.
 */

import { Point, Vector } from '../cad-kernel/geometry/GeometryContracts';
import {
  Spatial3DEntity,
  Production3DConstraint,
  Production3DSolverResult,
  SpatialAssemblyComponent3D
} from './Production3DGCSTypes';
import { NonlinearSpatialSolver } from './NonlinearSpatialSolver';

export interface AssemblyOccurrence {
  readonly instanceId: string;
  readonly componentId: string;
  readonly position: Point;
  readonly rotationEulerRad: { x: number; y: number; z: number };
  readonly isGrounded: boolean;
  readonly remainingDOF: number;
}

export interface AssemblySolveResult {
  readonly success: boolean;
  readonly occurrences: Record<string, AssemblyOccurrence>;
  readonly globalDOF: number;
  readonly solverResult: Production3DSolverResult;
}

export class AssemblySpatialGCS {
  public static solveAssembly(
    occurrences: AssemblyOccurrence[],
    assemblyConstraints: readonly Production3DConstraint[]
  ): AssemblySolveResult {
    // 1. Build Spatial3DEntities from occurrences
    const entities: Record<string, Spatial3DEntity> = {};

    for (const occ of occurrences) {
      entities[occ.instanceId] = {
        id: occ.instanceId,
        name: `Occurrence ${occ.instanceId}`,
        type: 'ASSEMBLY_COMPONENT',
        isFixed: occ.isGrounded,
        geometry: {
          type: 'ASSEMBLY_COMPONENT',
          data: {
            componentId: occ.componentId,
            instanceId: occ.instanceId,
            position: { ...occ.position },
            rotationEulerRad: { ...occ.rotationEulerRad },
            isGrounded: occ.isGrounded
          }
        }
      };
    }

    // 2. Add ground fix constraint if an occurrence is grounded
    const constraints: Production3DConstraint[] = [...assemblyConstraints];
    for (const occ of occurrences) {
      if (occ.isGrounded) {
        constraints.push({
          constraintId: `GROUND-FIX-${occ.instanceId}`,
          type: 'FIX',
          entities: [{ entityId: occ.instanceId, subTarget: 'ORIGIN' }],
          parameters: { value: occ.position.x },
          tolerance: 1e-7,
          priority: 100,
          driving: true
        });
      }
    }

    // 3. Solve via NonlinearSpatialSolver
    const solverRes = NonlinearSpatialSolver.solve(entities, constraints);

    // 4. Extract solved occurrences
    const updatedOccurrences: Record<string, AssemblyOccurrence> = {};
    for (const occ of occurrences) {
      const solvedEnt = solverRes.entities[occ.instanceId];
      if (solvedEnt && solvedEnt.geometry.type === 'ASSEMBLY_COMPONENT') {
        const data = solvedEnt.geometry.data as SpatialAssemblyComponent3D;
        const occDOF = solverRes.dofReport.entityBreakdown.find(b => b.entityId === occ.instanceId)?.remainingDOF ?? (occ.isGrounded ? 0 : 6);
        updatedOccurrences[occ.instanceId] = {
          instanceId: occ.instanceId,
          componentId: occ.componentId,
          position: { ...data.position } as any,
          rotationEulerRad: { ...data.rotationEulerRad },
          isGrounded: occ.isGrounded,
          remainingDOF: occDOF
        };
      } else {
        updatedOccurrences[occ.instanceId] = { ...occ };
      }
    }

    return {
      success: solverRes.success,
      occurrences: updatedOccurrences,
      globalDOF: solverRes.dofReport.remainingDOF,
      solverResult: solverRes
    };
  }
}
