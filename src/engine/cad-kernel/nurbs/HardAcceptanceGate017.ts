import { NurbsCurve, NurbsSurface, NurbsTolerance } from './NurbsContracts';
import { NurbsValidator } from './NurbsValidator';
import { NurbsEvaluator } from './NurbsEvaluator';
import { NurbsKnotInsertion } from './NurbsKnotInsertion';
import { NurbsBasis } from './NurbsBasis';

export class HardAcceptanceGate017 {
  public static evaluate(): { verdict: string, checks: Record<string, boolean> } {
    const checks: Record<string, boolean> = {};
    const tol: NurbsTolerance = { absolute: 1e-10, relative: 1e-10 };

    // 1 & 3: Valid curve and knot vector validation
    const lineCurve: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 10, y: 0, z: 0, w: 1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    checks['curveValidation'] = NurbsValidator.validateCurve(lineCurve).isValid;

    const invalidCurve: NurbsCurve = {
      degree: 1,
      knots: [0, 1, 0, 1], // descending
      controlPoints: lineCurve.controlPoints,
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    checks['descendingKnotRejection'] = !NurbsValidator.validateCurve(invalidCurve).isValid;

    // 4 & 5: Basis evaluation and partition of unity
    const span = NurbsBasis.findKnotSpan(0.5, 1, lineCurve.knots, tol);
    const N = NurbsBasis.evaluateBasisFunctions(span, 0.5, 1, lineCurve.knots);
    const sumN = N.reduce((a, b) => a + b, 0);
    checks['partitionOfUnity'] = Math.abs(sumN - 1.0) < tol.absolute;

    // 6 & 8 & 11: Curve analytical evaluation and determinism
    const evalA = NurbsEvaluator.evaluateCurve(lineCurve, 0.5, tol);
    const evalB = NurbsEvaluator.evaluateCurve(lineCurve, 0.5, tol);
    checks['curveEvaluationOk'] = evalA.status === 'OK' && Math.abs(evalA.point.x - 5.0) < tol.absolute;
    checks['curveEvaluationDeterministic'] = evalA.point.x === evalB.point.x && evalA.point.y === evalB.point.y;

    // 10: Degeneracy detection
    const degenCurve: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 0 },
        { x: 10, y: 0, z: 0, w: 0 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    // validator should reject w=0
    checks['degenerateWeightRejected'] = !NurbsValidator.validateCurve(degenCurve).isValid;

    // 2 & 7: Surface evaluation
    const planarSurface: NurbsSurface = {
      degreeU: 1,
      degreeV: 1,
      knotsU: [0, 0, 1, 1],
      knotsV: [0, 0, 1, 1],
      controlPoints: [
        [ { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 10, z: 0, w: 1 } ],
        [ { x: 10, y: 0, z: 0, w: 1 }, { x: 10, y: 10, z: 0, w: 1 } ]
      ],
      evaluate: (u, v) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1, vMin:0, vMax:1})
    };
    checks['surfaceValidation'] = NurbsValidator.validateSurface(planarSurface).isValid;
    const surfEval = NurbsEvaluator.evaluateSurface(planarSurface, 0.5, 0.5, tol);
    checks['surfaceEvaluationOk'] = surfEval.status === 'OK' && Math.abs(surfEval.point.x - 5.0) < tol.absolute && Math.abs(surfEval.point.y - 5.0) < tol.absolute;

    // 14: Knot insertion
    const inserted = NurbsKnotInsertion.insertKnotCurve(lineCurve, 0.5, 1, tol);
    if (inserted) {
      const insertedEval = NurbsEvaluator.evaluateCurve(inserted, 0.5, tol);
      checks['knotInsertionGeometryPreserved'] = insertedEval.status === 'OK' && Math.abs(insertedEval.point.x - evalA.point.x) < tol.absolute;
    } else {
      checks['knotInsertionGeometryPreserved'] = false; // Expected to pass if implemented
    }

    const allPassed = Object.values(checks).every(c => c === true);
    
    return {
      verdict: allPassed ? 'PASS' : 'FAIL',
      checks
    };
  }
}
