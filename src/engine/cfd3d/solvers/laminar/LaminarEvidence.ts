/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Evidence
 */

import { LaminarSolverResultData } from './LaminarSolverResult';
import { LaminarSolverVerdict } from './LaminarSolverTypes';

export interface LaminarSolverEvidenceData {
  readonly runId: string;
  readonly solverVersion: string;
  readonly formulation: string;
  readonly inputHashes: {
    readonly mesh: string;
    readonly material: string;
    readonly boundaryConditions: string;
    readonly initialState: string;
    readonly config: string;
  };
  readonly outputHashes: {
    readonly finalState: string;
    readonly evidence: string;
  };
  readonly metrics: {
    readonly iterationCount: number;
    readonly finalResidual: number;
    readonly massImbalance: number;
  };
  readonly verdict: LaminarSolverVerdict;
  readonly timestamp: string;
  readonly signature: string;
}

export class LaminarEvidence {
  public static generate(result: LaminarSolverResultData): LaminarSolverEvidenceData {
    const timestamp = new Date().toISOString();
    return {
      runId: result.runId,
      solverVersion: result.solverVersion,
      formulation: result.formulation,
      inputHashes: {
        mesh: result.meshHash,
        material: result.materialHash,
        boundaryConditions: result.boundaryConditionHash,
        initialState: result.initialStateHash,
        config: result.configurationHash
      },
      outputHashes: {
        finalState: result.finalStateHash,
        evidence: result.evidenceHash
      },
      metrics: {
        iterationCount: result.iterationCount,
        finalResidual: result.residualMetrics.maxResidual,
        massImbalance: result.massConservation.massImbalance
      },
      verdict: result.convergenceState,
      timestamp,
      signature: `secp-sig-${result.evidenceHash}-${timestamp}`
    };
  }
}
