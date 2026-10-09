/**
 * SECP CAD Kernel — GCS Constraint Solver
 * Phase 2 (PATCH-025)
 */

import { SketchModel } from '../SketchModel';
import { SketchConstraint } from './ConstraintModel';
import { SolverResult, SolverStatus, SolverTerminationReason } from './SolverResult';
import { ConstraintSystem } from './ConstraintSystem';
import { ConstraintEvaluator } from './ConstraintEvaluator';
import { DegreeOfFreedomAnalyzer } from './DegreeOfFreedomAnalyzer';
import { LinearAlgebra } from './LinearAlgebra';
import { LineGeometry } from '../SketchLine';

export class ConstraintSolver {
  public static solve(
    sketch: SketchModel,
    constraints: readonly SketchConstraint[],
    options: any = {}
  ): SolverResult {
    // Escape zero-length/degenerate line singularities by slightly perturbing identical endpoints
    const sanitizedEntities = sketch.entities.map(entity => {
      if (entity.type === 'LINE' && 'start' in entity.geometry && 'end' in entity.geometry) {
        const geom = entity.geometry as LineGeometry;
        const dx = geom.end.x - geom.start.x;
        const dy = geom.end.y - geom.start.y;
        if (dx * dx + dy * dy < 1e-10) {
          return {
            ...entity,
            geometry: {
              ...geom,
              end: {
                x: geom.start.x + 0.1,
                y: geom.start.y + 0.1
              }
            }
          };
        }
      }
      return entity;
    });

    const sanitizedSketch = {
      ...sketch,
      entities: sanitizedEntities as any
    };

    const system = new ConstraintSystem(sanitizedSketch);
    const initialVector = system.getVector();
    const n = system.getDimension();
    const tol = sketch.tolerance?.parametric ?? 1e-7;

    // If n === 0, we can just return a converged result
    if (n === 0) {
      const dofReport = DegreeOfFreedomAnalyzer.analyze(sketch, constraints, 0, tol);
      return {
        status: 'CONVERGED',
        solvedSketch: sketch,
        iterations: 0,
        initialResidualNorm: 0,
        finalResidualNorm: 0,
        maximumResidual: 0,
        residuals: [],
        dof: dofReport,
        diagnostics: [],
        terminationReason: 'CONVERGED'
      };
    }

    // Numerical solver using Levenberg-Marquardt
    // to minimize the sum of squared residuals: E(x) = 0.5 * sum(r_i^2)
    let currentVector = [...initialVector];
    
    const evaluateLoss = (vector: number[]): { loss: number; residuals: number[]; maxResidual: number } => {
      system.updateFromVector(vector);
      const residuals = ConstraintEvaluator.evaluate(system, constraints);
      let sumSq = 0;
      let maxRes = 0;
      for (const r of residuals) {
        if (!Number.isFinite(r)) {
          return { loss: Infinity, residuals, maxResidual: Infinity };
        }
        sumSq += r * r;
        const absR = Math.abs(r);
        if (absR > maxRes) {
          maxRes = absR;
        }
      }
      return { loss: 0.5 * sumSq, residuals, maxResidual: maxRes };
    };

    const initialEval = evaluateLoss(initialVector);
    let currentLoss = initialEval.loss;
    let maxResidual = initialEval.maxResidual;
    let residuals = initialEval.residuals;

    const maxIterations = 200;
    let iterations = 0;
    let converged = Number.isFinite(maxResidual) && maxResidual < tol;

    if (!converged) {
      let lambda = 1e-3; // Initial LM damping factor
      for (iterations = 1; iterations <= maxIterations; iterations++) {
        // Compute Jacobian numerically
        const { jacobian: J } = DegreeOfFreedomAnalyzer.computeJacobian(system, constraints, currentVector);
        const JtJ = LinearAlgebra.multiplyAtA(J);
        // We want to solve (J^T J + lambda I) \Delta x = -J^T r
        const Jtr = LinearAlgebra.multiplyAtb(J, residuals);
        const rhs = Jtr.map(v => -v);

        let stepAccepted = false;
        let delta = new Array(n).fill(0);
        
        while (!stepAccepted && lambda < 1e9) {
          const JtJ_damped = LinearAlgebra.addDiagonal(JtJ, lambda);
          try {
            delta = LinearAlgebra.solve(JtJ_damped, rhs);
          } catch (e) {
            // Singular, increase damping
            lambda *= 10;
            continue;
          }

          const nextVector = currentVector.map((v, i) => v + delta[i]);
          const nextEval = evaluateLoss(nextVector);

          if (Number.isFinite(nextEval.loss) && nextEval.loss < currentLoss) {
            // Step accepted
            currentVector = nextVector;
            currentLoss = nextEval.loss;
            residuals = nextEval.residuals;
            maxResidual = nextEval.maxResidual;
            lambda = Math.max(1e-7, lambda / 10);
            stepAccepted = true;
          } else {
            // Step rejected, increase damping
            lambda *= 10;
          }
        }
        
        if (!stepAccepted) {
           break; // Cannot improve further
        }

        if (Number.isFinite(maxResidual) && maxResidual < tol) {
          converged = true;
          break;
        }
      }
    }

    // Set updated values on the system
    system.updateFromVector(currentVector);
    const solvedSketch = this.updateSketchModel(sanitizedSketch, system);
    const dofReport = DegreeOfFreedomAnalyzer.analyze(solvedSketch, constraints, maxResidual, tol);

    const isFiniteResidual = Number.isFinite(maxResidual);
    const status: SolverStatus = (converged && isFiniteResidual) ? 'CONVERGED' : 'NOT_CONVERGED';

    const terminationReason: SolverTerminationReason = status === 'CONVERGED' ? 'CONVERGED' : 'MAX_ITERATIONS';

    return {
      status,
      solvedSketch,
      iterations,
      initialResidualNorm: initialEval.loss,
      finalResidualNorm: currentLoss,
      maximumResidual: maxResidual,
      residuals,
      dof: dofReport,
      diagnostics: [],
      terminationReason
    };
  }

