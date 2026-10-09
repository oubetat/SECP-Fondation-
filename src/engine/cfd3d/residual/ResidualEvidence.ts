/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Evidence Generator
 */

import { ResidualHistory } from './ResidualHistory';
import { ResidualEquation } from './ResidualTypes';

export interface ResidualEvidenceRecord {
  readonly solverId: string;
  readonly solverVersion: string;
  readonly equation: ResidualEquation;
  readonly normType: string;
  readonly normalizationPolicy: string;
  readonly initialResidual: number;
  readonly finalResidual: number;
  readonly iterationCount: number;
  readonly residualHistoryHash: string;
  readonly stateHash: string;
  readonly diagnostics: string[];
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class ResidualEvidence {
  
  public static generate(
    solverId: string,
    equation: ResidualEquation,
    history: ResidualHistory,
    stateHash: string,
    normType: string,
    normalizationPolicy: string
  ): ResidualEvidenceRecord {
    const samples = history.getHistory(equation);
    const initialResidual = samples.length > 0 ? samples[0].absoluteResidual.l2 : 0;
    const finalResidual = samples.length > 0 ? samples[samples.length - 1].absoluteResidual.l2 : 0;
    const historyHash = history.hash(equation);
    
    const diagnosticsSet = new Set<string>();
    samples.forEach(s => s.diagnostics.forEach(d => diagnosticsSet.add(d)));

    const payload = `${solverId}|${equation}|${historyHash}|${finalResidual}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      solverId,
      solverVersion: '2.0.0',
      equation,
      normType,
      normalizationPolicy,
      initialResidual,
      finalResidual,
      iterationCount: samples.length,
      residualHistoryHash: historyHash,
      stateHash,
      diagnostics: Array.from(diagnosticsSet),
      timestamp: new Date().toISOString(),
      provenanceSignature
    };
  }

  private static computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `secp056-hash-${Math.abs(hash).toString(16)}`;
  }
}
