/**
 * SECP CAD Kernel — Tolerance Model
 * Phase 2 (PATCH-021)
 */

import { ToleranceContext, ToleranceOperation } from './ToleranceContext';
import { TolerancePolicy, PolicyRegistry } from './TolerancePolicy';
import { ToleranceScale } from './ToleranceScale';
import { ToleranceAudit } from './ToleranceAudit';
import { UnitEngine } from '../../units';

export interface ToleranceModel {
  linear: number;
  angular: number;
  parametric: number;
  distance: number;
  coincidence: number;
  topology: number;
  sewing: number;
  boolean: number;
  approximation: number;

  unitSystem: string;
  scale: number;
  policyId: string;
  version: string;
}

export class ToleranceEngine {
  private static readonly VERSION = '1.0.0';

  /**
   * Deterministic approximately equal primitive.
   */
  public static approximatelyEqual(a: number, b: number, context: ToleranceContext): boolean {
    const diff = Math.abs(a - b);
    const tol = this.getEffectiveTolerance(context);
    
    const result = diff <= tol;
    
    ToleranceAudit.record({
      operation: context.operation,
      inputScale: context.geometryScale,
      unit: context.unitSystem,
      requestedTolerance: context.requestedTolerance,
      effectiveTolerance: tol,
      policyId: context.policy || 'DEFAULT',
      escalation: false,
      reason: 'Standard comparison',
      deterministicDecision: true
    });

    return result;
  }

  /**
   * Coincidence check for points.
   */
  public static pointsCoincident(p1: {x: number, y: number, z: number}, p2: {x: number, y: number, z: number}, context: ToleranceContext): boolean {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    const distSq = dx*dx + dy*dy + dz*dz;
    const tol = this.getEffectiveTolerance(context);
    
    return distSq <= tol * tol;
  }

  /**
   * Logic for obtaining the effective tolerance, considering policy and scale.
   */
  public static getEffectiveTolerance(context: ToleranceContext): number {
    if (!Number.isFinite(context.requestedTolerance) || context.requestedTolerance < 0) {
      throw new Error(`Invalid requested tolerance: ${context.requestedTolerance}`);
    }

    const policy = PolicyRegistry.getPolicy(context.policy || 'STRICT_INDUSTRIAL');
    
    // Check if operation is allowed
    if (!policy.allowedOperations.includes(context.operation)) {
       throw new Error(`Operation ${context.operation} not allowed by policy ${policy.id}`);
    }

    let effective = ToleranceScale.calculate(context.requestedTolerance, context.geometryScale, policy);

    // Escalation check
    if (effective > policy.maxTolerance) {
      if (policy.escalationPermitted) {
        const limit = policy.maxTolerance * policy.escalationLimit;
        if (effective > limit) {
          // Beyond escalation limit
          effective = limit; // Clamp to limit but keep record
        }
      } else {
        effective = policy.maxTolerance;
      }
    }

    return effective;
  }

  /**
   * Utility to wrap a value with unit awareness.
   */
  public static toCanonical(value: number, unit: string): number {
    return UnitEngine.toCanonical(value, unit).value;
  }
}
