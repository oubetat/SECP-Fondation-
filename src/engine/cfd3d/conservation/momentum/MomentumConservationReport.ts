/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Conservation Report
 */

import { MomentumConservationStatus, MomentumVector } from './MomentumConservationTypes';

export interface MomentumConservationReport {
  readonly formulation: string;
  readonly steady: boolean;
  readonly totalConvectiveFlux: MomentumVector;
  readonly pressureForce: MomentumVector;
  readonly viscousForce: MomentumVector;
  readonly bodyForce: MomentumVector;
  readonly sourceTerms: MomentumVector;
  readonly accumulation: MomentumVector;
  readonly imbalanceX: number;
  readonly imbalanceY: number;
  readonly imbalanceZ: number;
  readonly globalImbalanceNorm: number;
  readonly maxLocalImbalance: MomentumVector;
  readonly internalFaceImbalance: number;
  readonly status: MomentumConservationStatus;
  readonly diagnostics: string[];
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly timestamp: string;
}
