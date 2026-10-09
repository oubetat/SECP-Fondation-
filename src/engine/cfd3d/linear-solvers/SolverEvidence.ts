/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Cryptographic Solver Evidence Record
 */

import { LinearSystem } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverResult } from './SolverResult';

export interface SolverEvidenceRecord {
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly matrixHash: string;
  readonly rhsHash: string;
  readonly initialGuessHash: string;
  readonly configurationHash: string;
  readonly iterationCount: number;
  readonly residualHistoryHash: string;
  readonly finalResidualNorm: number;
  readonly convergenceStatus: string;
  readonly diagnostics: string[];
  readonly preconditionerId: string;
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class SolverEvidenceGenerator {
  public static generate(
    system: LinearSystem,
    config: SolverConfiguration,
    result: SolverResult,
    preconditionerId: string = 'none'
  ): SolverEvidenceRecord {
    const matrixHash = this.computeHash(`matrix-${system.matrix.rows}x${system.matrix.cols}-${system.matrix.nonZeroCount()}`);
    const rhsHash = this.computeHash(`rhs-${system.rhs.length}-${system.rhs.norm2()}`);
    const initialGuessHash = system.initialGuess 
      ? this.computeHash(`x0-${system.initialGuess.length}-${system.initialGuess.norm2()}`) 
      : 'zero-vector';
    const configHash = result.configurationHash;
    const residualHistoryHash = this.computeHash(`history-${result.residualHistory.join(',')}`);

    const payload = `${result.solverId}|${matrixHash}|${rhsHash}|${result.iterations}|${result.finalResidual.l2}|${result.status}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      solverIdentity: result.solverId,
      solverVersion: '2.0.0',
      matrixHash,
      rhsHash,
      initialGuessHash,
      configurationHash: configHash,
      iterationCount: result.iterations,
      residualHistoryHash,
      finalResidualNorm: result.finalResidual.l2,
      convergenceStatus: result.status,
      diagnostics: result.diagnostics.map(d => String(d)),
      preconditionerId,
      timestamp: new Date().toISOString(),
      provenanceSignature
    };
  }

  private static computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `secp055-hash-${Math.abs(hash).toString(16)}`;
  }
}
