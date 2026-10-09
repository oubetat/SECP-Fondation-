/**
 * SECP CAD Kernel — Constraint Propagation Engine
 * Phase 2 (PATCH-027)
 */

import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';

// 2D GCS Imports
import { SketchModel } from '../../sketch/SketchModel';
import { SketchEntity } from '../../sketch/SketchEntity';
import { SketchConstraint } from '../../sketch/gcs/ConstraintModel';
import { DeterministicSolver } from '../../sketch/gcs/DeterministicSolver';
import { DegreeOfFreedomAnalyzer } from '../../sketch/gcs/DegreeOfFreedomAnalyzer';

// 3D GCS Imports
import { Model3D, Geometry3DEntity } from '../../gcs3d/Constraint3DTypes';
import { Constraint3D } from '../../gcs3d/Constraint3DModel';
import { Constraint3DSolver } from '../../gcs3d/Constraint3DSolver';
import { DegreeOfFreedom3DAnalyzer } from '../../gcs3d/DegreeOfFreedom3DAnalyzer';

// Tolerance Model
import { ToleranceModel } from '../tolerance/ToleranceModel';

export type PropagationStatus =
  | 'STABLE'
  | 'PROPAGATED'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'CONFLICT'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_PROPAGATION';

export interface ConstraintPropagationRequest {
  readonly modelType: '2D' | '3D';
  readonly model2D?: SketchModel;
  readonly model3D?: Model3D;
  readonly constraints2D?: readonly SketchConstraint[];
  readonly constraints3D?: readonly Constraint3D[];
  readonly changedEntityId: string; // ArtifactId of the root changed entity
  readonly targetParameter?: string; // Parameter name e.g. 'x', 'y', 'radius'
  readonly newValue?: number;
  readonly maxSteps?: number;
  readonly toleranceModel?: ToleranceModel;
}

export interface PropagationStep {
  readonly stepIndex: number;
  readonly sourceEntityId: string;
  readonly affectedEntityId: string;
  readonly constraintId: string;
  readonly dependencyPath: readonly string[];
  readonly propagationDepth: number;
  readonly oldValue: any;
  readonly newValue: any;
}

export interface PropagationConflict {
  readonly conflictingConstraintIds: readonly string[];
  readonly affectedEntities: readonly string[];
  readonly evaluatedValues: readonly number[];
  readonly tolerance: number;
  readonly dependencyPath: readonly string[];
  readonly propagationStep: number;
}

export interface PropagationCycle {
  readonly cycleDetected: boolean;
  readonly cyclePath: readonly string[];
  readonly cycleLength: number;
}

export interface PropagationDiagnostic {
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly code:
    | 'DUPLICATE_CONSTRAINT_ID'
    | 'MISSING_ENTITY_REFERENCE'
    | 'PROPAGATION_LIMIT_REACHED'
    | 'CONFLICT_DETECTED'
    | 'CYCLE_DETECTED'
    | 'INVALID_INPUT_PARAMETERS'
    | 'UNSUPPORTED_PROPAGATION_TYPE';
  readonly message: string;
  readonly constraintIds?: readonly string[];
  readonly entityIds?: readonly string[];
}

export interface PropagationTrace {
  readonly propagationId: string;
  readonly rootEntityId: string;
  readonly affectedEntities: readonly string[];
  readonly affectedConstraints: readonly string[];
  readonly steps: readonly PropagationStep[];
  readonly status: PropagationStatus;
  readonly iterations: number;
  readonly convergenceMetric: number;
  readonly conflicts: readonly PropagationConflict[];
  readonly cycles: readonly PropagationCycle[];
  readonly diagnostics: readonly PropagationDiagnostic[];
  readonly evidenceHash: string;
}

export interface ConstraintPropagationResult {
  readonly status: PropagationStatus;
  readonly updatedModel2D?: SketchModel;
  readonly updatedModel3D?: Model3D;
  readonly trace: PropagationTrace;
  readonly diagnostics: readonly PropagationDiagnostic[];
}

export class ConstraintPropagationEngine {
  private static readonly DEFAULT_TOLERANCE = 1e-7;

