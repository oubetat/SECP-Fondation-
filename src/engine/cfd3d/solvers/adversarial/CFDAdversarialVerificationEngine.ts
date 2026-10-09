/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: CFD Adversarial Verification Engine Core
 */

import {
  CFDVerdict,
  AdversarialCoverage,
  ConvergencePolicy,
  ConservationPolicy,
  ValidityPolicy,
  VerdictEvidence,
  VerdictExplanation
} from './AdversarialTypes';
import { VerdictEngine } from './VerdictEngine';
import { IndependentAdversarialOracle } from './IndependentAdversarialOracle';

export class CFDAdversarialVerificationEngine {
  public static evaluateCase(params: {
    readonly caseId: string;
    readonly runId: string;
    readonly fields: Readonly<Record<string, readonly number[]>>;
    readonly meshVolumes: readonly number[];
    readonly invertedCellFlags?: readonly boolean[];
    readonly residualHistory: readonly number[];
    readonly fluxes: {
      readonly massIn: number;
      readonly massOut: number;
      readonly momentumIn?: number;
      readonly momentumOut?: number;
      readonly energyIn?: number;
      readonly energyOut?: number;
    };
    readonly solverClaimedStatus?: string;
    readonly solverExitCode?: number;
    readonly convergencePolicy?: ConvergencePolicy;
    readonly conservationPolicy?: ConservationPolicy;
    readonly validityPolicy?: ValidityPolicy;
  }): {
    readonly verdict: CFDVerdict;
    readonly explanation: VerdictExplanation;
    readonly evidence: VerdictEvidence;
    readonly oracleMatches: boolean;
    readonly oracleVerdict: CFDVerdict;
  } {
    const computed = VerdictEngine.computeCFDVerdict(params);
    const oracle = IndependentAdversarialOracle.evaluateIndependentOracle({
      fields: params.fields,
      meshVolumes: params.meshVolumes,
      residualHistory: params.residualHistory,
      fluxes: { massIn: params.fluxes.massIn, massOut: params.fluxes.massOut },
      convergencePolicy: params.convergencePolicy,
      conservationPolicy: params.conservationPolicy,
      validityPolicy: params.validityPolicy
    });

    const oracleMatches = computed.verdict === oracle.oracleVerdict;

    return {
      verdict: computed.verdict,
      explanation: computed.explanation,
      evidence: computed.evidence,
      oracleMatches,
      oracleVerdict: oracle.oracleVerdict
    };
  }

  public static calculateCoverage(testResults: readonly { readonly expected: CFDVerdict; readonly actual: CFDVerdict; readonly category: string }[]): AdversarialCoverage {
    let detectedCount = 0;
    let survivalCount = 0;
    let falsePositiveCount = 0;
    let falseNegativeCount = 0;
    const categories = new Set<string>();

    for (const res of testResults) {
      categories.add(res.category);
      if (res.expected === res.actual) {
        detectedCount++;
      } else {
        survivalCount++;
        if (res.expected === 'CONVERGED' && res.actual !== 'CONVERGED') {
          falsePositiveCount++;
        }
        if (res.expected !== 'CONVERGED' && res.actual === 'CONVERGED') {
          falseNegativeCount++;
        }
      }
    }

    return {
      totalMutationsTested: testResults.length,
      detectedCount,
      survivalCount,
      mutationCategoriesCovered: Array.from(categories),
      falsePositiveCount,
      falseNegativeCount
    };
  }
}
