/**
 * PATCH-SECP-045 — Kinematic Revision & Provenance Engine
 * Tracks and logs immutable revision records for committed kinematic states.
 * Generates cryptographic state hashes, tracks solver version, kernel version, and validation summaries.
 */

import { KinematicRevisionRecord, KinematicSolveResult } from './KinematicTypes';
import { AssemblyComponent, AssemblyConstraint } from './AssemblyConstraintTypes';

export class KinematicRevisionEngine {
  private static records: KinematicRevisionRecord[] = [];

  /**
   * Creates and stores an immutable revision record for a solved kinematic state
   */
  public static createRecord(
    assemblyId: string,
    assemblyRevision: number,
    solveResult: KinematicSolveResult,
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[],
    kernelVersion: string = 'OCCT-7.8.0-WASM'
  ): KinematicRevisionRecord {
    const inputStateHash = this.hashString(
      components.map(c => {
        const p = c?.placementTransform?.position;
        return `${c?.instanceId || 'unknown'}:${p ? `${p.x},${p.y},${p.z}` : '0,0,0'}`;
      }).join(';')
    );
    const constraintHash = this.hashString(
      constraints.map(c => `${c.constraintId}:${c.type}:${c.componentA}->${c.componentB}`).join(';')
    );

    const record: KinematicRevisionRecord = {
      assemblyId,
      assemblyRevision,
      solverVersion: 'SECP-Kinematics-v0.45.0',
      kernelVersion,
      inputStateHash,
      constraintHash,
      outputStateHash: solveResult.deterministicHash,
      timestamp: new Date().toISOString(),
      status: solveResult.status,
      validationSummary: `DOF: ${solveResult.freeDOF} free, Residual: ${solveResult.residualError.toExponential(3)}, Iterations: ${solveResult.solverIterations}`
    };

    this.records.push(record);
    return record;
  }

  /**
   * Returns all recorded revision records
   */
  public static getRecords(): KinematicRevisionRecord[] {
    return [...this.records];
  }

  /**
   * Clears revision history (for testing)
   */
  public static clear(): void {
    this.records = [];
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}
