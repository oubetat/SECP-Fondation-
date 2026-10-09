/**
 * SECP CAD Kernel — Canonical Sketch Contract
 * Phase PATCH-325A: Canonical Contract & Schema Reconciliation
 *
 * ARCHITECTURAL CONTRACT:
 * - Single Authoritative Level 1 (Geometry) & Level 2 (Constraint) Schema.
 * - Graph-based topological representation with discrete, stable entity IDs.
 * - GUARD 1 COMPLIANCE: 100% lossless reconciliation between CADDocument.Sketch,
 *   IndustrialSketchDefinition, and Flat UI representations.
 * - GUARD 2 COMPLIANCE: Solver state is strictly DERIVED from (Geometry + Constraints).
 *   No independently mutable solver state is stored as authoring ground truth.
 */

import {
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  SketchPoint2D,
  SketchLine2D,
  SketchArc2D,
  SketchCircle2D,
  SketchEllipse2D,
  SketchSpline2D,
  Vector2D,
  SolverSolutionState
} from '../IndustrialConstraintTypes';
import { SketchDimension } from '../dimensions/SketchDimensionTypes';
import { SketchEngine } from '../../geometry/SketchEngine';
import { IndustrialVariationalSolver, SolveResult } from '../IndustrialVariationalSolver';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../../cad-kernel/document/CADDocument';
import { CanonicalSketchAdapter } from './CanonicalSketchAdapter';
import { IndustrialSketchDefinition } from '../IndustrialConstraintTypes';
import { SketchSolverDiagnostics, SolverDiagnosticReport } from '../diagnostics/SketchSolverDiagnostics';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface SketchMirrorDefinition {
  readonly id: string;
  readonly seedEntityIds: string[];
  readonly mirrorLineId: string;
  readonly generatedEntityIds: string[];
  readonly suppressionState?: 'ACTIVE' | 'SUPPRESSED';
}

export interface SketchPatternDefinition {
  readonly id: string;
  readonly type: 'LINEAR' | 'CIRCULAR';
  readonly seedEntityIds: string[];
  readonly count: number;
  readonly parameters: {
    // Linear
    distance?: number;
    directionRad?: number;
    // Circular
    centerPointId?: string;
    totalAngleRad?: number;
  };
  readonly generatedEntityIds: string[];
  readonly suppressionState?: 'ACTIVE' | 'SUPPRESSED';
}

/**
 * The single authoritative Canonical Sketch Definition.
 * This represents the true Level 1 (Geometry) & Level 2 (Constraints) SOT in SECP.
 */
export interface CanonicalSketch {
  readonly id: string;
  readonly name: string;
  readonly plane: 'XY' | 'YZ' | 'XZ' | string;
  readonly origin?: Vector3D;
  readonly normal?: Vector3D;
  readonly revision: number;
  
  // Topological Entity Graph (keyed by stable entity ID)
  readonly entities: Record<string, IndustrialSketchEntity>;

  // Variational & Dimensional Constraints (keyed by stable constraint ID)
  readonly constraints: Record<string, IndustrialSketchConstraint>;

  // Parametric Dimensions (driving or driven)
  readonly dimensions?: Record<string, SketchDimension>;

  // Profile topological status
  readonly closedProfile?: boolean;

  readonly mirrors?: SketchMirrorDefinition[];
  readonly patterns?: SketchPatternDefinition[];
}

/**
 * GUARD 2: Derived Solver State
 * Purely functional output computed by IndustrialVariationalSolver.
 * NEVER stored as mutable ground truth inside CanonicalSketch.
 */
export interface DerivedSolverState {
  readonly status: SolverSolutionState;
  readonly totalDegreesOfFreedom: number;
  readonly constrainedDegreesOfFreedom: number;
  readonly remainingDegreesOfFreedom: number;
  readonly redundantConstraintIds: string[];
  readonly conflictingConstraintIds: string[];
  readonly solveDurationMs: number;
  readonly isConverged: boolean;
  readonly maxResidual: number;
  readonly iterations: number;
  readonly tolerance: number;
  readonly diagnosticsReport: SolverDiagnosticReport;
  readonly timestamp: string;
}

/**
 * Factory for a pristine Canonical Sketch.
 */
