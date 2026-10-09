/**
 * SECP Industrial OS v2 — Determinism Gate
 * 
 * Formal Gate for evaluating determinism evidence against declared contracts.
 * Strictly adheres to non-negotiable rules:
 * - NO hardcoded verdicts (PASS/FAIL).
 * - Verdict is computed strictly from observable criteria and evidence.
 * - Missing evidence => UNPROVEN.
 * - Contradictory evidence => INCONCLUSIVE.
 * - Violated contract => FAIL.
 */

import { EngineeringVerdict } from './VerdictTypes';
import { DeterminismEvaluation, DeterminismContract } from '../core/DeterminismContract';

export interface DeterminismGateReport {
  gateId: string;
  verdict: EngineeringVerdict;
  evaluationsCount: number;
  deterministicCount: number;
  reproducibleCount: number;
  nonDeterministicCount: number;
  environmentDependentCount: number;
  unprovenCount: number;
  failures: string[];
  unresolved: string[];
  decisionTrace: string[];
}

export class DeterminismGate {
  public static evaluate(
    gateId: string,
    evaluations: DeterminismEvaluation[],
    contracts: DeterminismContract[] = []
  ): DeterminismGateReport {
    const decisionTrace: string[] = [];
    const failures: string[] = [];
    const unresolved: string[] = [];

    decisionTrace.push(`[${gateId}] Initiating Determinism Gate verification`);

    if (!evaluations || evaluations.length === 0) {
      decisionTrace.push(`[${gateId}] No determinism evaluations provided -> UNPROVEN`);
      unresolved.push('EVIDENCE_MISSING');
      return {
        gateId,
        verdict: 'UNPROVEN',
        evaluationsCount: 0,
        deterministicCount: 0,
        reproducibleCount: 0,
        nonDeterministicCount: 0,
        environmentDependentCount: 0,
        unprovenCount: 0,
        failures,
        unresolved,
        decisionTrace
      };
    }

    let deterministicCount = 0;
    let reproducibleCount = 0;
    let nonDeterministicCount = 0;
    let environmentDependentCount = 0;
    let unprovenCount = 0;

    const contractMap = new Map<string, DeterminismContract>();
    for (const c of contracts) {
      contractMap.set(c.componentId, c);
    }

    for (const ev of evaluations) {
      decisionTrace.push(`Evaluating component: ${ev.componentId} (classified: ${ev.classification}, verified: ${ev.verified})`);

      if (ev.classification === 'DETERMINISTIC') deterministicCount++;
      else if (ev.classification === 'REPRODUCIBLE') reproducibleCount++;
      else if (ev.classification === 'NON_DETERMINISTIC') nonDeterministicCount++;
      else if (ev.classification === 'ENVIRONMENT_DEPENDENT') environmentDependentCount++;
      else unprovenCount++;

      const contract = contractMap.get(ev.componentId);

      if (contract) {
        if (contract.level === 'DETERMINISTIC' && !ev.exactMatch) {
          const reason = `Component ${ev.componentId} declared DETERMINISTIC but failed exact byte matching. Differences: ${ev.differences.join('; ')}`;
          failures.push(reason);
          decisionTrace.push(`[FAIL] ${reason}`);
        } else if (contract.level === 'REPRODUCIBLE' && !ev.reproducible) {
          const reason = `Component ${ev.componentId} declared REPRODUCIBLE but exceeded tolerance bounds. Differences: ${ev.differences.join('; ')}`;
          failures.push(reason);
          decisionTrace.push(`[FAIL] ${reason}`);
        } else if (!ev.verified && contract.level !== 'UNPROVEN') {
          const reason = `Component ${ev.componentId} failed verification for declared level ${contract.level}. Limitations: ${ev.limitations.join('; ')}`;
          failures.push(reason);
          decisionTrace.push(`[FAIL] ${reason}`);
        }
      } else {
        // Evaluation without registered contract is marked unproven
        if (ev.classification === 'UNPROVEN') {
          unresolved.push(`Component ${ev.componentId} classification is UNPROVEN`);
          decisionTrace.push(`[UNPROVEN] Insufficient evidence for ${ev.componentId}`);
        }
      }
    }

    let finalVerdict: EngineeringVerdict;

    if (failures.length > 0) {
      decisionTrace.push(`[${gateId}] Evaluation detected ${failures.length} contract failure(s) -> FAIL`);
      finalVerdict = 'FAIL';
    } else if (unprovenCount > 0 || unresolved.length > 0) {
      decisionTrace.push(`[${gateId}] Evaluation detected unproven components -> UNPROVEN`);
      finalVerdict = 'UNPROVEN';
    } else if (evaluations.every(e => e.verified)) {
      decisionTrace.push(`[${gateId}] All ${evaluations.length} evaluation(s) strictly verified against declared contracts -> PASS`);
      finalVerdict = 'PASS';
    } else {
      decisionTrace.push(`[${gateId}] Ambiguous state in evaluation results -> INCONCLUSIVE`);
      finalVerdict = 'INCONCLUSIVE';
    }

    return {
      gateId,
      verdict: finalVerdict,
      evaluationsCount: evaluations.length,
      deterministicCount,
      reproducibleCount,
      nonDeterministicCount,
      environmentDependentCount,
      unprovenCount,
      failures,
      unresolved,
      decisionTrace
    };
  }
}
