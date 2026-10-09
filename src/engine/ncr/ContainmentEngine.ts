/**
 * PATCH-SECP-063: Containment and Quarantine Engine
 * Enforces immediate containment boundaries on suspect batches, material lots,
 * and downstream machined serials to prevent out-of-spec leakage.
 */

import { ContainmentHold, ContainmentStatus } from './NCRTypes';

export class ContainmentEngine {
  /**
   * Triggers quarantine on a material lot, locking up associated serial numbers
   */
  public static initiateHold(params: {
    ncrId: string;
    materialLotId: string;
    affectedPartSerials: string[];
  }): ContainmentHold {
    const holdId = `hold-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (params.affectedPartSerials.length === 0) {
      throw new Error('Containment hold requires at least one affected part serial number.');
    }

    return {
      holdId,
      ncrId: params.ncrId,
      status: 'CONTAINMENT_REQUIRED',
      materialLotId: params.materialLotId,
      affectedPartSerials: [...params.affectedPartSerials],
      isReleased: false,
      lockTimestamp: new Date().toISOString()
    };
  }

  /**
   * Escalates the hold to lot hold status
   */
  public static escalateToLotHold(hold: ContainmentHold): ContainmentHold {
    if (hold.isReleased) {
      throw new Error('Released containment blocks cannot be escalated.');
    }

    return {
      ...hold,
      status: 'LOT_HOLD'
    };
  }

  /**
   * Confirms affected parts have been identified and corralled
   */
  public static verifyCorralled(hold: ContainmentHold): ContainmentHold {
    if (hold.isReleased) {
      throw new Error('Cannot run corral verification on a released block.');
    }

    return {
      ...hold,
      status: 'AFFECTED_PARTS_IDENTIFIED'
    };
  }

  /**
   * Releases a containment block using an official authorization code
   */
  public static releaseHold(
    hold: ContainmentHold,
    releaseCode: string,
    authorizedBy: string
  ): ContainmentHold {
    // Release code must be non-empty and structured
    if (!releaseCode || releaseCode.length < 6) {
      throw new Error('Security Error: Release requires a valid, high-entropy 6-character release authorization code.');
    }

    return {
      ...hold,
      status: 'DETECTED', // Returns to detected/resolved state
      isReleased: true,
      holdReleaseCode: releaseCode,
      releaseTimestamp: new Date().toISOString(),
      releasedBy: authorizedBy
    };
  }
}
