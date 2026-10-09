/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Conservation Policy
 */

export interface EnergyConservationPolicy {
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly localTolerance: number;
  readonly internalFaceTolerance: number;
  readonly fluxTolerance: number;
  readonly heatFluxTolerance: number;
  readonly forceWorkTolerance: number;
  readonly transientTolerance: number;
  readonly referenceEnergyFloor: number;
  readonly zeroEnergyFluxPolicy: 'STRICT' | 'RELAXED';
}

export const DEFAULT_ENERGY_CONSERVATION_POLICY: EnergyConservationPolicy = {
  absoluteTolerance: 1e-8,
  relativeTolerance: 1e-6,
  localTolerance: 1e-4,
  internalFaceTolerance: 1e-12,
  fluxTolerance: 1e-10,
  heatFluxTolerance: 1e-10,
  forceWorkTolerance: 1e-10,
  transientTolerance: 1e-8,
  referenceEnergyFloor: 1e-12,
  zeroEnergyFluxPolicy: 'STRICT'
};
