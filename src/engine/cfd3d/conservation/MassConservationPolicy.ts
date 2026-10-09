/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Conservation Policy
 */

import { MassConservationStatus } from './MassConservationTypes';

export interface MassConservationPolicy {
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly localTolerance: number;
  readonly referenceFlowFloor: number;
  readonly transientTolerance: number;
  readonly internalFaceTolerance: number;
}

export const DEFAULT_MASS_CONSERVATION_POLICY: MassConservationPolicy = {
  absoluteTolerance: 1e-10,
  relativeTolerance: 1e-6,
  localTolerance: 1e-4,
  referenceFlowFloor: 1e-15,
  transientTolerance: 1e-8,
  internalFaceTolerance: 1e-12
};
