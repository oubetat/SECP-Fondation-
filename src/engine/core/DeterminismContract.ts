/**
 * SECP Industrial OS v2 — Determinism Contract
 * 
 * Formal taxonomy and contract for software determinism, reproducibility, 
 * replayability, and environment dependency at explicit execution boundaries.
 */

/**
 * Formal Determinism Levels
 * 
 * - DETERMINISTIC: Identical canonical inputs + configuration + seed + clock produce byte-for-byte identical output.
 * - REPRODUCIBLE: Repeated executions produce results matching within explicit engineering tolerances (numerical equivalence).
 * - REPLAYABLE: Execution trace can be re-executed in same logical sequence (state replay).
 * - NON_DETERMINISTIC: Component inherently or intentionally permits varying results (e.g. unseeded RNG, concurrency race).
 * - ENVIRONMENT_DEPENDENT: Output varies based on un-normalized hardware, OS, GPU, or floating-point nuances.
 * - UNPROVEN: Insufficient evidence exists to verify the determinism classification.
 */
export type DeterminismLevel =
  | 'DETERMINISTIC'
  | 'REPRODUCIBLE'
  | 'REPLAYABLE'
  | 'NON_DETERMINISTIC'
  | 'ENVIRONMENT_DEPENDENT'
  | 'UNPROVEN';

/**
 * Formal Determinism Contract
 */
export interface DeterminismContract {
  componentId: string;
  contractVersion: string;

  level: DeterminismLevel;

  inputsHash: string;
  configurationHash: string;

  executionFingerprint?: string;

  outputHash?: string;

  environmentFingerprint?: string;

  seed?: string | number;

  clockMode?: 'WALL_CLOCK' | 'DETERMINISTIC' | 'SIMULATION' | string;

  declaredDependencies: string[];

  verified: boolean;

  reasons: string[];
}

/**
 * Numerical and Structural Comparison Result
 */
export interface DeterminismComparison {
  /** True if exactMatch is true OR if differences fall strictly within explicit tolerance */
  equivalent: boolean;
  
  /** True ONLY if byte-for-byte / value-for-value identical across all fields */
  exactMatch: boolean;

  /** Maximum absolute error observed across numerical fields: |a - b| */
  maxAbsoluteDifference?: number;

  /** Maximum relative error observed across numerical fields: |a - b| / max(|a|, referenceFloor) */
  maxRelativeDifference?: number;

  /** The explicit caller-provided engineering tolerance used for evaluation */
  tolerance?: number;

  /** Detailed list of structural or numerical differences */
  differences: string[];
}

/**
 * Boundary interface for executing and capturing a component's lifecycle
 */
export interface DeterminismBoundary {
  componentId: string;

  captureInputs(): unknown;

  captureConfiguration(): unknown;

  captureEnvironment(): unknown;

  execute(): unknown;

  canonicalizeOutput(output: unknown): unknown;

  compare(
    expected: unknown,
    actual: unknown,
    tolerance?: number
  ): DeterminismComparison;
}

/**
 * Structured Output for Determinism Evaluation
 */
export interface DeterminismEvaluation {
  componentId: string;

  classification: DeterminismLevel;

  verified: boolean;

  exactMatch: boolean;

  reproducible: boolean;

  replayable: boolean;

  inputsHash: string;

  configurationHash: string;

  outputHash?: string;

  executionFingerprint: string;

  differences: string[];

  evidence: string[];

  limitations: string[];
}
