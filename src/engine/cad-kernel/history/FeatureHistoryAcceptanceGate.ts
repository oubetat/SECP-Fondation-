/**
 * SECP CAD Kernel — Feature History Acceptance Gate
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - DERIVES RESULT EXCLUSIVELY FROM ACTUAL VERIFICATION EVIDENCE.
 * - Zero hardcoded PASS verdicts.
 * - Reports dimensions: IDENTITY, DEFINITION, DEPENDENCIES, ORDERING, REGENERATION, STATE, HASH, PROVENANCE, DETERMINISM, ADVERSARIAL.
 */

import { FeatureHistory } from './FeatureHistory';
import {
  FeatureHistoryVerification,
  FeatureHistoryVerificationReport,
  GateDimensionVerdict
} from './FeatureHistoryVerification';
import { ToleranceContext } from '../tolerance';

export interface GateReport {
  patchId: 'PATCH-022';
  verdict: GateDimensionVerdict;
  dimensions: FeatureHistoryVerificationReport['dimensions'];
  evidenceHash: string;
}

export class FeatureHistoryAcceptanceGate {
  /**
   * Evaluates the Feature History Acceptance Gate for a given FeatureHistory instance.
   */
  public static evaluate(
    history: FeatureHistory,
    toleranceContext?: ToleranceContext
  ): GateReport {
    const verification = FeatureHistoryVerification.verify(history, toleranceContext);

    return {
      patchId: 'PATCH-022',
      verdict: verification.overallVerdict,
      dimensions: verification.dimensions,
      evidenceHash: verification.evidenceHash
    };
  }
}
