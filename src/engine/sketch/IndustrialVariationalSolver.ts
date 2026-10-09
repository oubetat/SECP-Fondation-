import {
  IndustrialSketchDefinition,
  IndustrialSketchConstraint,
  IndustrialSketchEntity,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D,
  SketchDOFReport,
  ConstraintCausalityReport,
  IncrementalSolveStats,
  SolverSolutionState
} from './IndustrialConstraintTypes';
import { ConstraintGraphEngine } from './ConstraintGraphEngine';
import { UnitEngine } from '../units';
import { ConstraintSolver } from './gcs/ConstraintSolver';
import { SketchModel } from './SketchModel';
import { SketchConstraint } from './gcs/ConstraintModel';
import { EngineeringIdentity, EngineeringObjectType, IdentityClassification } from '../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';
import { SketchEntity } from './SketchEntity';

import { PointGeometry } from './SketchPoint';
import { LineGeometry } from './SketchLine';

export interface SolveResult {
  sketch: IndustrialSketchDefinition;
  solutionState: SolverSolutionState;
  dofReport: SketchDOFReport;
  causalityReport: ConstraintCausalityReport;
  incrementalStats: IncrementalSolveStats;
  maxResidual: number;
  iterations: number;
  structuralConflictDetected?: boolean;
  solverExecuted?: boolean;
}

export class IndustrialVariationalSolver {
  private tolerance: number = 1e-5;
  private maxIterations: number = 50;

