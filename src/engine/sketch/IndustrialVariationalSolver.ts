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

export interface SolveResult {
  sketch: IndustrialSketchDefinition;
  solutionState: SolverSolutionState;
  dofReport: SketchDOFReport;
  causalityReport: ConstraintCausalityReport;
  incrementalStats: IncrementalSolveStats;
  maxResidual: number;
  iterations: number;
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

    if (dofReport.state === 'INCONSISTENT') {
      const solveTimeMs = performance.now() - startTime;
      return {
        sketch,
        solutionState: 'INCONSISTENT',
        dofReport,
        causalityReport,
        incrementalStats: {
          totalConstraints: Object.keys(sketch.constraints).length,
          affectedSubGraphConstraintCount: affectedConstraintCount,
          solveTimeMs,
          isIncremental
        },
        maxResidual: 1e3,
        iterations: 0
      };
    }

    // Variational Relaxation Loop
    let maxResidual = 0;
    let iter = 0;

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

    const solveTimeMs = performance.now() - startTime;
    const finalDOFReport = graphEngine.computeDOFReport();
    const finalCausalityReport = graphEngine.analyzeConstraintCausality();

    let finalState: SolverSolutionState = 'SOLVED';
    if (finalDOFReport.state === 'INCONSISTENT' || finalDOFReport.state === 'OVER_CONSTRAINED') {
      finalState = finalDOFReport.state;
    } else if (finalDOFReport.remainingDegreesOfFreedom > 0) {
      finalState = 'UNDER_CONSTRAINED';
    } else {
      finalState = 'FULLY_CONSTRAINED';
    }

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
      iterations: iter
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
            const num = Math.abs((p2.y - p1.y) * center.x - (p2.x - p1.x) * center.y + p2.x * p1.y - p2.y * p1.x);
            const den = Math.hypot(p2.y - p1.y, p2.x - p1.x);
            const dist = den === 0 ? 0 : num / den;

            residual = Math.abs(dist - circle.radius);
            // Relax circle radius if flexible
            circle.radius = dist;
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
