/**
 * SECP Industrial OS v2 — Conservation Report Generator
 * PATCH-050: Conservation Framework
 */

import { ConservationResult, ConservationVerdict } from "./ConservationTypes";
import { ConservationEvidence, ConservationEvidenceRecord } from "./ConservationEvidence";

export interface ConservationReportData {
  caseId: string;
  solverId: string;
  solverVersion: string;
  meshId: string;
  mass: {
    verdict: string;
    imbalanceKgPerSec?: number;
  };
  momentum: {
    verdict: string;
    imbalanceNormNewton?: number;
  };
  energy: {
    verdict: string;
    imbalanceWatt?: number;
    availableTerms: string[];
    missingTerms: string[];
  };
  overallVerdict: ConservationVerdict;
  diagnostics: string[];
  evidence: ConservationEvidenceRecord;
}

export class ConservationReportGenerator {

  public static generateReport(result: ConservationResult): ConservationReportData {
    const evidence = ConservationEvidence.createEvidence(result);

    return {
      caseId: result.caseId,
      solverId: result.solverId,
      solverVersion: result.solverVersion,
      meshId: result.meshId,
      mass: {
        verdict: result.massResult.verdict,
        imbalanceKgPerSec: result.massResult.balanceTerms?.absoluteImbalance
      },
      momentum: {
        verdict: result.momentumResult.verdict,
        imbalanceNormNewton: result.momentumResult.componentTerms?.vectorNormImbalance
      },
      energy: {
        verdict: result.energyResult.verdict,
        imbalanceWatt: result.energyResult.balanceTerms?.absoluteImbalance,
        availableTerms: result.energyResult.availableTerms,
        missingTerms: result.energyResult.missingTerms
      },
      overallVerdict: result.overallVerdict,
      diagnostics: result.diagnostics,
      evidence
    };
  }
}
