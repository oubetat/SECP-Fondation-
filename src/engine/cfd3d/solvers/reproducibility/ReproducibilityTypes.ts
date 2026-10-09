/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: CFD Reproducibility Types & Data Models
 */

export type DeterminismClass =
  | 'BITWISE_DETERMINISTIC'
  | 'NUMERICALLY_DETERMINISTIC'
  | 'STATISTICALLY_REPRODUCIBLE'
  | 'NON_DETERMINISTIC'
  | 'UNKNOWN';

export type ReproducibilityLevel =
  | 'NOT_REPRODUCIBLE'
  | 'REPLAYABLE'
  | 'NUMERICALLY_REPRODUCIBLE'
  | 'FORENSICALLY_REPRODUCIBLE'
  | 'BITWISE_REPRODUCIBLE';

export type ReplayEnvironmentStatus = 'IDENTICAL' | 'COMPATIBLE' | 'DRIFTED' | 'UNKNOWN';

export type DriftSeverity = 'NO_DRIFT' | 'MINOR_DRIFT' | 'MATERIAL_DRIFT' | 'CRITICAL_DRIFT';

export interface SoftwareFingerprint {
  readonly applicationVersion: string;
  readonly executableHash: string;
  readonly buildId: string;
  readonly compiler: string;
  readonly compilerVersion: string;
  readonly buildFlags: string;
  readonly dependencies: Readonly<Record<string, string>>;
}

export interface HardwareFingerprint {
  readonly cpuModel: string;
  readonly architecture: string;
  readonly coreCount: number;
  readonly gpuModel?: string;
  readonly gpuComputeCapability?: string;
  readonly memoryBytes: number;
}

export interface EnvironmentFingerprint {
  readonly os: string;
  readonly kernel: string;
  readonly runtime: string;
  readonly containerDigest?: string;
  readonly environmentVariablesHash: string;
  readonly locale: string;
  readonly timezone: string;
}

export interface ExecutionParameters {
  readonly processCount: number;
  readonly threadCount: number;
  readonly gpuCount: number;
  readonly randomSeed: number;
  readonly commandLine: string;
}

export interface ReproducibilityEnvelope {
  readonly fieldToleranceAbs: number;
  readonly fieldToleranceRel: number;
  readonly residualToleranceAbs: number;
  readonly conservationToleranceAbs: number;
  readonly qoiToleranceRel: number;
  readonly temporalToleranceAbs: number;
}

export interface ReproducibilityCaseManifest {
  readonly reproducibilityCaseId: string;
  readonly originalCaseId: string;
  readonly originalRunId: string;
  readonly originalEvidenceId: string;
  readonly originalEvidenceRootHash: string;
  readonly replayRunId: string;
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly physicsHash: string;
  readonly materialHash: string;
  readonly bcHash: string;
  readonly icHash: string;
  readonly solverConfigHash: string;
  readonly numericalConfigHash: string;
  readonly executableHash: string;
  readonly dependencyHash: string;
  readonly environmentHash: string;
  readonly hardwareHash: string;
  readonly containerHash: string;
  readonly compilerHash: string;
  readonly runtimeHash: string;
  readonly schemaVersion: string;
  readonly softwareVersion: string;
  readonly policyVersion: string;
  readonly createdAt: string;
}

export interface CFDReproducibilityCapsule {
  readonly capsuleId: string;
  readonly originalCaseId: string;
  readonly originalRunId: string;
  readonly inputs: {
    readonly geometry: unknown;
    readonly mesh: unknown;
    readonly physics: unknown;
    readonly material: unknown;
    readonly bc: unknown;
    readonly ic: unknown;
    readonly solverConfig: unknown;
    readonly numericalSchemes: unknown;
  };
  readonly software: SoftwareFingerprint;
  readonly hardware: HardwareFingerprint;
  readonly environment: EnvironmentFingerprint;
  readonly executionParams: ExecutionParameters;
  readonly envelope: ReproducibilityEnvelope;
  readonly originalResultSummary: {
    readonly fieldsHash: string;
    readonly finalResidual: number;
    readonly massImbalance: number;
    readonly qois: Readonly<Record<string, number>>;
  };
  readonly originalEvidenceRootHash: string;
  readonly frozenAt: string;
}

export interface FieldComparisonResult {
  readonly fieldName: string;
  readonly maxAbsDiff: number;
  readonly meanAbsDiff: number;
  readonly rmsDiff: number;
  readonly maxRelDiff: number;
  readonly l1Norm: number;
  readonly l2Norm: number;
  readonly lInfNorm: number;
  readonly isWithinEnvelope: boolean;
}

export interface QoIComparisonResult {
  readonly qoiName: string;
  readonly originalValue: number;
  readonly replayValue: number;
  readonly absDiff: number;
  readonly relDiff: number;
  readonly isWithinEnvelope: boolean;
}

export type ReproducibilityVerdict =
  | 'REPRODUCIBLE_BITWISE'
  | 'REPRODUCIBLE_NUMERICAL'
  | 'REPRODUCIBLE_FORENSIC'
  | 'REPRODUCIBILITY_FAILED'
  | 'REPRODUCIBILITY_INCONCLUSIVE';

export interface CFDReproducibilityReport {
  readonly caseIdentity: ReproducibilityCaseManifest;
  readonly determinismClass: DeterminismClass;
  readonly reproducibilityLevel: ReproducibilityLevel;
  readonly environmentStatus: ReplayEnvironmentStatus;
  readonly environmentDrift: DriftSeverity;
  readonly fieldComparisons: readonly FieldComparisonResult[];
  readonly qoiComparisons: readonly QoIComparisonResult[];
  readonly residualDiff: number;
  readonly conservationDiff: number;
  readonly evidenceReplayMatch: boolean;
  readonly provenanceReplayMatch: boolean;
  readonly verdict: ReproducibilityVerdict;
}
