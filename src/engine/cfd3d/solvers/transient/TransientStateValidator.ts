/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient State and Timestep Validator
 */

export enum TransientFailureCode {
  NEGATIVE_TIMESTEP = 'NEGATIVE_TIMESTEP',
  ZERO_TIMESTEP = 'ZERO_TIMESTEP',
  NAN_TIMESTEP = 'NAN_TIMESTEP',
  INFINITY_TIMESTEP = 'INFINITY_TIMESTEP',
  TIME_REVERSAL = 'TIME_REVERSAL',
  ROLLBACK_CORRUPTION = 'ROLLBACK_CORRUPTION',
  CHECKPOINT_CORRUPTION = 'CHECKPOINT_CORRUPTION',
  TEMPORAL_CHAIN_TAMPERING = 'TEMPORAL_CHAIN_TAMPERING'
}

export class TransientStateValidator {
  public static validateTimeStep(
    dt: number,
    currentTime: number,
    previousTime: number
  ): { valid: boolean; error?: TransientFailureCode; detail?: string } {
    if (!Number.isFinite(dt)) {
      return { valid: false, error: TransientFailureCode.NAN_TIMESTEP, detail: `Timestep dt is non-finite: dt=${dt}` };
    }

    if (dt < 0) {
      return { valid: false, error: TransientFailureCode.NEGATIVE_TIMESTEP, detail: `Timestep dt is negative: dt=${dt}` };
    }

    if (dt === 0) {
      return { valid: false, error: TransientFailureCode.ZERO_TIMESTEP, detail: `Timestep dt is zero` };
    }

    if (currentTime <= previousTime) {
      return { valid: false, error: TransientFailureCode.TIME_REVERSAL, detail: `Time reversal detected: currentTime=${currentTime}, previousTime=${previousTime}` };
    }

    return { valid: true };
  }
}
