/**
 * SECP CAD Kernel — Tolerance Model Adversarial Tests
 * Phase 2 (PATCH-021)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ToleranceEngine, 
  ToleranceOperation, 
  ToleranceContext, 
  PolicyRegistry,
  ToleranceAudit
} from '..';

describe('Tolerance Model Adversarial Tests', () => {
  beforeEach(() => {
    ToleranceAudit.clear();
  });

  it('should correctly handle geometry separated by JUST BELOW tolerance', () => {
    const tol = 1e-7;
    const context: ToleranceContext = {
      operation: ToleranceOperation.DISTANCE,
      geometryScale: 1.0,
      unitSystem: 'm',
      requestedTolerance: tol
    };
    
    // We use a value we know is slightly less than tol
    const separation = tol * 0.999999;
    expect(ToleranceEngine.approximatelyEqual(0, separation, context)).toBe(true);
  });

  it('should correctly handle geometry separated by JUST ABOVE tolerance', () => {
    const tol = 1e-7;
    const context: ToleranceContext = {
      operation: ToleranceOperation.DISTANCE,
      geometryScale: 1.0,
      unitSystem: 'm',
      requestedTolerance: tol
    };
    
    // We use a value we know is slightly more than tol
    const separation = tol * 1.000001;
    expect(ToleranceEngine.approximatelyEqual(0, separation, context)).toBe(false);
  });

  it('should reject NaN propagation in coordinates', () => {
    const context: ToleranceContext = {
      operation: ToleranceOperation.POINT_COMPARISON,
      geometryScale: 1.0,
      unitSystem: 'm',
      requestedTolerance: 1e-7
    };
    
    expect(ToleranceEngine.approximatelyEqual(NaN, 10.0, context)).toBe(false);
    expect(ToleranceEngine.approximatelyEqual(10.0, Infinity, context)).toBe(false);
  });

  it('should prevent escalation from exceeding policy maximum', () => {
    const policy = PolicyRegistry.getPolicy('STRICT_INDUSTRIAL');
    const extremeScale = 1e20; // Massive scale
    
    const context: ToleranceContext = {
      operation: ToleranceOperation.BOOLEAN,
      geometryScale: extremeScale,
      unitSystem: 'm',
      requestedTolerance: 1e-7,
      policy: 'STRICT_INDUSTRIAL'
    };
    
    const effective = ToleranceEngine.getEffectiveTolerance(context);
    const limit = policy.maxTolerance * policy.escalationLimit;
    
    expect(effective).toBeLessThanOrEqual(limit);
    expect(effective).toBeCloseTo(1e-4, 10); // 1e-6 * 100
  });

  it('should handle extremely small geometry scale', () => {
    const context: ToleranceContext = {
      operation: ToleranceOperation.DISTANCE,
      geometryScale: 1e-15, // Atomic scale
      unitSystem: 'm',
      requestedTolerance: 1e-7,
      policy: 'STRICT_INDUSTRIAL'
    };
    
    const effective = ToleranceEngine.getEffectiveTolerance(context);
    const policy = PolicyRegistry.getPolicy('STRICT_INDUSTRIAL');
    
    // Linear scale: 1e-15 * 1e-7 = 1e-22. Clamped to min 1e-12.
    expect(effective).toBe(policy.minTolerance);
  });
});
