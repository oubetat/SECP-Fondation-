/**
 * SECP CAD Kernel — Centralized Tolerance Governance for Healing
 * Phase 2 (PATCH-020)
 */

import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { TolerancePolicyReference } from './HealingTypes';
import { Point } from '../geometry/GeometryContracts';

export class ToleranceHealing {
  public static getPolicyReference(model: GeometricToleranceModel = GeometricTolerance.DEFAULT): TolerancePolicyReference {
    return {
      policyName: 'Canonical SECP Tolerance Policy v2',
      linearTolerance: model.absoluteLength,
      angularTolerance: model.angularRad,
      coincidentalTolerance: model.absoluteLength,
      model: 'GeometricTolerance.DEFAULT'
    };
  }

  public static arePointsCoincident(
    p1: Point,
    p2: Point,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    return distSq <= model.absoluteLength * model.absoluteLength;
  }

  public static distance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static isWithinHealingTolerance(
    dist: number,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): boolean {
    return dist <= model.absoluteLength * 10;
  }
}
