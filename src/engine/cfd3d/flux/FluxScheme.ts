/**
 * SECP Industrial OS v2 — Numerical Flux Scheme Interface
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, FluxResult, Vector3 } from './FluxTypes';

export interface NumericalFluxScheme {
  readonly id: string;
  readonly version: string;

  compute(
    left: ConservativeState,
    right: ConservativeState,
    normal: Vector3,
    physicalModel: PhysicsModel
  ): FluxResult;
}
