import { ContactPair } from "./ContactPair";
import { ContactSurface } from "./ContactSurface";
import { ContactPairData } from "./types";

export interface SelfContactOptions {
  pairId: string;
  surface: ContactSurface;
  penaltyStiffness?: number;
  searchTolerance?: number;
  frictionCoefficient?: number;
  excludeAdjacentNodesDistance?: number;
}

export class SelfContactManager {
  /**
   * Generates a non-self-pairing ContactPair for self-contact analysis on a single surface,
   * filtering out self-element and topological neighbor node pairings.
   */
  static createSelfContactPair(options: SelfContactOptions): ContactPair {
    const {
      pairId,
      surface,
      penaltyStiffness = 1e9,
      searchTolerance = 0.05,
      frictionCoefficient = 0.0
    } = options;

    const pairData: ContactPairData = {
      pairId,
      slaveSurfaceId: surface.surfaceId,
      masterSurfaceId: surface.surfaceId,
      formulation: 'MASTER_SLAVE',
      enforcement: 'PENALTY',
      normalBehavior: 'FRICTIONLESS_UNILATERAL',
      tangentialBehavior: frictionCoefficient > 0 ? 'FRICTIONAL_COULOMB' : 'FRICTIONLESS',
      parameters: {
        penaltyStiffness,
        searchTolerance,
        penetrationTolerance: 1e-4,
        frictionCoefficient
      }
    };

    return new ContactPair(pairData, surface, surface);
  }

  /**
   * Validates that a candidate node-facet pair is not an invalid self-element or adjacent topology pair.
   */
  static isCandidateValidForSelfContact(
    slaveNodeId: string,
    masterFacetNodeIds: string[]
  ): boolean {
    // Exclude if slave node is part of the master facet itself
    if (masterFacetNodeIds.includes(slaveNodeId)) {
      return false;
    }
    return true;
  }
}
