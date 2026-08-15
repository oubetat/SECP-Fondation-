/**
 * PATCH-SECP-080: Multi-Run AP242 Deterministic Reproducibility Engine
 * 
 * Verifies that repeated AP242 Part 21 serialization, parsing, and verification
 * cycles produce bit-exact identical semantic and cryptographic state across multiple runs.
 */

import { AP242TestFixtures } from '../interop/AP242TestFixtures';
import { SECP080AP242VerificationEngine } from './SECP080AP242VerificationEngine';

export interface ReproducibilityRunItem {
  runIndex: number;
  sourceHash: string;
  reconstructedHash: string;
  stepFileHash: string;
  semanticRetentionRatio: number;
  deterministicMatch: boolean;
}

export interface ReproducibilityAudit080Result {
  runsCount: number;
  allDeterministic: boolean;
  baselineHash: string;
  runs: ReproducibilityRunItem[];
  passed: boolean;
  details: string;
}

export class SECP080ReproducibilityEngine {
  /**
   * Runs multi-cycle deterministic reproducibility audit.
   */
  public static runReproducibilityAudit(cycles = 5): ReproducibilityAudit080Result {
    const fixture = AP242TestFixtures.getFixtureD();
    const runs: ReproducibilityRunItem[] = [];

    // Run baseline
    const baseline = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixture);
    const baselineHash = baseline.reconstructedModelHash;

    for (let i = 0; i < cycles; i++) {
      const audit = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixture);
      const match = audit.reconstructedModelHash === baselineHash && audit.semanticRetention.retentionRatio >= 0.9999;

      runs.push({
        runIndex: i + 1,
        sourceHash: audit.sourceModelHash,
        reconstructedHash: audit.reconstructedModelHash,
        stepFileHash: audit.stepFileHash,
        semanticRetentionRatio: audit.semanticRetention.retentionRatio,
        deterministicMatch: match
      });
    }

    const allDeterministic = runs.every(r => r.deterministicMatch);

    return {
      runsCount: cycles,
      allDeterministic,
      baselineHash,
      runs,
      passed: allDeterministic,
      details: allDeterministic 
        ? `All ${cycles} round-trip cycles produced bit-exact identical cryptographic digest (${baselineHash})`
        : 'Non-deterministic variance or drift detected across runs'
    };
  }
}