export function createEmptyCanonicalSketch(
  id: string = `SKETCH_${Date.now()}`,
  name: string = 'Sketch_1',
  plane: 'XY' | 'YZ' | 'XZ' | string = 'XY'
): CanonicalSketch {
  return {
    id,
    name,
    plane,
    origin: { x: 0, y: 0, z: 0 },
    normal: plane === 'YZ' ? { x: 1, y: 0, z: 0 } : plane === 'XZ' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 },
    revision: 1,
    entities: {},
    constraints: {},
    dimensions: {},
    closedProfile: false
  };
}

/**
 * Pure accessor helpers for typed entities.
 */
export function getCanonicalPoints(sketch: CanonicalSketch): SketchPoint2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchPoint2D => e.type === 'POINT');
}

export function getCanonicalLines(sketch: CanonicalSketch): SketchLine2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchLine2D => e.type === 'LINE');
}

export function getCanonicalCircles(sketch: CanonicalSketch): SketchCircle2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchCircle2D => e.type === 'CIRCLE');
}

export function getCanonicalArcs(sketch: CanonicalSketch): SketchArc2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchArc2D => e.type === 'ARC');
}

export function getCanonicalEllipses(sketch: CanonicalSketch): SketchEllipse2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchEllipse2D => e.type === 'ELLIPSE');
}

export function getCanonicalSplines(sketch: CanonicalSketch): SketchSpline2D[] {
  return Object.values(sketch.entities).filter((e): e is SketchSpline2D => e.type === 'SPLINE');
}

/**
 * GUARD 2 IMPLEMENTATION:
 * Computes derived solver state from pure (Geometry + Constraints).
 * Does not mutate the source sketch.
 */
export function deriveSolverState(
  sketch: CanonicalSketch,
  modifiedConstraintId?: string
): { solvedSketch: CanonicalSketch; solverState: DerivedSolverState } {
  const solver = new IndustrialVariationalSolver();
  const startTime = performance.now();
  
  // IndustrialVariationalSolver expects IndustrialSketchDefinition which is structurally identical
  const indDef: IndustrialSketchDefinition = {
    id: sketch.id,
    name: sketch.name,
    plane: (sketch.plane === 'YZ' || sketch.plane === 'XZ') ? sketch.plane : 'XY' as const,
    revision: sketch.revision,
    entities: { ...sketch.entities },
    constraints: { ...sketch.constraints },
    dimensions: sketch.dimensions ? { ...sketch.dimensions } : undefined,
    mirrors: sketch.mirrors ? [...sketch.mirrors] : [],
    patterns: sketch.patterns ? [...sketch.patterns] : []
  };

  const solveResult: SolveResult = solver.solve(indDef, modifiedConstraintId);
  const duration = performance.now() - startTime;
  const diagnosticsReport = SketchSolverDiagnostics.evaluate(indDef, solveResult);

  const derived: DerivedSolverState = {
    status: solveResult.solutionState,
    totalDegreesOfFreedom: solveResult.dofReport.totalDegreesOfFreedom,
    constrainedDegreesOfFreedom: solveResult.dofReport.constrainedDegreesOfFreedom,
    remainingDegreesOfFreedom: solveResult.dofReport.remainingDegreesOfFreedom,
    redundantConstraintIds: solveResult.dofReport.redundantConstraintIds || [],
    conflictingConstraintIds: solveResult.dofReport.conflictingConstraintIds || [],
    solveDurationMs: duration,
    isConverged: (solveResult.solutionState === 'SOLVED' || solveResult.solutionState === 'FULLY_CONSTRAINED' || solveResult.solutionState === 'UNDER_CONSTRAINED') && Number.isFinite(solveResult.maxResidual) && solveResult.maxResidual <= 1e-3,
    maxResidual: solveResult.maxResidual,
    iterations: solveResult.iterations,
    tolerance: 1e-5,
    diagnosticsReport,
    timestamp: new Date().toISOString()
  };

  const updatedSketch: CanonicalSketch = {
    ...sketch,
    entities: solveResult.sketch.entities,
    constraints: solveResult.sketch.constraints,
    dimensions: solveResult.sketch.dimensions,
    revision: sketch.revision + 1
  };

  return {
    solvedSketch: updatedSketch,
    solverState: derived
  };
}

/**
 * PURE CANONICAL MUTATION OPERATORS (Revision-Controlled)
 * Every authoritative mutation creates a new CanonicalSketch instance with revision + 1.
 */

