/**
 * SECP Industrial OS v2 — Determinism Evaluator
 * 
 * Implements canonicalization, SHA-256 hashing, numerical comparison (with explicit tolerance),
 * execution fingerprinting, and boundary evaluation without hardcoded shortcuts.
 */

import * as crypto from 'crypto';
import {
  DeterminismLevel,
  DeterminismContract,
  DeterminismBoundary,
  DeterminismComparison,
  DeterminismEvaluation
} from './DeterminismContract';

export interface FingerprintParams {
  componentId: string;
  contractVersion: string;
  softwareVersion?: string;
  configurationHash: string;
  inputsHash: string;
  seed?: string | number;
  clockMode?: string;
  numericalPrecision?: string;
  solverMode?: string;
  declaredDependencies?: string[];
}

export class DeterminismEvaluator {
  private static readonly REFERENCE_FLOOR = 1e-12;

  /**
   * Deterministically canonicalizes an arbitrary JavaScript/TypeScript data structure.
   * - Sorts object keys alphabetically
   * - Preserves array order exactly
   * - Handles nested primitives, objects, arrays
   * - Rejects cyclic references and unsupported types (functions, symbols)
   */
  public static canonicalize(value: unknown, seen = new WeakSet<object>()): string {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return '__undefined__';
    }

    const type = typeof value;

    if (type === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (type === 'number') {
      if (!Number.isFinite(value as number)) {
        return `__NUMERIC_SPECIAL__:${String(value)}`;
      }
      // Preserve -0 distinction if needed, otherwise normal string conversion
      return Object.is(value, -0) ? '-0' : (value as number).toString();
    }

    if (type === 'string') {
      return JSON.stringify(value);
    }

    if (type === 'bigint') {
      return `__BIGINT__:${(value as bigint).toString()}n`;
    }

    if (type === 'function' || type === 'symbol') {
      throw new Error(`[DeterminismEvaluator] Unsupported non-deterministic type: ${type}`);
    }

    if (type === 'object') {
      const obj = value as object;
      if (seen.has(obj)) {
        throw new Error('[DeterminismEvaluator] Cyclic structure detected in canonicalization');
      }
      seen.add(obj);

      if (Array.isArray(obj)) {
        const elements = obj.map(elem => this.canonicalize(elem, seen));
        seen.delete(obj);
        return `[${elements.join(',')}]`;
      }

      if (obj instanceof Date) {
        seen.delete(obj);
        return `__DATE__:${obj.toISOString()}`;
      }

      // Plain or structured object: sort keys lexicographically
      const keys = Object.keys(obj as Record<string, unknown>).sort();
      const entries = keys.map(k => {
        const valStr = this.canonicalize((obj as Record<string, unknown>)[k], seen);
        return `${JSON.stringify(k)}:${valStr}`;
      });

      seen.delete(obj);
      return `{${entries.join(',')}}`;
    }

    return JSON.stringify(String(value));
  }

