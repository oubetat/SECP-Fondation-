/**
 * SECP Industrial OS v2 — Coupling Evidence Generation
 * PATCH-054: Pressure-Velocity Coupling
 */

import * as crypto from 'crypto';
import { 
  CouplingState, 
  UnderRelaxationConfig, 
  PressureReferencePolicy,
  FlowAssumptions,
  CouplingVerdict
} from './PressureVelocityTypes';
import { CouplingVerificationReport } from './CouplingVerificationPrimitives';

export interface CouplingEvidenceRecord {
  evidenceId: string;
  patchId: 'PATCH-054';
  caseId: string;
  schemeId: string;
  schemeVersion: string;
  flowAssumptions: FlowAssumptions;
  meshHash: string;
  physicsModel: {
    density: number;
    viscosity: number;
  };
  pressureReference: PressureReferencePolicy;
  relaxationFactors: UnderRelaxationConfig;
  iterations: number;
  residualHistoryHash: string;
  continuityResult: {
    absoluteResidual: number;
    normalizedResidual: number;
    maxCellImbalance: number;
  };
  globalMassBalance: {
    inletMassFlow: number;
    outletMassFlow: number;
    netMassImbalance: number;
    relativeImbalance: number;
  };
  verdict: CouplingVerdict;
  timestamp: string;
  provenance: {
    source: 'SECP_COUPLING_FRAMEWORK';
    revision: '1.0.0';
  };
}

export class CouplingEvidenceEngine {

  public static hashObject(obj: any): string {
    const jsonStr = JSON.stringify(obj);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }

  public static createEvidenceRecord(
    caseId: string,
    schemeId: string,
    schemeVersion: string,
    flowAssumptions: FlowAssumptions,
    meshHash: string,
    density: number,
    viscosity: number,
    pressureReference: PressureReferencePolicy,
    relaxation: UnderRelaxationConfig,
    state: CouplingState,
    reports: CouplingVerificationReport[],
    verdict: CouplingVerdict,
    timestamp: string = new Date().toISOString()
  ): CouplingEvidenceRecord {
    const residualHistoryHash = this.hashObject(state.history);

    return {
      evidenceId: `EVID-COUPLING-${caseId}-${schemeId}`,
      patchId: 'PATCH-054',
      caseId,
      schemeId,
      schemeVersion,
      flowAssumptions,
      meshHash,
      physicsModel: { density, viscosity },
      pressureReference,
      relaxationFactors: relaxation,
      iterations: state.iteration,
      residualHistoryHash,
      continuityResult: {
        absoluteResidual: state.continuity.absoluteResidual,
        normalizedResidual: state.continuity.normalizedResidual,
        maxCellImbalance: state.continuity.maxCellImbalance
      },
      globalMassBalance: {
        inletMassFlow: state.massBalance.inletMassFlow,
        outletMassFlow: state.massBalance.outletMassFlow,
        netMassImbalance: state.massBalance.netMassImbalance,
        relativeImbalance: state.massBalance.relativeImbalance
      },
      verdict,
      timestamp,
      provenance: {
        source: 'SECP_COUPLING_FRAMEWORK',
        revision: '1.0.0'
      }
    };
  }

  public static verifyEvidenceIntegrity(record: CouplingEvidenceRecord): boolean {
    if (!record) return false;
    if (record.patchId !== 'PATCH-054') return false;
    if (!record.evidenceId.startsWith('EVID-COUPLING-')) return false;
    if (!record.residualHistoryHash) return false;
    return true;
  }
}