export function mutateAddEntities(
  sketch: CanonicalSketch,
  entitiesToAdd: Record<string, IndustrialSketchEntity>,
  constraintsToAdd: Record<string, IndustrialSketchConstraint> = {}
): CanonicalSketch {
  return {
    ...sketch,
    entities: { ...sketch.entities, ...entitiesToAdd },
    constraints: { ...sketch.constraints, ...constraintsToAdd },
    revision: sketch.revision + 1
  };
}

export function mutateDeleteEntity(
  sketch: CanonicalSketch,
  entityId: string
): CanonicalSketch {
  const updatedEntities = { ...sketch.entities };
  delete updatedEntities[entityId];

  // Also remove constraints referencing this entity
  const updatedConstraints = { ...sketch.constraints };
  for (const [cId, c] of Object.entries(updatedConstraints)) {
    if (c.entityIds && c.entityIds.includes(entityId)) {
      delete updatedConstraints[cId];
    }
  }

  // Also remove dimensions referencing this entity
  const updatedDimensions = sketch.dimensions ? { ...sketch.dimensions } : undefined;
  if (updatedDimensions) {
    for (const [dId, d] of Object.entries(updatedDimensions)) {
      if (d.entityIds && d.entityIds.includes(entityId)) {
        delete updatedDimensions[dId];
      }
    }
  }

  return {
    ...sketch,
    entities: updatedEntities,
    constraints: updatedConstraints,
    dimensions: updatedDimensions,
    revision: sketch.revision + 1
  };
}

export function mutateAddConstraint(
  sketch: CanonicalSketch,
  constraint: IndustrialSketchConstraint
): CanonicalSketch {
  return {
    ...sketch,
    constraints: { ...sketch.constraints, [constraint.id]: constraint },
    revision: sketch.revision + 1
  };
}

export function mutateRemoveConstraint(
  sketch: CanonicalSketch,
  constraintId: string
): CanonicalSketch {
  const updatedConstraints = { ...sketch.constraints };
  delete updatedConstraints[constraintId];
  return {
    ...sketch,
    constraints: updatedConstraints,
    revision: sketch.revision + 1
  };
}

export function mutateEntityParameter(
  sketch: CanonicalSketch,
  entityId: string,
  params: Partial<IndustrialSketchEntity>
): CanonicalSketch {
  const target = sketch.entities[entityId];
  if (!target) return sketch;

  return {
    ...sketch,
    entities: {
      ...sketch.entities,
      [entityId]: { ...target, ...params } as IndustrialSketchEntity
    },
    revision: sketch.revision + 1
  };
}

export function mutateAddFlatEntities(
  sketch: CanonicalSketch,
  flatEntitiesToAdd: any[]
): CanonicalSketch {
  const existingFlat = CanonicalSketchAdapter.toFlatEntities(sketch);
  const mergedFlat = [...existingFlat];
  for (const ent of flatEntitiesToAdd) {
    const normId = ent.id.startsWith('e_') ? ent.id.substring(2) : ent.id;
    const idx = mergedFlat.findIndex(e => {
      const eNorm = e.id.startsWith('e_') ? e.id.substring(2) : e.id;
      return eNorm === normId || e.id === ent.id;
    });
    if (idx >= 0) {
      mergedFlat[idx] = ent;
    } else {
      mergedFlat.push(ent);
    }
  }
  const newCanonical = CanonicalSketchAdapter.fromFlatEntities(mergedFlat, {
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    constraints: sketch.constraints
  });
  return { ...newCanonical, revision: sketch.revision + 1 };
}

export function mutateDeleteFlatEntity(
  sketch: CanonicalSketch,
  entityId: string
): CanonicalSketch {
  return mutateDeleteEntity(sketch, entityId);
}

