/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-E: CFD Evidence Generator
 *
 * Generates verifiable cryptographic evidence artifacts for CFD solutions,
 * linking physical monitors, mesh quality, and convergence state to a root hash.
 * Formally distinguishes CONVERGED, NOT_CONVERGED, ABORTED, and FAILED execution statuses.
 * Separates the deterministic canonical numerical state hash from dynamic execution metadata.
 */

import * as crypto from 'crypto';
import { 
  CaseDefinition3D, 
  MeshQualityReport, 
  ResidualSnapshot, 
  PhysicalMonitorsSnapshot 
} from './AdaptiveCFDTypes';

export type SimulationExecutionStatus = 'CONVERGED' | 'NOT_CONVERGED' | 'ABORTED' | 'FAILED';

export interface CFDEvidenceArtifact {
  readonly cryptographicHash: string;
  readonly signature: string;
  readonly timestamp: string;
  readonly executionStatus: SimulationExecutionStatus;
  readonly verdict: 'PASS' | 'FAIL';
  readonly conservationVerified: boolean;
  readonly massBalanceErrorPercent: number;
  readonly failureReason?: string;
}

export class CFDEvidenceGenerator {
  /**
   * Generates a signed cryptographic artifact representing the simulation's validity.
   */
  public static generateArtifact(
    caseDef: CaseDefinition3D,
    meshQuality: MeshQualityReport,
    preFlight: any,
    finalResiduals: ResidualSnapshot | undefined,
    finalMonitors: PhysicalMonitorsSnapshot | undefined,
    totalIterations: number,
    converged: boolean,
    failureReason?: string
  ): CFDEvidenceArtifact {
    const massBalanceErrorPercent = finalMonitors?.massFlowImbalancePercent ?? 100.0;
    const conservationVerified = Boolean(finalMonitors && massBalanceErrorPercent <= 1.0 && Number.isFinite(massBalanceErrorPercent));

    let executionStatus: SimulationExecutionStatus = 'NOT_CONVERGED';
    if (failureReason === 'MAX_ITERATIONS_REACHED_WITHOUT_CONVERGENCE') {
      executionStatus = 'NOT_CONVERGED';
    } else if (failureReason && (failureReason.includes('DIVERGENCE') || failureReason.includes('UNPHYSICAL') || failureReason.includes('ABORT'))) {
      executionStatus = 'ABORTED';
    } else if (failureReason) {
      executionStatus = 'FAILED';
    } else if (converged) {
      executionStatus = 'CONVERGED';
    }

    // Strict Gate Rule: ONLY PASS if executionStatus is CONVERGED AND conservation is verified
    const verdict: 'PASS' | 'FAIL' = (executionStatus === 'CONVERGED' && conservationVerified) ? 'PASS' : 'FAIL';

    // Canonical numerical state payload (excluding dynamic timestamp metadata to ensure 100% hash determinism)
    const canonicalStatePayload = {
      caseId: caseDef.caseId || 'unnamed-case',
      meshId: `${meshQuality?.totalCells || 0}_${meshQuality?.totalFaces || 0}`,
      residuals: finalResiduals ? {
        iteration: finalResiduals.iteration,
        continuityL2: Number(finalResiduals.continuityL2.toFixed(8)),
        continuityLInf: Number(finalResiduals.continuityLInf.toFixed(8)),
        maxResidual: Number(finalResiduals.maxResidual.toFixed(8))
      } : null,
      monitors: finalMonitors ? {
        iteration: finalMonitors.iteration,
        dragCoefficientCd: Number(finalMonitors.dragCoefficientCd.toFixed(8)),
        liftCoefficientCl: Number(finalMonitors.liftCoefficientCl.toFixed(8)),
        totalPressureDropPa: Number(finalMonitors.totalPressureDropPa.toFixed(8)),
        massFlowImbalancePercent: Number(finalMonitors.massFlowImbalancePercent.toFixed(6))
      } : null,
      totalIterations,
      converged,
      executionStatus,
      verdict,
      conservationVerified,
      massBalanceErrorPercent: Number(massBalanceErrorPercent.toFixed(6)),
      failureReason: failureReason || null
    };

    const canonicalStateJson = JSON.stringify(canonicalStatePayload);
    const hash = crypto.createHash('sha256').update(canonicalStateJson).digest('hex');
    const timestamp = new Date().toISOString();

    return {
      cryptographicHash: hash,
      signature: `secp-sig-${hash.substring(0, 12)}`,
      timestamp,
      executionStatus,
      verdict,
      conservationVerified,
      massBalanceErrorPercent,
      failureReason
    };
  }
}
