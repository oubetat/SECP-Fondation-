/**
 * PATCH-SECP-063: Requalification Engine
 * Completes the closed-loop digital manufacturing loop. Ensuring that any physical corrective action
 * is verified by a fresh execution re-run, metrology scanning, and SPC control-chart analysis.
 */

import { RequalificationLog } from './NCRTypes';

export class RequalificationEngine {
  /**
   * Spawns a requalification sequence for a closed-loop CAPA action
   */
  public static initiateRequalification(params: {
    ncrId: string;
    correctiveActionId: string;
    newPartSerial: string;
    newJobId: string;
  }): RequalificationLog {
    const requalificationId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return {
      requalificationId,
      ncrId: params.ncrId,
      correctiveActionId: params.correctiveActionId,
      newPartSerial: params.newPartSerial,
      newJobId: params.newJobId,
      metrologyVerified: false,
      spcControlled: false,
      effectivenessStatus: 'PENDING_VERIFICATION',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Logs metrology measurement verification on the fresh workpiece
   */
  public static verifyMetrology(
    log: RequalificationLog,
    measurementHash: string
  ): RequalificationLog {
    if (!measurementHash || measurementHash.length === 0) {
      throw new Error('Requalification Rule: Metrology confirmation requires a valid measurement thread signature.');
    }

    return {
      ...log,
      metrologyVerified: true,
      metrologyMeasurementHash: measurementHash
    };
  }

  /**
   * Logs SPC control-chart verification proving that the process has returned to its stable baseline
   */
  public static verifySPCControl(
    log: RequalificationLog,
    isWithinLimits: boolean
  ): RequalificationLog {
    if (!log.metrologyVerified) {
      throw new Error('Requalification Rule: Cannot perform SPC process validation before metrology verification is complete.');
    }

    return {
      ...log,
      spcControlled: isWithinLimits
    };
  }

  /**
   * Confirms total effectiveness of the corrective action loop
   */
  public static finalizeRequalification(
    log: RequalificationLog
  ): RequalificationLog {
    if (!log.metrologyVerified || !log.spcControlled) {
      return {
        ...log,
        effectivenessStatus: 'INEFFECTIVE_REDESIGN',
        timestamp: new Date().toISOString()
      };
    }

    return {
      ...log,
      effectivenessStatus: 'EFFECTIVE_VERIFIED',
      timestamp: new Date().toISOString()
    };
  }
}