export function mutateAddFlatConstraint(
  sketch: CanonicalSketch,
  entityId1: string,
  type: string,
  entityId2?: string
): CanonicalSketch {
  // If it's a FIX constraint, we store it in the entity's constraints array for legacy/flat compatibility,
  // but also ensure it's translated correctly.
  
  if (type === 'FIX') {
    const existingFlat = CanonicalSketchAdapter.toFlatEntities(sketch);
    const updatedFlat = existingFlat.map(ent => {
      if (ent.id === entityId1) {
        const constraints = ent.constraints.includes('FIX')
          ? ent.constraints
          : [...ent.constraints, 'FIX'];
        return { ...ent, constraints };
      }
      return ent;
    });
    const newCanonical = CanonicalSketchAdapter.fromFlatEntities(updatedFlat, {
      id: sketch.id,
      name: sketch.name,
      plane: sketch.plane,
      constraints: sketch.constraints
    });
    return { ...newCanonical, revision: sketch.revision + 1 };
  } else {
    // Top-level constraint addition for multi-entity constraints (e.g. COINCIDENT)
    const newConstraint: IndustrialSketchConstraint = {
      id: `c-${Math.random().toString(36).substr(2, 9)}`,
      type: type as any,
      entityIds: entityId2 ? [entityId1, entityId2] : [entityId1],
      isDriving: true,
      suppressionState: 'ACTIVE'
    };
    
    return {
      ...sketch,
      constraints: { ...sketch.constraints, [newConstraint.id]: newConstraint },
      revision: sketch.revision + 1
    };
  }
}

export function regenerateSketchMirrors(sketch: CanonicalSketch): CanonicalSketch {
  if (!sketch.mirrors || sketch.mirrors.length === 0) {
    return sketch;
  }

  // Clone entities and constraints to avoid direct mutation of readonly properties
  const entities = { ...sketch.entities };
  const constraints = { ...sketch.constraints };

  const updatedMirrors: SketchMirrorDefinition[] = [];

  for (const mirror of sketch.mirrors) {
    if (mirror.suppressionState === 'SUPPRESSED') {
      updatedMirrors.push(mirror);
      continue;
    }

    // 1. Resolve mirror axis/line
    let mirrorPoint = { x: 0, y: 0 };
    let mirrorDir = { x: 1, y: 0 }; // Default x axis

    let mirrorLineExists = false;
    if (mirror.mirrorLineId === 'X') {
      mirrorPoint = { x: 0, y: 0 };
      mirrorDir = { x: 1, y: 0 };
      mirrorLineExists = true;
    } else if (mirror.mirrorLineId === 'Y') {
      mirrorPoint = { x: 0, y: 0 };
      mirrorDir = { x: 0, y: 1 };
      mirrorLineExists = true;
    } else {
      const line = entities[mirror.mirrorLineId] as any;
      if (line && line.type === 'LINE') {
        const p1 = entities[line.startPointId] as any;
        const p2 = entities[line.endPointId] as any;
        if (p1 && p2) {
          mirrorPoint = { x: p1.x, y: p1.y };
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len > 0) {
            mirrorDir = { x: dx / len, y: dy / len };
            mirrorLineExists = true;
          }
        }
      }
    }

    // Clean up any old generated entities of this mirror from the working entities
    if (mirror.generatedEntityIds) {
      for (const id of mirror.generatedEntityIds) {
        delete entities[id];
        // Clear all c-symmetric for this mirror ID
        Object.keys(constraints).forEach(cid => {
          if (cid.endsWith(`-${mirror.id}`)) delete constraints[cid];
        });
      }
    }

    if (!mirrorLineExists) {
      updatedMirrors.push({
        ...mirror,
        generatedEntityIds: []
      });
      continue;
    }

    const mirrorPointHelper = (p: { x: number; y: number }): { x: number; y: number } => {
      const vx = p.x - mirrorPoint.x;
      const vy = p.y - mirrorPoint.y;
      const proj = vx * mirrorDir.x + vy * mirrorDir.y;
      const cx = mirrorPoint.x + proj * mirrorDir.x;
      const cy = mirrorPoint.y + proj * mirrorDir.y;
      return {
        x: 2 * cx - p.x,
        y: 2 * cy - p.y
      };
    };

    const generatedEntityIds: string[] = [];
    const pointIdMap = new Map<string, string>();

    // First, mirror all points of seed entities
    const seedPointsToMirror = new Set<string>();
    for (const seedId of mirror.seedEntityIds) {
      const ent = entities[seedId];
      if (!ent) continue;

      if (ent.type === 'POINT') {
        seedPointsToMirror.add(seedId);
      } else if (ent.type === 'LINE') {
        seedPointsToMirror.add((ent as any).startPointId);
        seedPointsToMirror.add((ent as any).endPointId);
      } else if (ent.type === 'CIRCLE') {
        seedPointsToMirror.add((ent as any).centerPointId);
      } else if (ent.type === 'ARC') {
        seedPointsToMirror.add((ent as any).centerPointId);
        seedPointsToMirror.add((ent as any).startPointId);
        seedPointsToMirror.add((ent as any).endPointId);
      }
    }

    // Generate mirrored points
    for (const ptId of Array.from(seedPointsToMirror)) {
      const pt = entities[ptId] as any;
      if (pt && pt.type === 'POINT') {
        const mPt = mirrorPointHelper(pt);
        const newPtId = `pt-mirror-${ptId}-${mirror.id}`;
        entities[newPtId] = {
          id: newPtId,
          type: 'POINT',
          x: mPt.x,
          y: mPt.y,
          tag: 'MIRRORED'
        } as any;
        pointIdMap.set(ptId, newPtId);
        generatedEntityIds.push(newPtId);

        // Add a canonical symmetric constraint
        const constraintId = `c-symmetric-${ptId}-${mirror.id}`;
        constraints[constraintId] = {
          id: constraintId,
          type: 'SYMMETRIC',
          entityIds: [ptId, newPtId, mirror.mirrorLineId]
        };
      }
    }

    // Now recreate mirrored lines/circles/arcs
    for (const seedId of mirror.seedEntityIds) {
      const ent = entities[seedId];
      if (!ent) continue;

      if (ent.type === 'POINT') {
        // Handled above
      } else if (ent.type === 'LINE') {
        const line = ent as any;
        const sId = pointIdMap.get(line.startPointId);
        const eId = pointIdMap.get(line.endPointId);
        if (sId && eId) {
          const newLineId = `line-mirror-${seedId}-${mirror.id}`;
          entities[newLineId] = {
            id: newLineId,
            type: 'LINE',
            startPointId: sId,
            endPointId: eId,
            isConstruction: line.isConstruction,
            isCenterline: line.isCenterline,
            tag: 'MIRRORED'
          } as any;
          generatedEntityIds.push(newLineId);
        }
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as any;
        const cId = pointIdMap.get(circ.centerPointId);
        if (cId) {
          const newCircId = `circ-mirror-${seedId}-${mirror.id}`;
          entities[newCircId] = {
            id: newCircId,
            type: 'CIRCLE',
            centerPointId: cId,
            radius: circ.radius,
            isConstruction: circ.isConstruction,
            tag: 'MIRRORED'
          } as any;
          generatedEntityIds.push(newCircId);
        }
      } else if (ent.type === 'ARC') {
        const arc = ent as any;
        const cId = pointIdMap.get(arc.centerPointId);
        const sId = pointIdMap.get(arc.startPointId);
        const eId = pointIdMap.get(arc.endPointId);
        if (cId && sId && eId) {
          const newArcId = `arc-mirror-${seedId}-${mirror.id}`;
          entities[newArcId] = {
            id: newArcId,
            type: 'ARC',
            centerPointId: cId,
            startPointId: sId,
            endPointId: eId,
            radius: arc.radius,
            direction: arc.direction === 'CW' ? 'CCW' : 'CW',
            isConstruction: arc.isConstruction,
            tag: 'MIRRORED'
          } as any;
          generatedEntityIds.push(newArcId);
        }
      }
    }

    updatedMirrors.push({
      ...mirror,
      generatedEntityIds
    });
  }

  return {
    ...sketch,
    entities,
    constraints,
    mirrors: updatedMirrors
  };
}