  /**
   * Solve constraints on the sketch definition.
   */
  public solve(
    sketchInput: IndustrialSketchDefinition,
    modifiedConstraintId?: string
  ): SolveResult {
    const startTime = performance.now();
    // Deep clone sketch
    const sketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketchInput));

    const graphEngine = new ConstraintGraphEngine(sketch);
    const dofReport = graphEngine.computeDOFReport();
    const causalityReport = graphEngine.analyzeConstraintCausality();

    // Determine sub-graph for incremental solve
    let isIncremental = false;
    let affectedConstraintCount = Object.keys(sketch.constraints).length;

    if (modifiedConstraintId && sketch.constraints[modifiedConstraintId]) {
      const subGraph = graphEngine.extractAffectedSubGraph(modifiedConstraintId);
      isIncremental = true;
      affectedConstraintCount = subGraph.affectedConstraintIds.length;
    }

    if (dofReport.state === 'INCONSISTENT' || dofReport.state === 'CONFLICTING') {
      const solveTimeMs = performance.now() - startTime;
      return {
        sketch,
        solutionState: 'CONFLICTING',
        dofReport,
        causalityReport,
        incrementalStats: {
          totalConstraints: Object.keys(sketch.constraints).length,
          affectedSubGraphConstraintCount: affectedConstraintCount,
          solveTimeMs,
          isIncremental
        },
        maxResidual: 1e3,
        iterations: 0,
        structuralConflictDetected: true,
        solverExecuted: false
      };
    }

    // --- FULL GCS INTEGRATION ---
    // 1. Build SketchModel for GCS Solver
    const sketchId: EngineeringIdentity = {
      projectId: sketch.id,
      objectType: EngineeringObjectType.GEOMETRY,
      revisionId: 'rev-01',
      createdBy: 'system',
      identityId: 'sketch-id',
      objectVersion: 1,
      contentHash: 'hash',
      timestamp: new Date().toISOString(),
      classification: IdentityClassification.INTERNAL,
      tags: []
    };

    const mockProv: ProvenanceNode = {
      id: 'prov-01',
      type: 'DESIGN',
      engineeringIdentityId: sketch.id,
      canonicalHash: 'hash-01',
      version: '1.0',
      createdAt: new Date().toISOString(),
      evidenceRefs: []
    };

    const gcsEntities: SketchEntity[] = [];
    const gcsConstraints: SketchConstraint[] = [];

    // Helper to make EngineeringIdentity
    const makeId = (projId: string): EngineeringIdentity => ({
      projectId: projId,
      objectType: EngineeringObjectType.GEOMETRY,
      revisionId: 'rev-01',
      createdBy: 'system',
      identityId: `ent-${projId}`,
      objectVersion: 1,
      contentHash: 'hash',
      timestamp: new Date().toISOString(),
      classification: IdentityClassification.INTERNAL,
      tags: []
    });

    // Translate High-Level Entities to GCS Entities
    for (const [id, entity] of Object.entries(sketch.entities)) {
      const entityId = makeId(id);

      if (entity.type === 'POINT') {
        gcsEntities.push({
          id: entityId,
          type: 'POINT',
          sketchId,
          construction: false,
          geometry: { type: 'POINT', x: entity.x, y: entity.y },
          metadata: {},
          provenance: mockProv
        });

        // If POINT isFixed, add a GCS FIX constraint
        if (entity.isFixed) {
          gcsConstraints.push({
            id: makeId(`c-fix-${id}`),
            type: 'FIX',
            sketchId,
            references: [{ entityId, target: 'ENTITY' }],
            parameters: { value: entity.x, valueY: entity.y } as any,
            driving: true,
            provenance: mockProv
          });
        }
      } else if (entity.type === 'LINE') {
        const sp = sketch.entities[entity.startPointId] as SketchPoint2D;
        const ep = sketch.entities[entity.endPointId] as SketchPoint2D;
        if (sp && ep) {
          gcsEntities.push({
            id: entityId,
            type: 'LINE',
            sketchId,
            construction: false,
            geometry: {
              type: 'LINE',
              start: { x: sp.x, y: sp.y },
              end: { x: ep.x, y: ep.y }
            } as any,
            metadata: {},
            provenance: mockProv
          });

          // Constrain LINE start to POINT start
          gcsConstraints.push({
            id: makeId(`c-line-start-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'START_POINT' },
              { entityId: makeId(entity.startPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });

          // Constrain LINE end to POINT end
          gcsConstraints.push({
            id: makeId(`c-line-end-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'END_POINT' },
              { entityId: makeId(entity.endPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });
        }
      } else if (entity.type === 'CIRCLE') {
        const cp = sketch.entities[entity.centerPointId] as SketchPoint2D;
        if (cp) {
          gcsEntities.push({
            id: entityId,
            type: 'CIRCLE',
            sketchId,
            construction: false,
            geometry: {
              type: 'CIRCLE',
              center: { x: cp.x, y: cp.y },
              radius: entity.radius
            } as any,
            metadata: {},
            provenance: mockProv
          });

          // Constrain CIRCLE center to POINT center
          gcsConstraints.push({
            id: makeId(`c-circle-center-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'CENTER' },
              { entityId: makeId(entity.centerPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });
        }
      } else if (entity.type === 'ARC') {
        const cp = sketch.entities[entity.centerPointId] as SketchPoint2D;
        const sp = sketch.entities[entity.startPointId] as SketchPoint2D;
        const ep = sketch.entities[entity.endPointId] as SketchPoint2D;
        if (cp && sp && ep) {
          const startAngle = Math.atan2(sp.y - cp.y, sp.x - cp.x);
          const endAngle = Math.atan2(ep.y - cp.y, ep.x - cp.x);

          gcsEntities.push({
            id: entityId,
            type: 'ARC',
            sketchId,
            construction: false,
            geometry: {
              type: 'ARC',
              center: { x: cp.x, y: cp.y },
              radius: entity.radius,
              startAngle,
              endAngle
            } as any,
            metadata: {},
            provenance: mockProv
          });

          // Constrain ARC center to POINT center
          gcsConstraints.push({
            id: makeId(`c-arc-center-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'CENTER' },
              { entityId: makeId(entity.centerPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });

          // Constrain ARC start/end to points (Distance constraints to center enforce arc radius)
          gcsConstraints.push({
            id: makeId(`c-arc-start-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'START_POINT' },
              { entityId: makeId(entity.startPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });

          gcsConstraints.push({
            id: makeId(`c-arc-end-${id}`),
            type: 'COINCIDENT',
            sketchId,
            references: [
              { entityId, target: 'END_POINT' },
              { entityId: makeId(entity.endPointId), target: 'ENTITY' }
            ],
            parameters: {},
            driving: true,
            provenance: mockProv
          });
        }
      }
    }

    // Translate High-Level Constraints to GCS Constraints
    for (const [id, constraint] of Object.entries(sketch.constraints)) {
      if (constraint.suppressionState === 'SUPPRESSED') continue;

      const cId = makeId(id);
      const val = this.getConstraintValue(constraint);

      switch (constraint.type) {
        case 'FIX': {
          if (constraint.entityIds.length >= 1) {
            const entId = constraint.entityIds[0];
            const entity = sketch.entities[entId];
            if (entity) {
                gcsConstraints.push({
                    id: cId,
                    type: 'FIX',
                    sketchId,
                    references: [{ entityId: makeId(entId), target: 'ENTITY' }],
                    parameters: { 
                        value: (entity as any).x || 0, 
                        valueY: (entity as any).y || 0 
                    } as any,
                    driving: true,
                    provenance: mockProv
                });
            }
          }
          break;
        }
        case 'COINCIDENT': {
          if (constraint.entityIds.length >= 2) {
            const [p1Id, p2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'COINCIDENT',
              sketchId,
              references: [
                { entityId: makeId(p1Id), target: 'ENTITY' },
                { entityId: makeId(p2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'HORIZONTAL': {
          if (constraint.entityIds.length === 1) {
            const lineId = constraint.entityIds[0];
            gcsConstraints.push({
              id: cId,
              type: 'HORIZONTAL',
              sketchId,
              references: [{ entityId: makeId(lineId), target: 'ENTITY' }],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          } else if (constraint.entityIds.length === 2) {
            const [p1Id, p2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'HORIZONTAL',
              sketchId,
              references: [
                { entityId: makeId(p1Id), target: 'ENTITY' },
                { entityId: makeId(p2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'VERTICAL': {
          if (constraint.entityIds.length === 1) {
            const lineId = constraint.entityIds[0];
            gcsConstraints.push({
              id: cId,
              type: 'VERTICAL',
              sketchId,
              references: [{ entityId: makeId(lineId), target: 'ENTITY' }],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          } else if (constraint.entityIds.length === 2) {
            const [p1Id, p2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'VERTICAL',
              sketchId,
              references: [
                { entityId: makeId(p1Id), target: 'ENTITY' },
                { entityId: makeId(p2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'PARALLEL': {
          if (constraint.entityIds.length >= 2) {
            const [l1Id, l2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'PARALLEL',
              sketchId,
              references: [
                { entityId: makeId(l1Id), target: 'ENTITY' },
                { entityId: makeId(l2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'PERPENDICULAR': {
          if (constraint.entityIds.length >= 2) {
            const [l1Id, l2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'PERPENDICULAR',
              sketchId,
              references: [
                { entityId: makeId(l1Id), target: 'ENTITY' },
                { entityId: makeId(l2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'DISTANCE': {
          if (constraint.entityIds.length === 1) {
            const lineId = constraint.entityIds[0];
            gcsConstraints.push({
              id: cId,
              type: 'DISTANCE',
              sketchId,
              references: [{ entityId: makeId(lineId), target: 'ENTITY' }],
              parameters: { value: val },
              driving: true,
              provenance: mockProv
            });
          } else if (constraint.entityIds.length === 2) {
            const [p1Id, p2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'DISTANCE',
              sketchId,
              references: [
                { entityId: makeId(p1Id), target: 'ENTITY' },
                { entityId: makeId(p2Id), target: 'ENTITY' }
              ],
              parameters: { value: val },
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'RADIUS': {
          if (constraint.entityIds.length >= 1) {
            const entId = constraint.entityIds[0];
            gcsConstraints.push({
              id: cId,
              type: 'RADIUS',
              sketchId,
              references: [{ entityId: makeId(entId), target: 'ENTITY' }],
              parameters: { value: val },
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'DIAMETER': {
          if (constraint.entityIds.length >= 1) {
            const entId = constraint.entityIds[0];
            gcsConstraints.push({
              id: cId,
              type: 'DIAMETER',
              sketchId,
              references: [{ entityId: makeId(entId), target: 'ENTITY' }],
              parameters: { value: val },
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'ANGLE': {
          if (constraint.entityIds.length >= 2) {
            const [l1Id, l2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'ANGLE',
              sketchId,
              references: [
                { entityId: makeId(l1Id), target: 'ENTITY' },
                { entityId: makeId(l2Id), target: 'ENTITY' }
              ],
              parameters: { value: val },
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'TANGENT': {
          if (constraint.entityIds.length >= 2) {
            const [ent1Id, ent2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'TANGENT',
              sketchId,
              references: [
                { entityId: makeId(ent1Id), target: 'ENTITY' },
                { entityId: makeId(ent2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'EQUAL': {
          if (constraint.entityIds.length >= 2) {
            const [ent1Id, ent2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'EQUAL',
              sketchId,
              references: [
                { entityId: makeId(ent1Id), target: 'ENTITY' },
                { entityId: makeId(ent2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'CONCENTRIC': {
          if (constraint.entityIds.length >= 2) {
            const [ent1Id, ent2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'CONCENTRIC',
              sketchId,
              references: [
                { entityId: makeId(ent1Id), target: 'ENTITY' },
                { entityId: makeId(ent2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
        case 'SYMMETRIC': {
          if (constraint.entityIds.length >= 2) {
            const [p1Id, p2Id] = constraint.entityIds;
            gcsConstraints.push({
              id: cId,
              type: 'SYMMETRIC',
              sketchId,
              references: [
                { entityId: makeId(p1Id), target: 'ENTITY' },
                { entityId: makeId(p2Id), target: 'ENTITY' }
              ],
              parameters: {},
              driving: true,
              provenance: mockProv
            });
          }
          break;
        }
      }
    }

    // Prepare GCS SketchModel
    const gcsModel: SketchModel = {
      id: sketchId,
      name: sketch.name,
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 }
      },
      entities: gcsEntities,
      constraints: [],
      version: sketch.revision,
      units: 'mm',
      tolerance: {
        linear: 1e-5,
        angular: 1e-5,
        parametric: 1e-5,
        distance: 1e-5,
        coincidence: 1e-5,
        topology: 1e-5,
        sewing: 1e-5,
        boolean: 1e-5,
        approximation: 1e-5,
        unitSystem: 'mm',
        scale: 1.0,
        policyId: 'STRICT_INDUSTRIAL',
        version: '1.0.0'
      },
      provenance: mockProv,
      metadata: {}
    };

    // Invoke GCS Solver!
    const solverResult = ConstraintSolver.solve(gcsModel, gcsConstraints, {
      maxIterations: this.maxIterations,
      convergenceTolerance: this.tolerance,
      constraintTolerance: this.tolerance
    });

    // Write back solved values from GCS to original sketch clone
    if (solverResult.status === 'CONVERGED') {
      for (const ent of solverResult.solvedSketch.entities) {
        const pId = ent.id.projectId;
        const targetEntity = sketch.entities[pId];
        if (targetEntity) {
          if (targetEntity.type === 'POINT') {
            targetEntity.x = (ent.geometry as PointGeometry).x;
            targetEntity.y = (ent.geometry as PointGeometry).y;
          } else if (targetEntity.type === 'LINE') {
            const sp = sketch.entities[targetEntity.startPointId] as SketchPoint2D;
            const ep = sketch.entities[targetEntity.endPointId] as SketchPoint2D;
            if (sp && !sp.isFixed) {
              sp.x = (ent.geometry as LineGeometry).start.x;
              sp.y = (ent.geometry as LineGeometry).start.y;
            }
            if (ep && !ep.isFixed) {
              ep.x = (ent.geometry as LineGeometry).end.x;
              ep.y = (ent.geometry as LineGeometry).end.y;
            }
          } else if (targetEntity.type === 'CIRCLE') {
            targetEntity.radius = (ent.geometry as any).radius;
          } else if (targetEntity.type === 'ARC') {
            targetEntity.radius = (ent.geometry as any).radius;
          }
        }
      }
    }

    // Run Variational Relaxation as a robust fallback/stabilizer if needed
    let maxResidual = solverResult.maximumResidual;
    let iter = solverResult.iterations;

    if (solverResult.status !== 'CONVERGED') {
      const activeConstraints = Object.values(sketch.constraints).filter(c => c.suppressionState !== 'SUPPRESSED');
      for (iter = 0; iter < this.maxIterations; iter++) {
        let currentMaxRes = 0;
        for (const constraint of activeConstraints) {
          const res = this.applyConstraintRelaxation(sketch, constraint);
          if (res > currentMaxRes) {
            currentMaxRes = res;
          }
        }
        maxResidual = currentMaxRes;
        if (maxResidual < this.tolerance) {
          break;
        }
      }
    }

    const solveTimeMs = performance.now() - startTime;
    // We MUST use the mathematical truth from GCS solver's Jacobian rank evaluation
    const gcsDof = solverResult.dof;
    let finalState: SolverSolutionState = gcsDof.status as SolverSolutionState;
    if ((dofReport.state as any) === 'CONFLICTING' || (dofReport.state as any) === 'INCONSISTENT') {
      finalState = dofReport.state;
    }

    // Strict numerical convergence truth: non-finite residuals or residuals exceeding tolerance CANNOT be classified as solved/converged
    if (!Number.isFinite(maxResidual) || maxResidual > this.tolerance) {
      if (finalState === 'FULLY_CONSTRAINED' || finalState === 'UNDER_CONSTRAINED' || finalState === 'SOLVED') {
        finalState = (gcsDof.initialDOF > 0 && gcsDof.independentConstraintRank === gcsDof.initialDOF)
          ? 'OVER_CONSTRAINED'
          : 'CONFLICTING';
      }
    } else {
      if (gcsDof.redundantConstraintCount > 0 && finalState !== 'CONFLICTING') {
        finalState = 'REDUNDANT';
      } else if (gcsDof.estimatedRemainingDOF === 0 && finalState !== 'CONFLICTING' && finalState !== 'OVER_CONSTRAINED') {
        finalState = 'FULLY_CONSTRAINED';
      } else if (gcsDof.estimatedRemainingDOF > 0 && finalState !== 'CONFLICTING' && finalState !== 'OVER_CONSTRAINED') {
        finalState = 'UNDER_CONSTRAINED';
      }
    }

    const finalDOFReport: SketchDOFReport = {
      totalDegreesOfFreedom: gcsDof.initialDOF,
      constrainedDegreesOfFreedom: gcsDof.independentConstraintRank ?? gcsDof.constraintCount,
      remainingDegreesOfFreedom: gcsDof.estimatedRemainingDOF,
      state: finalState,
      redundantConstraintIds: gcsDof.redundantConstraintIds,
      conflictingConstraintIds: gcsDof.conflictingConstraintIds.length > 0 ? gcsDof.conflictingConstraintIds : dofReport.conflictingConstraintIds
    };
    
    // We still want the causality report, but it's secondary to mathematical state
    const finalCausalityReport = graphEngine.analyzeConstraintCausality();

    return {
      sketch,
      solutionState: finalState,
      dofReport: finalDOFReport,
      causalityReport: finalCausalityReport,
      incrementalStats: {
        totalConstraints: Object.keys(sketch.constraints).length,
        affectedSubGraphConstraintCount: affectedConstraintCount,
        solveTimeMs,
        isIncremental
      },
      maxResidual,
      iterations: iter,
      structuralConflictDetected: false,
      solverExecuted: true
    };
  }

  private applyConstraintRelaxation(
    sketch: IndustrialSketchDefinition,
    constraint: IndustrialSketchConstraint
  ): number {
    let residual = 0;
    const val = this.getConstraintValue(constraint);

    switch (constraint.type) {
      case 'COINCIDENT': {
        // Force point 1 and point 2 to match
        const [p1Id, p2Id] = constraint.entityIds;
        const p1 = this.getPoint(sketch, p1Id);
        const p2 = this.getPoint(sketch, p2Id);

        if (p1 && p2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          residual = Math.hypot(dx, dy);

          if (!p1.isFixed && !p2.isFixed) {
            p1.x += dx * 0.5;
            p1.y += dy * 0.5;
            p2.x -= dx * 0.5;
            p2.y -= dy * 0.5;
          } else if (!p1.isFixed) {
            p1.x = p2.x;
            p1.y = p2.y;
          } else if (!p2.isFixed) {
            p2.x = p1.x;
            p2.y = p1.y;
          }
        }
        break;
      }

      case 'HORIZONTAL': {
        // Enforce y1 = y2 for line or 2 points
        const points = this.getConstraintPoints(sketch, constraint);
        if (points.length >= 2) {
          const [p1, p2] = points;
          const dy = p2.y - p1.y;
          residual = Math.abs(dy);

          const midY = (p1.y + p2.y) / 2;
          if (!p1.isFixed) p1.y = midY;
          if (!p2.isFixed) p2.y = midY;
        }
        break;
      }

      case 'VERTICAL': {
        // Enforce x1 = x2 for line or 2 points
        const points = this.getConstraintPoints(sketch, constraint);
        if (points.length >= 2) {
          const [p1, p2] = points;
          const dx = p2.x - p1.x;
          residual = Math.abs(dx);

          const midX = (p1.x + p2.x) / 2;
          if (!p1.isFixed) p1.x = midX;
          if (!p2.isFixed) p2.x = midX;
        }
        break;
      }

      case 'PARALLEL': {
        // Enforce equal slope for 2 lines
        const [l1Id, l2Id] = constraint.entityIds;
        const l1 = sketch.entities[l1Id] as SketchLine2D;
        const l2 = sketch.entities[l2Id] as SketchLine2D;

        if (l1 && l2) {
          const p1a = sketch.entities[l1.startPointId] as SketchPoint2D;
          const p1b = sketch.entities[l1.endPointId] as SketchPoint2D;
          const p2a = sketch.entities[l2.startPointId] as SketchPoint2D;
          const p2b = sketch.entities[l2.endPointId] as SketchPoint2D;

          if (p1a && p1b && p2a && p2b) {
            const angle1 = Math.atan2(p1b.y - p1a.y, p1b.x - p1a.x);
            const angle2 = Math.atan2(p2b.y - p2a.y, p2b.x - p2a.x);
            residual = Math.abs(angle1 - angle2);

            const len2 = Math.hypot(p2b.x - p2a.x, p2b.y - p2a.y);
            if (!p2b.isFixed) {
              p2b.x = p2a.x + Math.cos(angle1) * len2;
              p2b.y = p2a.y + Math.sin(angle1) * len2;
            }
          }
        }
        break;
      }

      case 'PERPENDICULAR': {
        // Enforce dot product = 0
        const [l1Id, l2Id] = constraint.entityIds;
        const l1 = sketch.entities[l1Id] as SketchLine2D;
        const l2 = sketch.entities[l2Id] as SketchLine2D;

        if (l1 && l2) {
          const p1a = sketch.entities[l1.startPointId] as SketchPoint2D;
          const p1b = sketch.entities[l1.endPointId] as SketchPoint2D;
          const p2a = sketch.entities[l2.startPointId] as SketchPoint2D;
          const p2b = sketch.entities[l2.endPointId] as SketchPoint2D;

          if (p1a && p1b && p2a && p2b) {
            const angle1 = Math.atan2(p1b.y - p1a.y, p1b.x - p1a.x);
            const targetAngle2 = angle1 + Math.PI / 2;
            const currentAngle2 = Math.atan2(p2b.y - p2a.y, p2b.x - p2a.x);

            residual = Math.abs(currentAngle2 - targetAngle2);
            const len2 = Math.hypot(p2b.x - p2a.x, p2b.y - p2a.y);
            if (!p2b.isFixed) {
              p2b.x = p2a.x + Math.cos(targetAngle2) * len2;
              p2b.y = p2a.y + Math.sin(targetAngle2) * len2;
            }
          }
        }
        break;
      }

      case 'TANGENT': {
        // Line tangent to circle / arc
        const [lineId, circleId] = constraint.entityIds;
        const line = sketch.entities[lineId] as SketchLine2D;
        const circle = sketch.entities[circleId] as SketchCircle2D || sketch.entities[circleId] as SketchArc2D;

        if (line && circle) {
          const center = sketch.entities[circle.centerPointId] as SketchPoint2D;
          const p1 = sketch.entities[line.startPointId] as SketchPoint2D;
          const p2 = sketch.entities[line.endPointId] as SketchPoint2D;

          if (center && p1 && p2) {
            // Distance from center to line
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len > 1e-6) {
              const signedDist = ((dy * center.x - dx * center.y + p2.x * p1.y - p2.y * p1.x) / len);
              const dist = Math.abs(signedDist);
              residual = Math.abs(dist - circle.radius);

              // Shift line towards tangency (move towards center when dist > radius)
              const sign = signedDist >= 0 ? 1 : -1;
              const err = (dist - circle.radius) * sign;
              const perpX = -dy / len;
              const perpY = dx / len;

              if (!p1.isFixed && !p2.isFixed) {
                p1.x -= perpX * err * 0.5;
                p1.y -= perpY * err * 0.5;
                p2.x -= perpX * err * 0.5;
                p2.y -= perpY * err * 0.5;
              } else if (!p2.isFixed) {
                p2.x -= perpX * err;
                p2.y -= perpY * err;
              } else if (!p1.isFixed) {
                p1.x -= perpX * err;
                p1.y -= perpY * err;
              }
            }
          }
        }
        break;
      }

      case 'CONCENTRIC': {
        // Circle/Arc 1 center = Circle/Arc 2 center
        const [c1Id, c2Id] = constraint.entityIds;
        const c1 = sketch.entities[c1Id] as SketchCircle2D || sketch.entities[c1Id] as SketchArc2D;
        const c2 = sketch.entities[c2Id] as SketchCircle2D || sketch.entities[c2Id] as SketchArc2D;

        if (c1 && c2) {
          const p1 = sketch.entities[c1.centerPointId] as SketchPoint2D;
          const p2 = sketch.entities[c2.centerPointId] as SketchPoint2D;
          if (p1 && p2) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            residual = Math.hypot(dx, dy);
            if (!p2.isFixed) {
              p2.x = p1.x;
              p2.y = p1.y;
            }
          }
        }
        break;
      }

      case 'EQUAL': {
        // Equal length or equal radius
        const [e1Id, e2Id] = constraint.entityIds;
        const e1 = sketch.entities[e1Id];
        const e2 = sketch.entities[e2Id];

        if (e1 && e2) {
          if (e1.type === 'CIRCLE' && e2.type === 'CIRCLE') {
            residual = Math.abs(e1.radius - e2.radius);
            e2.radius = e1.radius;
          } else if (e1.type === 'LINE' && e2.type === 'LINE') {
            const p1a = sketch.entities[e1.startPointId] as SketchPoint2D;
            const p1b = sketch.entities[e1.endPointId] as SketchPoint2D;
            const p2a = sketch.entities[e2.startPointId] as SketchPoint2D;
            const p2b = sketch.entities[e2.endPointId] as SketchPoint2D;

            if (p1a && p1b && p2a && p2b) {
              const len1 = Math.hypot(p1b.x - p1a.x, p1b.y - p1a.y);
              const len2 = Math.hypot(p2b.x - p2a.x, p2b.y - p2a.y);
              residual = Math.abs(len1 - len2);

              const angle2 = Math.atan2(p2b.y - p2a.y, p2b.x - p2a.x);
              if (!p2b.isFixed) {
                p2b.x = p2a.x + Math.cos(angle2) * len1;
                p2b.y = p2a.y + Math.sin(angle2) * len1;
              }
            }
          }
        }
        break;
      }

      case 'SYMMETRIC': {
        // Points p1 and p2 symmetric across line or point
        const [p1Id, p2Id, symLineId] = constraint.entityIds;
        const p1 = sketch.entities[p1Id] as SketchPoint2D;
        const p2 = sketch.entities[p2Id] as SketchPoint2D;
        const symLine = sketch.entities[symLineId] as SketchLine2D;

        if (p1 && p2 && symLine) {
          // Force p2.y = -p1.y (for horizontal axis)
          const expectedY = -p1.y;
          residual = Math.abs(p2.y - expectedY);
          if (!p2.isFixed) {
            p2.y = expectedY;
          }
        }
        break;
      }

      case 'DISTANCE': {
        const points = this.getConstraintPoints(sketch, constraint);
        if (points.length >= 2) {
          const [p1, p2] = points;
          const currentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const targetDist = val !== undefined ? val : currentDist;

          residual = Math.abs(currentDist - targetDist);
          if (currentDist > 1e-6) {
            const scale = targetDist / currentDist;
            const dx = (p2.x - p1.x) * (scale - 1);
            const dy = (p2.y - p1.y) * (scale - 1);

            if (!p1.isFixed && !p2.isFixed) {
              p1.x -= dx * 0.5;
              p1.y -= dy * 0.5;
              p2.x += dx * 0.5;
              p2.y += dy * 0.5;
            } else if (!p2.isFixed) {
              p2.x += dx;
              p2.y += dy;
            } else if (!p1.isFixed) {
              p1.x -= dx;
              p1.y -= dy;
            }
          }
        }
        break;
      }

      case 'ANGLE': {
        const [l1Id, l2Id] = constraint.entityIds;
        const l1 = sketch.entities[l1Id] as SketchLine2D;
        const l2 = sketch.entities[l2Id] as SketchLine2D;

        if (l1 && l2) {
          const p1a = sketch.entities[l1.startPointId] as SketchPoint2D;
          const p1b = sketch.entities[l1.endPointId] as SketchPoint2D;
          const p2a = sketch.entities[l2.startPointId] as SketchPoint2D;
          const p2b = sketch.entities[l2.endPointId] as SketchPoint2D;

          if (p1a && p1b && p2a && p2b) {
            const targetRad = (val !== undefined ? val : 90) * (Math.PI / 180);
            const angle1 = Math.atan2(p1b.y - p1a.y, p1b.x - p1a.x);
            const targetAngle2 = angle1 + targetRad;
            const currentAngle2 = Math.atan2(p2b.y - p2a.y, p2b.x - p2a.x);

            residual = Math.abs(currentAngle2 - targetAngle2);
            const len2 = Math.hypot(p2b.x - p2a.x, p2b.y - p2a.y);
            if (!p2b.isFixed) {
              p2b.x = p2a.x + Math.cos(targetAngle2) * len2;
              p2b.y = p2a.y + Math.sin(targetAngle2) * len2;
            }
          }
        }
        break;
      }

      case 'RADIUS': {
        const [cId] = constraint.entityIds;
        const circle = sketch.entities[cId] as SketchCircle2D || sketch.entities[cId] as SketchArc2D;
        if (circle && val !== undefined) {
          residual = Math.abs(circle.radius - val);
          circle.radius = val;
        }
        break;
      }

      case 'DIAMETER': {
        const [cId] = constraint.entityIds;
        const circle = sketch.entities[cId] as SketchCircle2D || sketch.entities[cId] as SketchArc2D;
        if (circle && val !== undefined) {
          const targetRad = val / 2;
          residual = Math.abs(circle.radius - targetRad);
          circle.radius = targetRad;
        }
        break;
      }
    }

    return residual;
  }

  private getConstraintValue(c: IndustrialSketchConstraint): number | undefined {
    if (c.value !== undefined) {
      if (c.unit) {
        try {
          return UnitEngine.convert(c.value, c.unit, 'mm');
        } catch {
          return c.value;
        }
      }
      return c.value;
    }
    if (c.expression) {
      const num = parseFloat(c.expression);
      if (!isNaN(num)) return num;
    }
    return undefined;
  }

  private getPoint(sketch: IndustrialSketchDefinition, pointId: string): SketchPoint2D | undefined {
    return sketch.entities[pointId] as SketchPoint2D;
  }

  private getConstraintPoints(
    sketch: IndustrialSketchDefinition,
    constraint: IndustrialSketchConstraint
  ): SketchPoint2D[] {
    const points: SketchPoint2D[] = [];

    for (const id of constraint.entityIds) {
      const ent = sketch.entities[id];
      if (ent && ent.type === 'POINT') {
        points.push(ent as SketchPoint2D);
      } else if (ent && ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        const p1 = sketch.entities[line.startPointId] as SketchPoint2D;
        const p2 = sketch.entities[line.endPointId] as SketchPoint2D;
        if (p1) points.push(p1);
        if (p2) points.push(p2);
      } else if (ent && (ent.type === 'CIRCLE' || ent.type === 'ARC')) {
        const center = sketch.entities[(ent as any).centerPointId] as SketchPoint2D;
        if (center) points.push(center);
      }
    }

    return points;
  }
}
