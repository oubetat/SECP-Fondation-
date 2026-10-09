/**
 * SECP Industrial OS v2 — Numerical Flux Utilities & Face Conservation
 * PATCH-053: Flux Framework
 */

import { ConservativeState, PhysicsModel, Vector3 } from './FluxTypes';
import { NumericalFluxScheme } from './FluxScheme';

export class NumericalFluxEngine {

  /**
   * Evaluates face flux for owner cell and neighbor cell across an internal face.
   */
  public static computeInternalFaceFluxPair(
    ownerState: ConservativeState,
    neighborState: ConservativeState,
    outwardNormalFromOwner: Vector3,
    scheme: NumericalFluxScheme,
    physicsModel: PhysicsModel
  ) {
    const normalToOwner = outwardNormalFromOwner;
    const normalToNeighbor: Vector3 = [
      -outwardNormalFromOwner[0],
      -outwardNormalFromOwner[1],
      -outwardNormalFromOwner[2]
    ];

    // Flux out of owner cell (Owner = Left, Neighbor = Right)
    const fluxOwner = scheme.compute(ownerState, neighborState, normalToOwner, physicsModel);

    // Flux out of neighbor cell (Neighbor = Left, Owner = Right)
    const fluxNeighbor = scheme.compute(neighborState, ownerState, normalToNeighbor, physicsModel);

    return {
      fluxOwner,
      fluxNeighbor
    };
  }
}