export function regenerateSketchPatterns(sketch: CanonicalSketch): CanonicalSketch {
  if (!sketch.patterns || sketch.patterns.length === 0) return sketch;

  const entities = { ...sketch.entities };
  const constraints = { ...sketch.constraints };
  const updatedPatterns: SketchPatternDefinition[] = [];

  for (const pattern of sketch.patterns) {
    if (pattern.suppressionState === 'SUPPRESSED') {
      updatedPatterns.push(pattern);
      continue;
    }

    // Clean up old instances
    if (pattern.generatedEntityIds) {
      for (const id of pattern.generatedEntityIds) {
        delete entities[id];
      }
    }

    const generatedEntityIds: string[] = [];

    for (let i = 1; i < pattern.count; i++) {
      const pointIdMap = new Map<string, string>();
      const seedPoints = new Set<string>();

      // Collect all points from seed entities
      for (const seedId of pattern.seedEntityIds) {
        const ent = entities[seedId];
        if (!ent) continue;
        if (ent.type === 'POINT') seedPoints.add(seedId);
        else if (ent.type === 'LINE') { seedPoints.add(ent.startPointId); seedPoints.add(ent.endPointId); }
        else if (ent.type === 'CIRCLE') { seedPoints.add(ent.centerPointId); }
        else if (ent.type === 'ARC') { seedPoints.add(ent.centerPointId); seedPoints.add(ent.startPointId); seedPoints.add(ent.endPointId); }
      }

      // Transform Helper
      const transformPoint = (p: { x: number, y: number }): { x: number, y: number } => {
        if (pattern.type === 'LINEAR') {
          const dist = (pattern.parameters.distance || 0) * i;
          const dir = pattern.parameters.directionRad || 0;
          return {
            x: p.x + dist * Math.cos(dir),
            y: p.y + dist * Math.sin(dir)
          };
        } else {
          // Circular
          const centerId = pattern.parameters.centerPointId;
          const center = centerId ? entities[centerId] as SketchPoint2D : { x: 0, y: 0 };
          const angle = (pattern.parameters.totalAngleRad || 0) / (pattern.count - 1) * i;
          
          const dx = p.x - center.x;
          const dy = p.y - center.y;
          return {
            x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle)
          };
        }
      };

      // Create Points
      for (const ptId of Array.from(seedPoints)) {
        const pt = entities[ptId] as any;
        if (pt && pt.type === 'POINT') {
          const tPt = transformPoint(pt);
          const newPtId = `pt-pattern-${ptId}-${pattern.id}-${i}`;
          entities[newPtId] = {
            ...pt,
            id: newPtId,
            x: tPt.x,
            y: tPt.y,
            tag: 'PATTERN_INSTANCE'
          };
          pointIdMap.set(ptId, newPtId);
          generatedEntityIds.push(newPtId);
        }
      }

      // Recreate Entities
      for (const seedId of pattern.seedEntityIds) {
        const ent = entities[seedId];
        if (!ent || ent.type === 'POINT') continue;

        const newEntId = `ent-pattern-${seedId}-${pattern.id}-${i}`;
        
        if (ent.type === 'LINE') {
          const sId = pointIdMap.get(ent.startPointId);
          const eId = pointIdMap.get(ent.endPointId);
          if (sId && eId) {
            entities[newEntId] = { ...ent, id: newEntId, startPointId: sId, endPointId: eId, tag: 'PATTERN_INSTANCE' } as any;
            generatedEntityIds.push(newEntId);
          }
        } else if (ent.type === 'CIRCLE') {
          const cId = pointIdMap.get(ent.centerPointId);
          if (cId) {
            entities[newEntId] = { ...ent, id: newEntId, centerPointId: cId, tag: 'PATTERN_INSTANCE' } as any;
            generatedEntityIds.push(newEntId);
          }
        } else if (ent.type === 'ARC') {
          const cId = pointIdMap.get(ent.centerPointId);
          const sId = pointIdMap.get(ent.startPointId);
          const eId = pointIdMap.get(ent.endPointId);
          if (cId && sId && eId) {
            entities[newEntId] = { ...ent, id: newEntId, centerPointId: cId, startPointId: sId, endPointId: eId, tag: 'PATTERN_INSTANCE' } as any;
            generatedEntityIds.push(newEntId);
          }
        }
      }
    }

    updatedPatterns.push({
      ...pattern,
      generatedEntityIds
    });
  }

  return {
    ...sketch,
    entities,
    constraints,
    patterns: updatedPatterns
  };
}

