import { describe, it, expect } from 'vitest';
import { GaussQuadratureEngine } from '../GaussQuadratureEngine';

describe('GaussQuadratureEngine - FEM Numerical Integration Verification', () => {
  it('TEST 1: Verifies Quad integration points for Order 1 (reduced 1-pt)', () => {
    const pts = GaussQuadratureEngine.getQuadPoints(1);
    expect(pts).toHaveLength(1);
    expect(pts[0].xi).toBe(0);
    expect(pts[0].eta).toBe(0);
    expect(pts[0].weight).toBe(4.0);

    // Integrate constant f(x,y) = 1 over [-1,1]^2 -> Area = 4
    const area = pts.reduce((sum, p) => sum + p.weight, 0);
    expect(area).toBeCloseTo(4.0, 10);
  });

  it('TEST 2: Verifies Quad integration points for Order 2 (standard 2x2 = 4-pt)', () => {
    const pts = GaussQuadratureEngine.getQuadPoints(2);
    expect(pts).toHaveLength(4);
    const sumW = pts.reduce((sum, p) => sum + p.weight, 0);
    expect(sumW).toBeCloseTo(4.0, 10);

    // Integrate polynomial f(xi, eta) = 3*xi^2 + eta^2 over [-1, 1]^2
    // Exact: \int_{-1}^1 \int_{-1}^1 (3*xi^2 + eta^2) dxi deta = 3 * (2/3 * 2) + (2 * 2/3) = 4 + 4/3 = 16/3 = 5.3333333333
    const integral = pts.reduce((sum, p) => sum + (3 * p.xi * p.xi + p.eta * p.eta) * p.weight, 0);
    expect(integral).toBeCloseTo(16.0 / 3.0, 10);
  });

  it('TEST 3: Verifies Quad integration points for Order 3 (high-order 3x3 = 9-pt)', () => {
    const pts = GaussQuadratureEngine.getQuadPoints(3);
    expect(pts).toHaveLength(9);
    const sumW = pts.reduce((sum, p) => sum + p.weight, 0);
    expect(sumW).toBeCloseTo(4.0, 10);

    // Integrate f(xi, eta) = xi^4 * eta^2
    // Exact: (2/5) * (2/3) = 4/15 = 0.2666666667
    const integral = pts.reduce((sum, p) => sum + (Math.pow(p.xi, 4) * Math.pow(p.eta, 2)) * p.weight, 0);
    expect(integral).toBeCloseTo(4.0 / 15.0, 10);
  });

  it('TEST 4: Verifies Hex integration points for Order 1 (reduced 1-pt)', () => {
    const pts = GaussQuadratureEngine.getHexPoints(1);
    expect(pts).toHaveLength(1);
    expect(pts[0].weight).toBe(8.0);
  });

  it('TEST 5: Verifies Hex integration points for Order 2 (standard 2x2x2 = 8-pt)', () => {
    const pts = GaussQuadratureEngine.getHexPoints(2);
    expect(pts).toHaveLength(8);
    const sumW = pts.reduce((sum, p) => sum + p.weight, 0);
    expect(sumW).toBeCloseTo(8.0, 10);

    // Integrate f(xi, eta, zeta) = xi^2 + eta^2 + zeta^2 over [-1,1]^3 -> 3 * (2/3 * 2 * 2) = 8
    const integral = pts.reduce((sum, p) => sum + (p.xi * p.xi + p.eta * p.eta + p.zeta * p.zeta) * p.weight, 0);
    expect(integral).toBeCloseTo(8.0, 10);
  });

  it('TEST 6: Verifies Hex integration points for Order 3 (high-order 3x3x3 = 27-pt)', () => {
    const pts = GaussQuadratureEngine.getHexPoints(3);
    expect(pts).toHaveLength(27);
    const sumW = pts.reduce((sum, p) => sum + p.weight, 0);
    expect(sumW).toBeCloseTo(8.0, 10);
  });

  it('TEST 7: Correctly rejects unsupported orders with descriptive errors', () => {
    expect(() => GaussQuadratureEngine.getQuadPoints(4)).toThrowError(/not supported/);
    expect(() => GaussQuadratureEngine.getHexPoints(5)).toThrowError(/not supported/);
  });
});
