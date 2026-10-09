/**
 * SECP CAD Kernel — Boolean Regression Test Suite
 * PATCH-KERNEL-010 — Transitioning bypasses to regression cases.
 */
import { describe, it, expect } from 'vitest';
import { BooleanEngine } from '../boolean/BooleanEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { TopoShapeEnum } from '../topology/TopologyContracts';

describe('PATCH-KERNEL-010 — Boolean Regression Cases', () => {

  it('REG-01: Non-manifold tangent edge contact (Former CASE_B02 Bypass)', () => {
    // Two boxes touching along an edge (0, 10, Z) to (10, 10, Z)
    const boxA = BoxFactory.createBox('box_tan_e1', 0, 0, 0, 10, 10, 10);
    const boxB = BoxFactory.createBox('box_tan_e2', 10, 10, 0, 20, 20, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    
    // Now that the bypass is removed, this must be solved by the real Boolean engine.
    // If the engine isn't ready for non-manifold edge contact, it might return SUCCESS (compound) or FAIL.
    // The user wants to see it pass BRepValidator.
    expect(res.status).toBe('SUCCESS');
    expect(res.validation.status).toBe('VALID');
  });

  it('REG-02: Near-degenerate micro-sliver solids (Former CASE_D03 Bypass)', () => {
    // One box is extremely thin (0.00001 mm)
    const boxA = BoxFactory.createBox('box_thin_1', 0, 0, 0, 5, 10, 1e-5);
    const boxB = BoxFactory.createBox('box_thin_2', 0, 0, 0, 5, 10, 10);

    const res = BooleanEngine.execute('UNION', boxA, boxB);
    
    expect(res.status).toBe('SUCCESS');
    expect(res.validation.status).toBe('VALID');
  });

});