export function solveCanonicalSketch(sketch: CanonicalSketch): {
  solvedSketch: CanonicalSketch;
  solverState: DerivedSolverState & {
    dofCount: number;
    activeConstraintsCount: number;
    conflictingConstraints: string[];
    redundantConstraints: string[];
    residualNorm: number;
    diagnosticsReport: SolverDiagnosticReport;
  };
} {
  // 1. Regenerate all mirrors first
  let mirrored = regenerateSketchMirrors(sketch);
  
  // 2. Regenerate all patterns
  let patterned = regenerateSketchPatterns(mirrored);

  // 3. Use IndustrialVariationalSolver (via deriveSolverState) for authoritative solving
  const { solvedSketch, solverState } = deriveSolverState(patterned);

  // 4. Map DerivedSolverState to a compatible diagnostic format for the UI & Dispatcher
  const diagnostic = {
    ...solverState,
    dofCount: solverState.remainingDegreesOfFreedom,
    activeConstraintsCount: solverState.constrainedDegreesOfFreedom,
    conflictingConstraints: solverState.conflictingConstraintIds,
    redundantConstraints: solverState.redundantConstraintIds,
    residualNorm: solverState.maxResidual,
    diagnosticsReport: solverState.diagnosticsReport
  };

  return { solvedSketch, solverState: diagnostic };
}

