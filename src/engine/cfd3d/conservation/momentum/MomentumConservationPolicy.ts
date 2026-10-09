/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Conservation Policy
 */

export interface MomentumConservationPolicy {
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly localTolerance: number;
  readonly forceTolerance: number;
  readonly fluxTolerance: number;
  readonly transientTolerance: number;
  readonly internalFaceTolerance: number;
  readonly referenceMomentumFloor: number;
  readonly zeroMomentumPolicy: 'STRICT' | 'RELAXED';
}

export const DEFAULT_MOMENTUM_CONSERVATION_POLICY: MomentumConservationPolicy = {
  absoluteTolerance: 1e-8,
  relativeTolerance: 1e-6,
  localTolerance: 1e-4,
  forceTolerance: 1e-10,
  fluxTolerance: 1e-10,
  transientTolerance: 1e-8,
  internalFaceTolerance: 1e-12,
  referenceMomentumFloor: 1e-15,
  zeroMomentumPolicy: 'STRICT'
};