  /**
   * Computes SHA-256 hash over canonical string representation.
   */
  public static hash(value: unknown): string {
    const canonical = typeof value === 'string' ? value : this.canonicalize(value);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Computes deterministic execution fingerprint from declared parameters.
   * Explicitly excludes volatile host environment factors (wall clock, PID, hostname)
   * unless explicitly parameterized.
   */
  public static computeExecutionFingerprint(params: FingerprintParams): string {
    const canonicalPayload = this.canonicalize({
      componentId: params.componentId,
      contractVersion: params.contractVersion,
      softwareVersion: params.softwareVersion || '2.0.0',
      configurationHash: params.configurationHash,
      inputsHash: params.inputsHash,
      seed: params.seed !== undefined ? params.seed : '__NO_SEED__',
      clockMode: params.clockMode || 'WALL_CLOCK',
      numericalPrecision: params.numericalPrecision || 'FLOAT64',
      solverMode: params.solverMode || 'DEFAULT',
      declaredDependencies: params.declaredDependencies ? [...params.declaredDependencies].sort() : []
    });

    return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  }

  /**
   * Compares two arbitrary data structures numerically and structurally.
   */
  public static compare(
    expected: unknown,
    actual: unknown,
    tolerance = 0,
    path = ''
  ): DeterminismComparison {
    const differences: string[] = [];
    let maxAbsDiff = 0;
    let maxRelDiff = 0;

    const diffFound = (p: string, msg: string) => {
      differences.push(p ? `[${p}] ${msg}` : msg);
    };

    const recursiveCompare = (exp: unknown, act: unknown, curPath: string) => {
      if (exp === act) {
        return;
      }

      if (typeof exp === 'number' && typeof act === 'number') {
        const absDiff = Math.abs(exp - act);
        const refDenom = Math.max(Math.abs(exp), Math.abs(act), this.REFERENCE_FLOOR);
        const relDiff = absDiff / refDenom;

        if (absDiff > maxAbsDiff) maxAbsDiff = absDiff;
        if (relDiff > maxRelDiff) maxRelDiff = relDiff;

        if (absDiff > tolerance) {
          diffFound(curPath, `Numeric mismatch: expected ${exp}, got ${act} (absDiff=${absDiff.toExponential(4)}, tol=${tolerance})`);
        }
        return;
      }

      if (typeof exp !== typeof act) {
        diffFound(curPath, `Type mismatch: expected ${typeof exp}, got ${typeof act}`);
        return;
      }

      if (exp === null || act === null || exp === undefined || act === undefined) {
        diffFound(curPath, `Nullish mismatch: expected ${String(exp)}, got ${String(act)}`);
        return;
      }

      if (typeof exp === 'object' && typeof act === 'object') {
        if (Array.isArray(exp) !== Array.isArray(act)) {
          diffFound(curPath, `Array/Object structure mismatch`);
          return;
        }

        if (Array.isArray(exp) && Array.isArray(act)) {
          if (exp.length !== act.length) {
            diffFound(curPath, `Array length mismatch: expected ${exp.length}, got ${act.length}`);
          }
          const minLen = Math.min(exp.length, act.length);
          for (let i = 0; i < minLen; i++) {
            recursiveCompare(exp[i], act[i], `${curPath}[${i}]`);
          }
          return;
        }

        const expObj = exp as Record<string, unknown>;
        const actObj = act as Record<string, unknown>;
        const allKeys = Array.from(new Set([...Object.keys(expObj), ...Object.keys(actObj)])).sort();

        for (const k of allKeys) {
          if (!(k in expObj)) {
            diffFound(curPath ? `${curPath}.${k}` : k, `Unexpected property in actual output`);
          } else if (!(k in actObj)) {
            diffFound(curPath ? `${curPath}.${k}` : k, `Missing property in actual output`);
          } else {
            recursiveCompare(expObj[k], actObj[k], curPath ? `${curPath}.${k}` : k);
          }
        }
        return;
      }

      diffFound(curPath, `Value mismatch: expected ${String(exp)}, got ${String(act)}`);
    };

    recursiveCompare(expected, actual, path);

    const canonicalExpected = this.canonicalize(expected);
    const canonicalActual = this.canonicalize(actual);
    const exactMatch = canonicalExpected === canonicalActual;
    const equivalent = differences.length === 0;

    return {
      exactMatch,
      equivalent,
      maxAbsoluteDifference: maxAbsDiff,
      maxRelativeDifference: maxRelDiff,
      tolerance,
      differences
    };
  }

  /**
   * Executes a reproducibility test by evaluating the boundary twice
   * under identical captured preconditions.
   */
  public static runReproducibilityTest(
    boundary: DeterminismBoundary,
    options: { tolerance?: number } = {}
  ): { runA: unknown; runB: unknown; comparison: DeterminismComparison } {
    const runA = boundary.execute();
    const canonA = boundary.canonicalizeOutput(runA);

    const runB = boundary.execute();
    const canonB = boundary.canonicalizeOutput(runB);

    const comparison = boundary.compare(canonA, canonB, options.tolerance);

    return {
      runA: canonA,
      runB: canonB,
      comparison
    };
  }

  /**
   * Evaluates a component against its declared DeterminismContract.
   */
  public static evaluateDeterminism(
    contract: DeterminismContract,
    boundary: DeterminismBoundary,
    options: { runs?: number; tolerance?: number } = {}
  ): DeterminismEvaluation {
    const evidence: string[] = [];
    const limitations: string[] = [];
    const declaredTolerance = options.tolerance !== undefined ? options.tolerance : 0;

    // 1. Capture and hash inputs and configuration
    const rawInputs = boundary.captureInputs();
    const rawConfig = boundary.captureConfiguration();
    const rawEnv = boundary.captureEnvironment();

    const computedInputsHash = this.hash(rawInputs);
    const computedConfigHash = this.hash(rawConfig);

    evidence.push(`Computed inputsHash: ${computedInputsHash}`);
    evidence.push(`Computed configurationHash: ${computedConfigHash}`);

    // Verify contract hashes match captured execution boundary
    if (contract.inputsHash && contract.inputsHash !== computedInputsHash) {
      limitations.push(`Contract inputsHash mismatch: declared ${contract.inputsHash}, computed ${computedInputsHash}`);
    }
    if (contract.configurationHash && contract.configurationHash !== computedConfigHash) {
      limitations.push(`Contract configurationHash mismatch: declared ${contract.configurationHash}, computed ${computedConfigHash}`);
    }

    // 2. Compute execution fingerprint
    const executionFingerprint = this.computeExecutionFingerprint({
      componentId: contract.componentId,
      contractVersion: contract.contractVersion,
      configurationHash: computedConfigHash,
      inputsHash: computedInputsHash,
      seed: contract.seed,
      clockMode: contract.clockMode,
      declaredDependencies: contract.declaredDependencies
    });
    evidence.push(`Generated Execution Fingerprint: ${executionFingerprint}`);

    // 3. Multi-run execution & comparison
    const numRuns = Math.max(options.runs || 2, 2);
    const outputs: unknown[] = [];
    const outputHashes: string[] = [];

    for (let r = 0; r < numRuns; r++) {
      const out = boundary.execute();
      const canonOut = boundary.canonicalizeOutput(out);
      outputs.push(canonOut);
      outputHashes.push(this.hash(canonOut));
    }

    const firstOutput = outputs[0];
    const firstHash = outputHashes[0];
    let allExactMatch = true;
    let allEquivalent = true;
    const accumulatedDifferences: string[] = [];

    for (let i = 1; i < numRuns; i++) {
      const comp = boundary.compare(firstOutput, outputs[i], declaredTolerance);
      if (!comp.exactMatch) {
        allExactMatch = false;
      }
      if (!comp.equivalent) {
        allEquivalent = false;
        accumulatedDifferences.push(...comp.differences);
      }
    }

    evidence.push(`Evaluated across ${numRuns} independent execution passes.`);
    evidence.push(`Exact Byte Match across passes: ${allExactMatch}`);
    evidence.push(`Numerical/Structural Equivalence within tol(${declaredTolerance}): ${allEquivalent}`);

    // 4. Classify determinism level based on evidence
    let classification: DeterminismLevel = 'UNPROVEN';
    let verified = false;

    if (contract.level === 'DETERMINISTIC') {
      if (allExactMatch) {
        classification = 'DETERMINISTIC';
        verified = true;
        evidence.push('Verified exact byte-level determinism under identical inputs, config, seed, and clock.');
      } else if (allEquivalent) {
        classification = 'REPRODUCIBLE';
        verified = false;
        limitations.push('Contract claimed DETERMINISTIC but only REPRODUCIBLE (within numerical tolerance) was observed.');
      } else {
        classification = 'NON_DETERMINISTIC';
        verified = false;
        limitations.push(`Contract claimed DETERMINISTIC but output differed across runs without tolerance containment.`);
      }
    } else if (contract.level === 'REPRODUCIBLE') {
      if (allEquivalent) {
        classification = 'REPRODUCIBLE';
        verified = true;
        evidence.push(`Verified reproducible output within tolerance ${declaredTolerance}.`);
      } else {
        classification = 'NON_DETERMINISTIC';
        verified = false;
        limitations.push(`Contract claimed REPRODUCIBLE but outputs diverged beyond tolerance ${declaredTolerance}.`);
      }
    } else if (contract.level === 'NON_DETERMINISTIC') {
      classification = 'NON_DETERMINISTIC';
      verified = true;
      evidence.push('Component correctly declared as NON_DETERMINISTIC; non-identical results expected.');
    } else if (contract.level === 'ENVIRONMENT_DEPENDENT') {
      classification = 'ENVIRONMENT_DEPENDENT';
      verified = true;
      evidence.push('Component correctly declared as ENVIRONMENT_DEPENDENT.');
    } else if (contract.level === 'REPLAYABLE') {
      classification = allExactMatch || allEquivalent ? 'REPLAYABLE' : 'NON_DETERMINISTIC';
      verified = allExactMatch || allEquivalent;
    } else {
      classification = 'UNPROVEN';
      verified = false;
      limitations.push('Insufficient evidence or unhandled contract determinism level.');
    }

    return {
      componentId: contract.componentId,
      classification,
      verified,
      exactMatch: allExactMatch,
      reproducible: allEquivalent,
      replayable: allExactMatch || allEquivalent,
      inputsHash: computedInputsHash,
      configurationHash: computedConfigHash,
      outputHash: firstHash,
      executionFingerprint,
      differences: accumulatedDifferences,
      evidence,
      limitations
    };
  }
}
