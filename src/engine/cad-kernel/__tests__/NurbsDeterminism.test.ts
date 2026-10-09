import { describe, it, expect } from 'vitest';
import { NurbsCurve, NurbsTolerance } from '../nurbs/NurbsContracts';
import { NurbsEvaluator } from '../nurbs/NurbsEvaluator';

describe('PATCH-017 — NURBS DETERMINISM', () => {
  const tol: NurbsTolerance = { absolute: 1e-10, relative: 1e-10 };

  const validLine: NurbsCurve = {
    degree: 1,
    knots: [0, 0, 1, 1],
    controlPoints: [
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 10, y: 0, z: 0, w: 1 }
    ],
    evaluate: (u) => ({x:0, y:0, z:0}),
    domain: () => ({uMin:0, uMax:1})
  };

  it('Evaluations are strictly deterministic (No Date.now() or Math.random() interference)', () => {
    const e1 = NurbsEvaluator.evaluateCurve(validLine, 0.333, tol);
    
    // Simulate some time passage/other code running
    const uselessMath = Math.random();
    
    const e2 = NurbsEvaluator.evaluateCurve(validLine, 0.333, tol);

    expect(e1.point.x).toBe(e2.point.x);
    expect(e1.point.y).toBe(e2.point.y);
    expect(e1.point.z).toBe(e2.point.z);
    expect(e1.denominator).toBe(e2.denominator);
  });
});
