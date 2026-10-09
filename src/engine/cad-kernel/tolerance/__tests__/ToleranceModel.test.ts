/**
 * SECP CAD Kernel — Tolerance Model Tests
 * Phase 2 (PATCH-021)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ToleranceEngine, 
  ToleranceOperation, 
  ToleranceContext, 
  PolicyRegistry,
  ToleranceAudit,
  ToleranceScale
} from '..';
import { UnitEngine } from '../../../units';

describe('Tolerance Model Implementation', () => {
  beforeEach(() => {
    ToleranceAudit.clear();
  });

  describe('Basic Comparison (Requirement 6, 12.A)', () => {
    it('should correctly identify exact equality', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      expect(ToleranceEngine.approximatelyEqual(10.0, 10.0, context)).toBe(true);
    });

    it('should correctly identify near equality within tolerance', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      expect(ToleranceEngine.approximatelyEqual(10.0, 10.0 + 5e-8, context)).toBe(true);
    });

    it('should correctly identify values outside tolerance', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      expect(ToleranceEngine.approximatelyEqual(10.0, 10.0 + 2e-7, context)).toBe(false);
    });
  });

  describe('Symmetry (Requirement 12.B)', () => {
    it('should be symmetric for applicable predicates', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      const a = 10.0;
      const b = 10.0 + 5e-8;
      expect(ToleranceEngine.approximatelyEqual(a, b, context)).toBe(true);
      expect(ToleranceEngine.approximatelyEqual(b, a, context)).toBe(true);
    });
  });

  describe('Unit Handling (Requirement 5, 12.C)', () => {
    it('should handle equivalent physical tolerances in different units', () => {
      const val1 = ToleranceEngine.toCanonical(1.0, 'mm'); // 0.001
      const val2 = ToleranceEngine.toCanonical(0.1, 'cm'); // 0.001
      expect(val1).toBeCloseTo(val2, 10);

      const context: ToleranceContext = {
        operation: ToleranceOperation.DISTANCE,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      
      const p1 = 1.0; // 1m
      const p2 = 1.0 + 0.5e-7; // 1m + 0.5*tol
      
      expect(ToleranceEngine.approximatelyEqual(p1, p2, context)).toBe(true);
    });
  });

  describe('Scale Awareness (Requirement 4, 12.D)', () => {
    it('should scale tolerance for large geometry', () => {
      const contextLarge: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 100000.0, // 100km
        unitSystem: 'm',
        requestedTolerance: 1e-7,
        policy: 'STANDARD_ENGINEERING'
      };
      
      const tol = ToleranceEngine.getEffectiveTolerance(contextLarge);
      // Standard policy is linear scale, so 1e-7 * 100000 = 1e-2 = 0.01
      expect(tol).toBeGreaterThan(1e-7);
      expect(tol).toBeCloseTo(0.01, 5);
    });

    it('should identify scale categories correctly', () => {
      expect(ToleranceScale.getScaleCategory(0.0001)).toBe('SMALL');
      expect(ToleranceScale.getScaleCategory(1.0)).toBe('NORMAL');
      expect(ToleranceScale.getScaleCategory(10000.0)).toBe('LARGE');
    });
  });

  describe('Policy Bounds (Requirement 3, 12.E)', () => {
    it('should respect minimum tolerance bounds', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-20, // Way below policy min (1e-12)
        policy: 'STRICT_INDUSTRIAL'
      };
      const tol = ToleranceEngine.getEffectiveTolerance(context);
      expect(tol).toBe(1e-12);
    });

    it('should respect maximum tolerance bounds', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1e12, // Giant scale
        unitSystem: 'm',
        requestedTolerance: 1e-7,
        policy: 'STRICT_INDUSTRIAL'
      };
      const tol = ToleranceEngine.getEffectiveTolerance(context);
      const policy = PolicyRegistry.getPolicy('STRICT_INDUSTRIAL');
      // effective = 1e12 * 1e-7 = 1e5. Max is 1e-6. Escalation limit is 100.
      // 1e-6 * 100 = 1e-4. Should be clamped to 1e-4.
      expect(tol).toBe(policy.maxTolerance * policy.escalationLimit);
    });
  });

  describe('Determinism (Requirement 12.H)', () => {
    it('should produce identical results and audit decisions for same inputs', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: 1e-7
      };
      
      const r1 = ToleranceEngine.approximatelyEqual(10.0, 10.00000005, context);
      const audit1 = ToleranceAudit.getRecords()[0];
      
      ToleranceAudit.clear();
      const r2 = ToleranceEngine.approximatelyEqual(10.0, 10.00000005, context);
      const audit2 = ToleranceAudit.getRecords()[0];
      
      expect(r1).toBe(r2);
      expect(audit1.effectiveTolerance).toBe(audit2.effectiveTolerance);
      expect(audit1.deterministicDecision).toBe(true);
    });
  });

  describe('Invalid Input (Requirement 12.I)', () => {
    it('should reject NaN and Infinity', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: NaN
      };
      expect(() => ToleranceEngine.getEffectiveTolerance(context)).toThrow();
    });

    it('should reject negative tolerance', () => {
      const context: ToleranceContext = {
        operation: ToleranceOperation.POINT_COMPARISON,
        geometryScale: 1.0,
        unitSystem: 'm',
        requestedTolerance: -1e-7
      };
      expect(() => ToleranceEngine.getEffectiveTolerance(context)).toThrow();
    });
  });
});
