// SECP Industrial OS v2 — Independent & Differential Inspection Verifier
import {
  InspectionTwin,
  InspectionVerdict,
  ToleranceEvaluation
} from './types';
import { CanonicalInspectionSerializer } from './CanonicalInspectionSerializer';
import { InspectionIdentityService } from './InspectionIdentityService';

export interface IndependentInspectionResult {
  inputHashValid: boolean;
  computedInputHash: string;
  rootHashValid: boolean;
  computedRootHash: string;
  recalculatedEvaluations: ToleranceEvaluation[];
  independentVerdict: InspectionVerdict;
}

export class IndependentInspectionVerifier {
  public static verifyTwinIndependently(twin: InspectionTwin): IndependentInspectionResult {
    const computedInputHash = CanonicalInspectionSerializer.computeInspectionInputHash(twin.inspectionState);
    const inputHashValid = computedInputHash === twin.inputHash;

    // Recalculate evaluations
    const auditRes = InspectionIdentityService.auditInspectionState(twin.inspectionState, twin.partSerial);
    const recalculatedEvaluations = auditRes.evaluations;
    const independentVerdict = auditRes.verdict;

    const evaluationsHash = CanonicalInspectionSerializer.sha256(JSON.stringify(recalculatedEvaluations));

    const computedRootHash = CanonicalInspectionSerializer.computeInspectionRootHash({
      inputHash: computedInputHash,
      evaluationsHash,
      verdict: independentVerdict,
      evidenceHash: twin.inspectionState.evidenceId
    });

    const rootHashValid = computedRootHash === twin.rootHash;

    return {
      inputHashValid,
      computedInputHash,
      rootHashValid,
      computedRootHash,
      recalculatedEvaluations,
      independentVerdict
    };
  }

  public static compareVerdicts(
    primaryTwin: InspectionTwin,
    independentResult: IndependentInspectionResult
  ): { verdict: 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID'; details: string } {
    if (primaryTwin.inputHash !== independentResult.computedInputHash) {
      return {
        verdict: 'MISMATCH',
        details: `Input hash mismatch: Primary [${primaryTwin.inputHash}] vs Independent [${independentResult.computedInputHash}]`
      };
    }

    if (primaryTwin.verdict === 'PASS' && independentResult.independentVerdict !== 'PASS') {
      return {
        verdict: 'MISMATCH',
        details: `VERDICT_INTEGRITY_FAILURE: Primary state claims PASS but independent inspection resulted in ${independentResult.independentVerdict}`
      };
    }

    if (primaryTwin.verdict !== independentResult.independentVerdict) {
        return {
            verdict: 'MISMATCH',
            details: `Verdict mismatch: Primary [${primaryTwin.verdict}] vs Independent [${independentResult.independentVerdict}]`
        };
    }

    return {
      verdict: 'MATCH',
      details: `100% Differential Match between Primary Verifier [${primaryTwin.verdict}] and Independent Verifier [${independentResult.independentVerdict}]`
    };
  }
}
