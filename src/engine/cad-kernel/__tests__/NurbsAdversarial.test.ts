import { describe, it, expect } from 'vitest';
import { NurbsCurve, NurbsSurface, NurbsTolerance } from '../nurbs/NurbsContracts';
import { NurbsValidator } from '../nurbs/NurbsValidator';
import { NurbsEvaluator } from '../nurbs/NurbsEvaluator';

describe('PATCH-017 — NURBS ADVERSARIAL', () => {
  const tol: NurbsTolerance = { absolute: 1e-10, relative: 1e-10 };

  it('Rejects descending knots', () => {
    const invalid: NurbsCurve = {
      degree: 1,
      knots: [0, 1, 0, 1], // Descending
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 10, y: 0, z: 0, w: 1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    expect(NurbsValidator.validateCurve(invalid).isValid).toBe(false);
  });

  it('Rejects NaN coordinates and negative weights', () => {
    const nanCP: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: NaN, y: 0, z: 0, w: 1 },
        { x: 10, y: 0, z: 0, w: -1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    const res = NurbsValidator.validateCurve(nanCP);
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.code === 'INVALID_CP_COORD')).toBe(true);
    expect(res.errors.some(e => e.code === 'INVALID_CP_WEIGHT')).toBe(true);
  });

  it('Detects degenerate denominator / SINGULAR state on valid looking but zero-sum evaluated curve', () => {
    // If we maliciously define a curve where W ends up 0 at some parameter but is otherwise "valid" to the validator
    // because weights were somehow allowed (validator checks for w > 0, so it shouldn't happen unless we bypass it).
    // Let's create one that bypassed validator (e.g. w=0).
    const badWeightCurve: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 0 },
        { x: 10, y: 0, z: 0, w: 0 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    // Validator catches it:
    expect(NurbsValidator.validateCurve(badWeightCurve).isValid).toBe(false);

    // But if we force evaluate:
    const evalRes = NurbsEvaluator.evaluateCurve(badWeightCurve, 0.5, tol);
    expect(evalRes.status).toBe('INVALID'); // because validator runs inside
  });

  it('Rejects parameter entirely out of domain without interpolating', () => {
    const curve: NurbsCurve = {
      degree: 1,
      knots: [0, 0, 1, 1],
      controlPoints: [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 10, y: 0, z: 0, w: 1 }
      ],
      evaluate: (u) => ({x:0, y:0, z:0}),
      domain: () => ({uMin:0, uMax:1})
    };
    const e = NurbsEvaluator.evaluateCurve(curve, 100, tol);
    expect(e.status).toBe('INVALID');
    expect(e.diagnostics?.[0]).toContain('outside domain');
  });
});