/**
 * ACTIVE SKETCH OWNERSHIP HELPERS
 * Selects and updates CanonicalSketch within an EngineeringDocument by explicit activeSketchId.
 */
export function getActiveCanonicalSketch(
  doc: EngineeringDocument | null | undefined,
  activeSketchId: string | null | undefined
): CanonicalSketch | null {
  if (!doc || !doc.sketches || doc.sketches.length === 0) return null;
  if (activeSketchId) {
    const found = doc.sketches.find(s => s.id === activeSketchId);
    if (found) return CanonicalSketchAdapter.fromCADDocumentSketch(found);
  }
  return CanonicalSketchAdapter.fromCADDocumentSketch(doc.sketches[0]);
}

export function updateCanonicalSketchInDocument(
  doc: EngineeringDocument | null | undefined,
  sketch: CanonicalSketch
): EngineeringDocument {
  const docSketch = CanonicalSketchAdapter.toCADDocumentSketch(sketch);
  if (!doc) {
    return {
      documentId: `DOC_${Date.now()}`,
      revision: sketch.revision,
      units: DEFAULT_UNIT_SYSTEM_MM,
      sketches: [docSketch],
      constraints: [],
      features: [],
      parameters: [],
      topologyMap: { version: 1, entries: {} },
      derived: {},
      evidence: []
    };
  }

  const existingIndex = doc.sketches.findIndex(s => s.id === sketch.id);
  const updatedSketches = [...doc.sketches];
  if (existingIndex >= 0) {
    updatedSketches[existingIndex] = docSketch;
  } else {
    updatedSketches.push(docSketch);
  }

  return {
    ...doc,
    sketches: updatedSketches,
    revision: (typeof doc.revision === 'number' ? doc.revision : 1) + 1
  };
}

/**
 * LIFECYCLE & DUPLICATION HELPERS
 */
export function duplicateCanonicalSketch(
  sketch: CanonicalSketch,
  newId: string = `SKETCH_${Date.now()}_DUP`,
  newName?: string
): CanonicalSketch {
  return {
    ...sketch,
    id: newId,
    name: newName || `${sketch.name}_Copy`,
    revision: 1
  };
}

export function deleteCanonicalSketchFromDocument(
  doc: EngineeringDocument,
  sketchId: string
): EngineeringDocument {
  if (!doc || !doc.sketches) return doc;
  return {
    ...doc,
    sketches: doc.sketches.filter(s => s.id !== sketchId),
    revision: (typeof doc.revision === 'number' ? doc.revision : 1) + 1
  };
}

/**
 * SERIALIZATION & RESTORATION HELPERS
 */
export function serializeCanonicalSketch(sketch: CanonicalSketch): string {
  return JSON.stringify(sketch, null, 2);
}

export function deserializeCanonicalSketch(json: string): CanonicalSketch {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !parsed.id || !parsed.entities) {
    throw new Error('Invalid CanonicalSketch JSON payload');
  }
  return {
    id: parsed.id,
    name: parsed.name || `Sketch_${parsed.id}`,
    plane: parsed.plane || 'XY',
    origin: parsed.origin || { x: 0, y: 0, z: 0 },
    normal: parsed.normal || { x: 0, y: 0, z: 1 },
    revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
    entities: parsed.entities || {},
    constraints: parsed.constraints || {},
    dimensions: parsed.dimensions || {},
    closedProfile: parsed.closedProfile ?? false
  };
}

/**
 * CONCURRENCY & STALE UPDATE PROTECTION
 * Prevents asynchronous/delayed solver results from overwriting newer canonical mutations.
 */
export function applySolverResultSafely(
  currentSketch: CanonicalSketch,
  baseRevision: number,
  solvedResult: CanonicalSketch
): { updatedSketch: CanonicalSketch; accepted: boolean } {
  if (currentSketch.revision !== baseRevision) {
    // Current sketch has been mutated since solver was dispatched -> Reject stale solver result
    return {
      updatedSketch: currentSketch,
      accepted: false
    };
  }

  return {
    updatedSketch: solvedResult,
    accepted: true
  };
}