  private static updateSketchModel(sketch: SketchModel, system: ConstraintSystem): SketchModel {
    const updatedEntities = sketch.entities.map(entity => {
      const id = entity.id.projectId;
      const geom = entity.geometry;

      switch (geom.type) {
        case 'POINT':
          return {
            ...entity,
            geometry: {
              ...geom,
              x: system.getParamValue(id, 'x'),
              y: system.getParamValue(id, 'y')
            }
          };
        case 'LINE':
          return {
            ...entity,
            geometry: {
              ...geom,
              start: {
                x: system.getParamValue(id, 'x1'),
                y: system.getParamValue(id, 'y1')
              },
              end: {
                x: system.getParamValue(id, 'x2'),
                y: system.getParamValue(id, 'y2')
              }
            }
          };
        case 'CIRCLE':
          return {
            ...entity,
            geometry: {
              ...geom,
              center: {
                x: system.getParamValue(id, 'cx'),
                y: system.getParamValue(id, 'cy')
              },
              radius: system.getParamValue(id, 'r')
            }
          };
        case 'ARC':
          return {
            ...entity,
            geometry: {
              ...geom,
              center: {
                x: system.getParamValue(id, 'cx'),
                y: system.getParamValue(id, 'cy')
              },
              radius: system.getParamValue(id, 'r'),
              startAngle: system.getParamValue(id, 'startAngle'),
              endAngle: system.getParamValue(id, 'endAngle')
            }
          };
        default:
          return entity;
      }
    });

    return {
      ...sketch,
      entities: updatedEntities as any
    };
  }

  public static drag(
    sketch: SketchModel,
    constraints: readonly SketchConstraint[],
    entityId: string,
    position: { x: number; y: number },
    options: any = {}
  ): SolverResult {
    return this.solve(sketch, constraints, options);
  }
}
