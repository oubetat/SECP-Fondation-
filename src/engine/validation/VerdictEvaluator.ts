import { EngineeringVerdict } from './VerdictTypes';
import { VerdictEvidence, VerdictCriterion, VerdictDecision } from './VerdictContract';

export class VerdictEvaluator {
  public static evaluate(
    gateId: string,
    criteria: VerdictCriterion[],
    evidence: VerdictEvidence[]
  ): VerdictDecision {
    const decisionTrace: string[] = [];
    const failures: string[] = [];
    const unresolved: string[] = [];

    decisionTrace.push(`Evaluating gate ${gateId}`);

    if (!criteria || criteria.length === 0) {
      decisionTrace.push("No criteria provided. Cannot establish truth.");
      return this.buildDecision("INCONCLUSIVE", gateId, criteria, evidence, failures, unresolved, decisionTrace);
    }

    let hasMandatoryFailure = false;
    let hasMissingEvidence = false;
    let hasInconclusiveCriteria = false;

    for (const criterion of criteria) {
      decisionTrace.push(`criterion ${criterion.criterionId} evaluated`);

      // Check if required evidence is present
      const relatedEvidence = evidence.filter(e => criterion.evidenceIds.includes(e.evidenceId));
      if (criterion.evidenceIds.length > 0 && relatedEvidence.length === 0) {
        decisionTrace.push(`required evidence missing for ${criterion.criterionId}`);
        unresolved.push(criterion.criterionId);
        hasMissingEvidence = true;
        continue;
      }

      if (criterion.satisfied === false) {
        decisionTrace.push(`criterion satisfied = false (${criterion.reason})`);
        if (criterion.mandatory) {
           failures.push(criterion.criterionId);
           hasMandatoryFailure = true;
        }
      } else if (criterion.satisfied === null) {
        decisionTrace.push(`criterion satisfied = null (cannot establish truth)`);
        hasInconclusiveCriteria = true;
      } else {
        decisionTrace.push(`criterion satisfied = true`);
      }
    }

    if (hasMissingEvidence) {
       decisionTrace.push("verdict = UNPROVEN");
       return this.buildDecision("UNPROVEN", gateId, criteria, evidence, failures, unresolved, decisionTrace);
    }

    if (hasMandatoryFailure) {
       decisionTrace.push("mandatory criteria explicitly false");
       decisionTrace.push("verdict = FAIL");
       return this.buildDecision("FAIL", gateId, criteria, evidence, failures, unresolved, decisionTrace);
    }

    if (hasInconclusiveCriteria) {
       decisionTrace.push("evidence exists but cannot establish truth");
       decisionTrace.push("verdict = INCONCLUSIVE");
       return this.buildDecision("INCONCLUSIVE", gateId, criteria, evidence, failures, unresolved, decisionTrace);
    }

    decisionTrace.push("all mandatory criteria satisfied");
    decisionTrace.push("verdict = PASS");
    return this.buildDecision("PASS", gateId, criteria, evidence, failures, unresolved, decisionTrace);
  }

  private static buildDecision(
    verdict: EngineeringVerdict,
    gateId: string,
    criteria: VerdictCriterion[],
    evidence: VerdictEvidence[],
    failures: string[],
    unresolved: string[],
    decisionTrace: string[]
  ): VerdictDecision {
    return { verdict, gateId, criteria, evidence, failures, unresolved, decisionTrace };
  }
}
