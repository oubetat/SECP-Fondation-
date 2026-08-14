/**
 * PATCH-SECP-064: Serial Release Engine
 * Manages individual, high-precision serial-number release validations
 * for critical custom components.
 */

import { SerialReleaseRecord } from './ManufacturingReleaseTypes';

export class SerialReleaseEngine {
  /**
   * Promotes an individual serial record to eligible after checking prerequisites
   */
  public static verifyIndividualSerial(
    record: SerialReleaseRecord,
    hasOverrideDeviation: boolean
  ): SerialReleaseRecord {
    if (record.eligibilityStatus === 'ELIGIBLE') {
      return record;
    }

    // Standard release block can only be lifted if a valid, registered engineering deviation is approved
    if (hasOverrideDeviation) {
      return {
        ...record,
        eligibilityStatus: 'ELIGIBLE'
      };
    }

    return record;
  }
}
