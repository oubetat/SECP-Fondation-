/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-071: Independent Validation Verifier
 */

import { PhysicalReferenceData } from './ValidationTypes';

export interface IndependentValidationResult {
  readonly isValid: boolean;
  readonly coordinatesAligned: boolean;
  readonly uncertaintyBoundPassed: boolean;
  readonly diagnostics: string[];
}

export class IndependentValidationVerifier {
  public static verify(
    coords: readonly { x: number; y: number }[],
    ref: PhysicalReferenceData
  ): IndependentValidationResult {
    const diagnostics: string[] = [];
    let coordinatesAligned = true;
    let uncertaintyBoundPassed = true;

    // 1. Coordinates Alignment check
    if (coords.length !== ref.coordinates.length) {
      coordinatesAligned = false;
      diagnostics.push(`Independent Verification Failure: Coordinate length mismatch. Num=${coords.length}, Ref=${ref.coordinates.length}`);
    } else {
      for (let i = 0; i < coords.length; i++) {
        const dx = Math.abs(coords[i].x - ref.coordinates[i].x);
        const dy = Math.abs(coords[i].y - ref.coordinates[i].y);
        if (dx > 1e-4 || dy > 1e-4) {
          coordinatesAligned = false;
          diagnostics.push(`Independent Verification Failure: Coordinate mismatch at node index ${i}`);
          break;
        }
      }
    }

    // 2. Positivity of Uncertainty check
    for (let i = 0; i < ref.uncertainty.length; i++) {
      if (ref.uncertainty[i] <= 0.0) {
        uncertaintyBoundPassed = false;
        diagnostics.push(`Independent Verification Failure: Non-positive experimental uncertainty at node index ${i}: ${ref.uncertainty[i]}`);
        break;
      }
    }

    const isValid = coordinatesAligned && uncertaintyBoundPassed;

    return {
      isValid,
      coordinatesAligned,
      uncertaintyBoundPassed,
      diagnostics
    };
  }
}
