import { SerialReleaseRecord } from './ManufacturingReleaseTypes';

export class SerialReleaseEngine {
  public static verifyIndividualSerial(
    serial: SerialReleaseRecord,
    hasOverride: boolean
  ): SerialReleaseRecord {
    if (serial.eligibilityStatus === 'ELIGIBLE') {
      return { ...serial };
    }

    return {
      ...serial,
      eligibilityStatus: hasOverride ? 'ELIGIBLE' : 'BLOCKED'
    };
  }
}
