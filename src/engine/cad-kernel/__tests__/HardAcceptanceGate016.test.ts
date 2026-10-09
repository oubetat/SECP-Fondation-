import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate016 } from '../brep/HardAcceptanceGate016';

describe('PATCH-016 — HardAcceptanceGate016', () => {
  it('evaluates to PASS', () => {
    const res = HardAcceptanceGate016.evaluate();
    expect(res.verdict).toBe('PASS');
    expect(res.checks.detectsNonManifold).toBe(true);
    expect(res.checks.rejectsOpenSolid).toBe(true);
    expect(res.checks.rejectsDuplicateVertexIds).toBe(true);
  });
});