  /**
   * Main entry point for propagation. Matches modelType and triggers corresponding engine branch.
   */
  public static propagate(request: ConstraintPropagationRequest): ConstraintPropagationResult {
    const propagationId = `PROP-${Math.abs(this.simpleStringHash(request.changedEntityId)).toString(16).toUpperCase()}`;
    const maxSteps = request.maxSteps ?? 50;
    const diagnostics: PropagationDiagnostic[] = [];

    // Basic Input Validation
    if (request.newValue !== undefined && !Number.isFinite(request.newValue)) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'INVALID_INPUT_PARAMETERS',
        message: 'The target parameter newValue is non-finite.',
        entityIds: [request.changedEntityId],
      });
      return this.emptyResult('INVALID_INPUT', propagationId, request.changedEntityId, diagnostics);
    }

    if (request.modelType === '2D') {
      if (!request.model2D || !request.constraints2D) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'INVALID_INPUT_PARAMETERS',
          message: 'Both model2D and constraints2D are required for 2D propagation.',
        });
        return this.emptyResult('INVALID_INPUT', propagationId, request.changedEntityId, diagnostics);
      }
      return this.propagate2D(request, propagationId, maxSteps, diagnostics);
    } else if (request.modelType === '3D') {
      if (!request.model3D || !request.constraints3D) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'INVALID_INPUT_PARAMETERS',
          message: 'Both model3D and constraints3D are required for 3D propagation.',
        });
        return this.emptyResult('INVALID_INPUT', propagationId, request.changedEntityId, diagnostics);
      }
      return this.propagate3D(request, propagationId, maxSteps, diagnostics);
    } else {
      diagnostics.push({
        severity: 'ERROR',
        code: 'UNSUPPORTED_PROPAGATION_TYPE',
        message: `Unsupported propagation model type: ${request.modelType}`,
      });
      return this.emptyResult('UNSUPPORTED_PROPAGATION', propagationId, request.changedEntityId, diagnostics);
    }
  }

  /**
   * 2D Constraint Propagation
   */
  private static getCleanId(id: any): string {
    if (!id) return '';
    return id.projectId || id.artifactId || id.identityId || '';
  }

  private static propagate2D(
    request: ConstraintPropagationRequest,
    propagationId: string,
    maxSteps: number,
    diagnostics: PropagationDiagnostic[]
  ): ConstraintPropagationResult {
    let currentModel = request.model2D!;
    const constraints = request.constraints2D!;
    const rootId = request.changedEntityId;

    // Check for duplicate constraint IDs
    const seenCIds = new Set<string>();
    for (const c of constraints) {
      const cid = this.getCleanId(c.id);
      if (seenCIds.has(cid)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'DUPLICATE_CONSTRAINT_ID',
          message: `Duplicate constraint ID detected in request: ${cid}`,
          constraintIds: [cid],
        });
        return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
      }
      seenCIds.add(cid);
    }

    // Check for missing entity references
    const entityIds = new Set(currentModel.entities.map(e => this.getCleanId(e.id)));
    for (const c of constraints) {
      for (const ref of c.references) {
        const refId = this.getCleanId(ref.entityId);
        if (!entityIds.has(refId)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'MISSING_ENTITY_REFERENCE',
            message: `Constraint '${this.getCleanId(c.id)}' references non-existent entity: '${refId}'`,
            constraintIds: [this.getCleanId(c.id)],
            entityIds: [refId],
          });
          return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
        }
      }
    }

    // Find root entity
    const rootEntity = currentModel.entities.find(e => this.getCleanId(e.id) === rootId);
    if (!rootEntity) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'MISSING_ENTITY_REFERENCE',
        message: `Root changed entity ID '${rootId}' not found in the 2D sketch model.`,
        entityIds: [rootId],
      });
      return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
    }

    // Apply starting parameter change
    let oldRootParams = this.get2DEntityParams(rootEntity);
    if (request.targetParameter && request.newValue !== undefined) {
      currentModel = this.update2DModelEntity(currentModel, rootId, request.targetParameter, request.newValue);
    }

    // Setup adjacency maps
    const entityToConstraints = new Map<string, SketchConstraint[]>();
    for (const c of constraints) {
      for (const ref of c.references) {
        const id = this.getCleanId(ref.entityId);
        if (!entityToConstraints.has(id)) {
          entityToConstraints.set(id, []);
        }
        entityToConstraints.get(id)!.push(c);
      }
    }

    // Propagation State
    const steps: PropagationStep[] = [];
    const conflicts: PropagationConflict[] = [];
    const cycles: PropagationCycle[] = [];
    const affectedEntities = new Set<string>();
    const affectedConstraints = new Set<string>();

    const queue: string[] = [rootId];
    const visited = new Set<string>([rootId]);
    const pathStack: string[] = [rootId];

    let stepCount = 0;
    let converged = true;
    let status: PropagationStatus = 'PROPAGATED';
    let totalConvergenceDiff = 0;

    const tolerance = request.toleranceModel?.parametric ?? this.DEFAULT_TOLERANCE;

    while (queue.length > 0) {
      const u = queue.shift()!;
      pathStack.push(u);

      const connectedConstraints = entityToConstraints.get(u) || [];
      for (const c of connectedConstraints) {
        // Find other entities v in this constraint
        for (const ref of c.references) {
          const v = this.getCleanId(ref.entityId);
          if (v === u) continue;

          // Cycle Detection
          if (pathStack.includes(v)) {
            cycles.push({
              cycleDetected: true,
              cyclePath: [...pathStack, v],
              cycleLength: pathStack.length - pathStack.indexOf(v),
            });
            diagnostics.push({
              severity: 'WARNING',
              code: 'CYCLE_DETECTED',
              message: `Cycle path detected during propagation: ${pathStack.join(' -> ')} -> ${v}`,
              entityIds: [u, v],
              constraintIds: [this.getCleanId(c.id)],
            });
            continue;
          }

          if (stepCount >= maxSteps) {
            diagnostics.push({
              severity: 'WARNING',
              code: 'PROPAGATION_LIMIT_REACHED',
              message: `Constraint propagation limit of ${maxSteps} steps reached.`,
            });
            converged = false;
            break;
          }

          // Solve localized subsystem containing {u, v} under constraint c, keeping u fixed
          const uEntity = currentModel.entities.find(e => this.getCleanId(e.id) === u)!;
          const vEntity = currentModel.entities.find(e => this.getCleanId(e.id) === v)!;

          const tempSketch: SketchModel = {
            ...currentModel,
            entities: [uEntity, vEntity],
          };

          const uParams = this.get2DEntityParams(uEntity);
          const cFixU: SketchConstraint = {
            id: {
              ...c.id,
              artifactId: `temp-fix-${u}`,
              identityId: `temp-fix-${u}-${(c.id as any).identityId || ''}`
            },
            type: 'FIX',
            sketchId: currentModel.id,
            references: [{ entityId: uEntity.id, target: 'ENTITY' }],
            parameters: {
              value: uParams.x !== undefined ? uParams.x : uParams.cx !== undefined ? uParams.cx : uParams.x1,
            } as any,
            driving: true,
            provenance: uEntity.provenance,
          };
          (cFixU.parameters as any).valueY = uParams.y !== undefined ? uParams.y : uParams.cy !== undefined ? uParams.cy : uParams.y1;

          // Find all constraints that reference ONLY u or v (including c)
          const subConstraints = constraints.filter(con => {
            return con.references.every(ref => {
              const refId = this.getCleanId(ref.entityId);
              return refId === u || refId === v;
            });
          });

          const tempConstraints = [cFixU, ...subConstraints];
          const solveResult = DeterministicSolver.solve(tempSketch, tempConstraints);
          if (solveResult.status === 'CONVERGED') {
            const solvedV = solveResult.solvedSketch.entities.find(e => this.getCleanId(e.id) === v)!;
            const oldVParams = this.get2DEntityParams(vEntity);
            const newVParams = this.get2DEntityParams(solvedV);

            // Calculate metric
            let diff = 0;
            for (const key of Object.keys(newVParams)) {
              diff += Math.abs((newVParams[key] || 0) - (oldVParams[key] || 0));
            }

            if (diff > tolerance) {
              totalConvergenceDiff += diff;
              currentModel = this.replace2DEntity(currentModel, solvedV);

              steps.push({
                stepIndex: steps.length + 1,
                sourceEntityId: u,
                affectedEntityId: v,
                constraintId: this.getCleanId(c.id),
                dependencyPath: [...pathStack, v],
                propagationDepth: pathStack.length,
                oldValue: oldVParams,
                newValue: newVParams,
              });

              affectedEntities.add(v);
              affectedConstraints.add(this.getCleanId(c.id));

              if (!visited.has(v)) {
                visited.add(v);
                queue.push(v);
              }
            }
          } else {
            // CONFLICT DETECTED!
            conflicts.push({
              conflictingConstraintIds: [this.getCleanId(c.id)],
              affectedEntities: [u, v],
              evaluatedValues: [request.newValue ?? 0],
              tolerance,
              dependencyPath: [...pathStack, v],
              propagationStep: steps.length + 1,
            });
            diagnostics.push({
              severity: 'ERROR',
              code: 'CONFLICT_DETECTED',
              message: `Conflict detected in constraint '${this.getCleanId(c.id)}' between entities '${u}' and '${v}'.`,
              constraintIds: [this.getCleanId(c.id)],
              entityIds: [u, v],
            });
            status = 'CONFLICT';
            converged = false;
            break;
          }

          stepCount++;
        }
        if (status === 'CONFLICT' || !converged) break;
      }

      pathStack.pop();
      if (status === 'CONFLICT' || !converged) break;
    }

    if (steps.length === 0 && status === 'PROPAGATED') {
      status = 'STABLE';
    }

    // Determine Degrees of Freedom (DOF)
    let dofVal = 0;
    try {
      const finalDof = DegreeOfFreedomAnalyzer.analyze(currentModel, constraints);
      dofVal = finalDof.estimatedRemainingDOF;
      if (dofVal > 0 && status === 'PROPAGATED') {
        status = 'UNDER_CONSTRAINED';
      }
    } catch {
      // Degenerate checks
    }

    const trace = this.buildTrace(
      propagationId,
      rootId,
      Array.from(affectedEntities),
      Array.from(affectedConstraints),
      steps,
      status,
      stepCount,
      totalConvergenceDiff,
      conflicts,
      cycles,
      diagnostics
    );

    return {
      status,
      updatedModel2D: currentModel,
      trace,
      diagnostics,
    };
  }

  /**
   * 3D Constraint Propagation
   */
  private static propagate3D(
    request: ConstraintPropagationRequest,
    propagationId: string,
    maxSteps: number,
    diagnostics: PropagationDiagnostic[]
  ): ConstraintPropagationResult {
    let currentModel = request.model3D!;
    const constraints = request.constraints3D!;
    const rootId = request.changedEntityId;

    // Check for duplicate constraint IDs
    const seenCIds = new Set<string>();
    for (const c of constraints) {
      const cid = this.getCleanId(c.id);
      if (seenCIds.has(cid)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'DUPLICATE_CONSTRAINT_ID',
          message: `Duplicate constraint ID detected in request: ${cid}`,
          constraintIds: [cid],
        });
        return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
      }
      seenCIds.add(cid);
    }

    // Check for missing entity references
    const entityIds = new Set(currentModel.entities.map(e => this.getCleanId(e.id)));
    for (const c of constraints) {
      for (const ref of c.references) {
        const refId = this.getCleanId(ref.entityId);
        if (!entityIds.has(refId)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'MISSING_ENTITY_REFERENCE',
            message: `Constraint '${this.getCleanId(c.id)}' references non-existent entity: '${refId}'`,
            constraintIds: [this.getCleanId(c.id)],
            entityIds: [refId],
          });
          return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
        }
      }
    }

    // Find root entity
    const rootEntity = currentModel.entities.find(e => this.getCleanId(e.id) === rootId);
    if (!rootEntity) {
      diagnostics.push({
        severity: 'ERROR',
        code: 'MISSING_ENTITY_REFERENCE',
        message: `Root changed entity ID '${rootId}' not found in the 3D model.`,
        entityIds: [rootId],
      });
      return this.emptyResult('INVALID_INPUT', propagationId, rootId, diagnostics);
    }

    // Apply parameter change
    let oldRootParams = this.get3DEntityParams(rootEntity);
    if (request.targetParameter && request.newValue !== undefined) {
      currentModel = this.update3DModelEntity(currentModel, rootId, request.targetParameter, request.newValue);
    }

    // Setup adjacency maps
    const entityToConstraints = new Map<string, Constraint3D[]>();
    for (const c of constraints) {
      for (const ref of c.references) {
        const id = this.getCleanId(ref.entityId);
        if (!entityToConstraints.has(id)) {
          entityToConstraints.set(id, []);
        }
        entityToConstraints.get(id)!.push(c);
      }
    }

    // Propagation State
    const steps: PropagationStep[] = [];
    const conflicts: PropagationConflict[] = [];
    const cycles: PropagationCycle[] = [];
    const affectedEntities = new Set<string>();
    const affectedConstraints = new Set<string>();

    const queue: string[] = [rootId];
    const visited = new Set<string>([rootId]);
    const pathStack: string[] = [rootId];

    let stepCount = 0;
    let converged = true;
    let status: PropagationStatus = 'PROPAGATED';
    let totalConvergenceDiff = 0;

    const tolerance = request.toleranceModel?.parametric ?? this.DEFAULT_TOLERANCE;

    while (queue.length > 0) {
      const u = queue.shift()!;
      pathStack.push(u);

      const connectedConstraints = entityToConstraints.get(u) || [];
      for (const c of connectedConstraints) {
        for (const ref of c.references) {
          const v = this.getCleanId(ref.entityId);
          if (v === u) continue;

          // Cycle Detection
          if (pathStack.includes(v)) {
            cycles.push({
              cycleDetected: true,
              cyclePath: [...pathStack, v],
              cycleLength: pathStack.length - pathStack.indexOf(v),
            });
            diagnostics.push({
              severity: 'WARNING',
              code: 'CYCLE_DETECTED',
              message: `Cycle path detected during propagation: ${pathStack.join(' -> ')} -> ${v}`,
              entityIds: [u, v],
              constraintIds: [this.getCleanId(c.id)],
            });
            continue;
          }

          if (stepCount >= maxSteps) {
            diagnostics.push({
              severity: 'WARNING',
              code: 'PROPAGATION_LIMIT_REACHED',
              message: `Constraint propagation limit of ${maxSteps} steps reached.`,
            });
            converged = false;
            break;
          }

          const uEntity = currentModel.entities.find(e => this.getCleanId(e.id) === u)!;
          const vEntity = currentModel.entities.find(e => this.getCleanId(e.id) === v)!;

          const tempModel: Model3D = {
            ...currentModel,
            entities: [uEntity, vEntity],
          };

          const uParams = this.get3DEntityParams(uEntity);
          const px = uParams.x !== undefined ? uParams.x : uParams.ox !== undefined ? uParams.ox : uParams.cx;
          const py = uParams.y !== undefined ? uParams.y : uParams.oy !== undefined ? uParams.oy : uParams.cy;
          const pz = uParams.z !== undefined ? uParams.z : uParams.oz !== undefined ? uParams.oz : uParams.cz;

          const cFixU: Constraint3D = {
            id: {
              ...c.id,
              artifactId: `temp-fix-${u}`,
              identityId: `temp-fix-${u}-${(c.id as any).identityId || ''}`
            },
            type: 'FIX_3D',
            modelId: currentModel.id,
            references: [{ entityId: uEntity.id, target: 'ENTITY' }],
            parameters: {
              value: px,
            } as any,
            driving: true,
            provenance: uEntity.provenance,
          };
          (cFixU.parameters as any).valueY = py;
          (cFixU.parameters as any).valueZ = pz;

          // Find all 3D constraints that reference ONLY u or v (including c)
          const subConstraints = constraints.filter(con => {
            return con.references.every(ref => {
              const refId = this.getCleanId(ref.entityId);
              return refId === u || refId === v;
            });
          });

          const tempConstraints = [cFixU, ...subConstraints];
          const solveResult = Constraint3DSolver.solve(tempModel, tempConstraints);

          if (solveResult.success && solveResult.converged) {
            const solvedV = solveResult.model.entities.find(e => this.getCleanId(e.id) === v)!;
            const oldVParams = this.get3DEntityParams(vEntity);
            const newVParams = this.get3DEntityParams(solvedV);

            let diff = 0;
            for (const key of Object.keys(newVParams)) {
              diff += Math.abs((newVParams[key] || 0) - (oldVParams[key] || 0));
            }

            if (diff > tolerance) {
              totalConvergenceDiff += diff;
              currentModel = this.replace3DEntity(currentModel, solvedV);

              steps.push({
                stepIndex: steps.length + 1,
                sourceEntityId: u,
                affectedEntityId: v,
                constraintId: this.getCleanId(c.id),
                dependencyPath: [...pathStack, v],
                propagationDepth: pathStack.length,
                oldValue: oldVParams,
                newValue: newVParams,
              });

              affectedEntities.add(v);
              affectedConstraints.add(this.getCleanId(c.id));

              if (!visited.has(v)) {
                visited.add(v);
                queue.push(v);
              }
            }
          } else {
            // CONFLICT DETECTED!
            conflicts.push({
              conflictingConstraintIds: [this.getCleanId(c.id)],
              affectedEntities: [u, v],
              evaluatedValues: [request.newValue ?? 0],
              tolerance,
              dependencyPath: [...pathStack, v],
              propagationStep: steps.length + 1,
            });
            diagnostics.push({
              severity: 'ERROR',
              code: 'CONFLICT_DETECTED',
              message: `Conflict detected in 3D constraint '${this.getCleanId(c.id)}' between entities '${u}' and '${v}'.`,
              constraintIds: [this.getCleanId(c.id)],
              entityIds: [u, v],
            });
            status = 'CONFLICT';
            converged = false;
            break;
          }

          stepCount++;
        }
        if (status === 'CONFLICT' || !converged) break;
      }

      pathStack.pop();
      if (status === 'CONFLICT' || !converged) break;
    }

    if (steps.length === 0 && status === 'PROPAGATED') {
      status = 'STABLE';
    }

    // Determine Degrees of Freedom (DOF)
    let dofVal = 0;
    try {
      const finalDof = DegreeOfFreedom3DAnalyzer.analyze(currentModel, constraints);
      dofVal = finalDof.estimatedRemainingDOF;
      if (dofVal > 0 && status === 'PROPAGATED') {
        status = 'UNDER_CONSTRAINED';
      }
    } catch {
      // Degenerate checks
    }

    const trace = this.buildTrace(
      propagationId,
      rootId,
      Array.from(affectedEntities),
      Array.from(affectedConstraints),
      steps,
      status,
      stepCount,
      totalConvergenceDiff,
      conflicts,
      cycles,
      diagnostics
    );

    return {
      status,
      updatedModel3D: currentModel,
      trace,
      diagnostics,
    };
  }

  /**
   * Helper to retrieve parameter representation of 2D entities
   */
  private static get2DEntityParams(entity: SketchEntity): Record<string, number> {
    const geom = entity.geometry;
    switch (geom.type) {
      case 'POINT':
        return { x: geom.x, y: geom.y };
      case 'LINE':
        return { x1: geom.start.x, y1: geom.start.y, x2: geom.end.x, y2: geom.end.y };
      case 'CIRCLE':
        return { cx: geom.center.x, cy: geom.center.y, r: geom.radius };
      default:
        return {};
    }
  }

  /**
   * Helper to modify 2D Entity parameters and return new cloned Model
   */
  private static update2DModelEntity(
    model: SketchModel,
    entityId: string,
    param: string,
    val: number
  ): SketchModel {
    const updatedEntities = model.entities.map(e => {
      if (this.getCleanId(e.id) !== entityId) return e;
      const geom = { ...e.geometry } as any;
      if (geom.type === 'POINT') {
        if (param === 'x') geom.x = val;
        else if (param === 'y') geom.y = val;
      } else if (geom.type === 'LINE') {
        if (param === 'x1') geom.start = { ...geom.start, x: val };
        else if (param === 'y1') geom.start = { ...geom.start, y: val };
        else if (param === 'x2') geom.end = { ...geom.end, x: val };
        else if (param === 'y2') geom.end = { ...geom.end, y: val };
      } else if (geom.type === 'CIRCLE') {
        if (param === 'cx') geom.center = { ...geom.center, x: val };
        else if (param === 'cy') geom.center = { ...geom.center, y: val };
        else if (param === 'r' || param === 'radius') geom.radius = val;
      }
      return { ...e, geometry: geom };
    });
    return { ...model, entities: updatedEntities, version: model.version + 1 };
  }

  /**
   * Replace entity in 2D model
   */
  private static replace2DEntity(model: SketchModel, entity: SketchEntity): SketchModel {
    const targetId = this.getCleanId(entity.id);
    const updatedEntities = model.entities.map(e => (this.getCleanId(e.id) === targetId ? entity : e));
    return { ...model, entities: updatedEntities, version: model.version + 1 };
  }

  /**
   * Helper to retrieve parameter representation of 3D entities
   */
  private static get3DEntityParams(entity: Geometry3DEntity): Record<string, number> {
    const geom = entity.geometry;
    const data = geom.data as any;
    switch (geom.type) {
      case 'POINT_3D':
        return { x: data.x, y: data.y, z: data.z };
      case 'LINE_3D':
      case 'AXIS_3D':
        return {
          ox: data.origin.x,
          oy: data.origin.y,
          oz: data.origin.z,
          dx: data.direction.x,
          dy: data.direction.y,
          dz: data.direction.z,
        };
      case 'PLANE':
        return {
          ox: data.origin.x,
          oy: data.origin.y,
          oz: data.origin.z,
          nx: data.normal.x,
          ny: data.normal.y,
          nz: data.normal.z,
        };
      case 'CIRCLE_3D':
        return {
          cx: data.center.x,
          cy: data.center.y,
          cz: data.center.z,
          nx: data.normal.x,
          ny: data.normal.y,
          nz: data.normal.z,
          r: data.radius,
        };
      default:
        return {};
    }
  }

  /**
   * Helper to modify 3D Entity parameters and return new cloned Model
   */
  private static update3DModelEntity(
    model: Model3D,
    entityId: string,
    param: string,
    val: number
  ): Model3D {
    const updatedEntities = model.entities.map(e => {
      if (this.getCleanId(e.id) !== entityId) return e;
      const geom = { ...e.geometry } as any;
      const data = { ...geom.data } as any;
      if (geom.type === 'POINT_3D') {
        if (param === 'x') data.x = val;
        else if (param === 'y') data.y = val;
        else if (param === 'z') data.z = val;
      } else if (geom.type === 'LINE_3D' || geom.type === 'AXIS_3D') {
        if (param === 'ox') data.origin = { ...data.origin, x: val };
        else if (param === 'oy') data.origin = { ...data.origin, y: val };
        else if (param === 'oz') data.origin = { ...data.origin, z: val };
        else if (param === 'dx') data.direction = { ...data.direction, x: val };
        else if (param === 'dy') data.direction = { ...data.direction, y: val };
        else if (param === 'dz') data.direction = { ...data.direction, z: val };
      } else if (geom.type === 'PLANE') {
        if (param === 'ox') data.origin = { ...data.origin, x: val };
        else if (param === 'oy') data.origin = { ...data.origin, y: val };
        else if (param === 'oz') data.origin = { ...data.origin, z: val };
        else if (param === 'nx') data.normal = { ...data.normal, x: val };
        else if (param === 'ny') data.normal = { ...data.normal, y: val };
        else if (param === 'nz') data.normal = { ...data.normal, z: val };
      }
      return { ...e, geometry: { ...geom, data } };
    });
    return { ...model, entities: updatedEntities, version: model.version + 1 };
  }

  /**
   * Replace entity in 3D model
   */
  private static replace3DEntity(model: Model3D, entity: Geometry3DEntity): Model3D {
    const targetId = this.getCleanId(entity.id);
    const updatedEntities = model.entities.map(e => (this.getCleanId(e.id) === targetId ? entity : e));
    return { ...model, entities: updatedEntities, version: model.version + 1 };
  }

  /**
   * Helper to build traces containing deterministic evidence compatibility hashes
   */
  private static buildTrace(
    propagationId: string,
    rootEntityId: string,
    affectedEntities: readonly string[],
    affectedConstraints: readonly string[],
    steps: readonly PropagationStep[],
    status: PropagationStatus,
    iterations: number,
    convergenceMetric: number,
    conflicts: readonly PropagationConflict[],
    cycles: readonly PropagationCycle[],
    diagnostics: readonly PropagationDiagnostic[]
  ): PropagationTrace {
    const rawTrace = {
      propagationId,
      rootEntityId,
      affectedEntities,
      affectedConstraints,
      steps,
      status,
      iterations,
      convergenceMetric,
      conflicts,
      cycles,
      diagnostics,
    };

    const evidenceHash = this.computeDeterministicHash(rawTrace);

    return {
      ...rawTrace,
      evidenceHash,
    };
  }

  /**
   * Returns empty result for invalid inputs
   */
  private static emptyResult(
    status: PropagationStatus,
    propagationId: string,
    rootEntityId: string,
    diagnostics: readonly PropagationDiagnostic[]
  ): ConstraintPropagationResult {
    const trace = this.buildTrace(
      propagationId,
      rootEntityId,
      [],
      [],
      [],
      status,
      0,
      0,
      [],
      [],
      diagnostics
    );
    return {
      status,
      trace,
      diagnostics,
    };
  }

  /**
   * Deterministic Object Hash Function (JSON-sort based)
   */
  public static computeDeterministicHash(obj: any): string {
    const str = JSON.stringify(obj, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((sorted: any, k) => {
            sorted[k] = value[k];
            return sorted;
          }, {});
      }
      return value;
    });

    return `EVIDENCE-PROP-${Math.abs(this.simpleStringHash(str)).toString(16).toUpperCase()}`;
  }

  private static simpleStringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
