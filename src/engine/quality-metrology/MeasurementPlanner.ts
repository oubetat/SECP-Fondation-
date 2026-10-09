/**
 * PATCH-SECP-061 — Measurement Planner
 * Transforms nominal design CAD feature definitions, tolerances, and topology IDs
 * into deterministic, addressable measurement inspection plans.
 */

import { MeasurementPlan, ToleranceSpecification } from './MetrologyTypes';

export class MeasurementPlanner {
  /**
   * Builds an inspection measurement plan from design features and specifications
   */
  public static createPlan(
    planId: string,
    partId: string,
    partRevision: string,
    specifications: ToleranceSpecification[]
  ): MeasurementPlan {
    const pointsPerFeature: Record<string, number> = {};

    // 061-C Rule: Determine touch-points based on characteristic type
    specifications.forEach(spec => {
      let requiredPoints = 3; // Basic flat surface needs 3 points for a plane
      if (spec.characteristicType === 'CONCENTRICITY' || spec.characteristicType === 'POSITION') {
        requiredPoints = 5; // Circles/Cylinders require 4-5 points to isolate coordinates and diameter
      } else if (spec.characteristicType === 'CYLINDRICITY') {
        requiredPoints = 8; // Double ring helical path
      } else if (spec.characteristicType === 'DIAMETER') {
        requiredPoints = 4; // Multi-chord fits
      }
      pointsPerFeature[spec.featureId] = requiredPoints;
    });

    const planHash = this.computePlanHash(planId, partId, partRevision, specifications);

    return {
      planId,
      partId,
      partRevision,
      specifications,
      pointsPerFeature,
      timestampCreated: new Date().toISOString(),
      planHash
    };
  }

  /**
   * Deterministic plan hashing
   */
  public static computePlanHash(
    planId: string,
    partId: string,
    partRevision: string,
    specs: ToleranceSpecification[]
  ): string {
    const payload = JSON.stringify({
      planId,
      partId,
      partRevision,
      specs: specs.map(s => ({ id: s.specId, feat: s.featureId, type: s.characteristicType, nom: s.nominalMm }))
    });

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return `SECP-061-PLAN-HASH-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
