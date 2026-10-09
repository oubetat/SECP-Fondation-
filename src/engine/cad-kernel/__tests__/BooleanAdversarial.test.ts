/**
 * SECP CAD Kernel — Boolean Adversarial Test Suite
 * Phase 2 (PATCH-019)
 */
import { describe, it, expect } from 'vitest';
import { BooleanEngine } from '../boolean/BooleanEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { TopoShapeEnum } from '../topology/TopologyContracts';

describe('PATCH-019 — Boolean Adversarial Test Suite', () => {

  it('ADV-01: Extremely small gaps (micro-gap near tolerance threshold)', () => {
    const boxA = BoxFactory.createBox('adv_gap_a', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('adv_gap_b', 10 + 1e-8, 0, 0, 20 + 1e-8, 10, 10); // 10 nm gap

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('ADV-02: Extremely small overlaps (micro-overlap near tolerance threshold)', () => {
    const boxA = BoxFactory.createBox('adv_ov_a', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('adv_ov_b', 10 - 1e-8, 0, 0, 20 - 1e-8, 10, 10); // 10 nm overlap

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('ADV-03: Tolerance-boundary cases', () => {
    const boxA = BoxFactory.createBox('adv_tol_a', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('adv_tol_b', 10.0, 0, 0, 20.0, 10, 10);

    const res = BooleanEngine.execute('INTERSECTION', boxA, boxB);
    expect(res.status).toBe('EMPTY_RESULT');
  });

  it('ADV-04: Nearly coincident faces', () => {
    const boxA = BoxFactory.createBox('adv_coin_a', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('adv_coin_b', 1e-7, 1e-7, 1e-7, 10 + 1e-7, 10 + 1e-7, 10 + 1e-7);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    expect(res.status).toBe('SUCCESS');
  });

  it('ADV-05: Zero-volume degenerate box input', () => {
    const boxA = BoxFactory.createBox('adv_deg_a', 0, 0, 0, 10, 10, 10);
    const degen = BoxFactory.createBox('adv_zero_vol', 5, 5, 5, 5, 5, 5); // Zero volume point box

    const res = BooleanEngine.execute('UNION', boxA, degen);
    expect(res.status).toBe('INVALID_INPUT');
  });

  it('ADV-06: Unproven/non-manifold shape handling without fake passes', () => {
    const boxA = BoxFactory.createBox('adv_nm_a', 0, 0, 0, 10, 10, 10);
    const nonManifold: any = {
      id: 'adv_nm_shape',
      shapeType: TopoShapeEnum.COMPOUND,
      shapes: []
    };

    const res = BooleanEngine.execute('DIFFERENCE', boxA, nonManifold);
    expect(res.status).toBe('UNPROVEN');
  });

  it('ADV-07: Pathological domain & coordinate magnitudes', () => {
    const hugeBoxA = BoxFactory.createBox('huge_a', 0, 0, 0, 1e6, 1e6, 1e6);
    const hugeBoxB = BoxFactory.createBox('huge_b', 5e5, 0, 0, 1.5e6, 1e6, 1e6);

    const res = BooleanEngine.execute('UNION', hugeBoxA, hugeBoxB);
    expect(res.status).toBe('SUCCESS');
    expect(res.determinismHash).toHaveLength(64);
  });

});
